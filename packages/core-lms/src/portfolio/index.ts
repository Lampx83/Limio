import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { slugify } from "../courses/slug";

/**
 * A8 — E-portfolio học viên, bản tối giản (trưng bày).
 *
 * - Mỗi học viên 1 hồ sơ, tạo lười ở lần đầu mở trang soạn.
 * - Chỉ ghim được AssignmentSubmission của chính mình, đang ở trạng thái graded.
 * - Không snapshot: nộp lại bài làm submission quay về `submitted`, mục đó tạm
 *   biến khỏi trang công khai cho tới khi GV chấm lại — nhãn "GV đã chấm" vì
 *   thế luôn đúng với thực tế.
 * - Trang công khai không bao giờ trả điểm, nhận xét GV, email hay dữ liệu
 *   learner model.
 */

export class PortfolioError extends Error {
  constructor(
    public readonly code:
      | "submission_not_found"
      | "not_graded"
      | "slug_invalid"
      | "slug_taken"
      | "validation_failed",
  ) {
    super(code);
  }
}

export const PORTFOLIO_NOTE_MAX = 500;
export const PORTFOLIO_HEADLINE_MAX = 160;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export function isValidPortfolioSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !slug.includes("--");
}

const NoteInput = z.string().trim().max(PORTFOLIO_NOTE_MAX);

const SettingsInput = z.object({
  isPublic: z.boolean().optional(),
  headline: z.string().trim().max(PORTFOLIO_HEADLINE_MAX).nullable().optional(),
  slug: z.string().trim().toLowerCase().optional(),
});

function randomSuffix(): string {
  return randomBytes(4).toString("hex").slice(0, 6);
}

/** Slug mặc định = tên hiển thị + hậu tố ngẫu nhiên, để link không đoán được theo tên. */
async function defaultSlug(displayName: string, db: DbClient): Promise<string> {
  const base = slugify(displayName).slice(0, 30).replace(/-+$/, "") || "hoc-vien";
  for (;;) {
    const candidate = `${base}-${randomSuffix()}`;
    const taken = await db.portfolio.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
}

export async function getOrCreatePortfolio(userId: string, db: DbClient = prisma) {
  const existing = await db.portfolio.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true },
  });
  try {
    return await db.portfolio.create({
      data: { userId, slug: await defaultSlug(user.displayName, db) },
    });
  } catch (e) {
    // Hai request mở trang cùng lúc → request sau đụng unique(userId).
    if ((e as { code?: string }).code === "P2002") {
      return db.portfolio.findUniqueOrThrow({ where: { userId } });
    }
    throw e;
  }
}

const submissionSelect = {
  id: true,
  userId: true,
  status: true,
  body: true,
  attachmentUrl: true,
  score: true,
  gradedAt: true,
  assignment: {
    select: {
      title: true,
      maxScore: true,
      lesson: {
        select: { module: { select: { course: { select: { id: true, title: true } } } } },
      },
      tournamentMission: {
        select: { tournament: { select: { id: true, title: true, courseId: true } } },
      },
    },
  },
} as const;

type SubmissionRow = {
  assignment: {
    lesson: { module: { course: { id: string; title: string } } } | null;
    tournamentMission: { tournament: { id: string; title: string; courseId: string | null } } | null;
  };
};

/** Nhóm hiển thị: khoá học cho bài trong bài học, đấu trường cho bài của nhiệm vụ. */
function groupOf(s: SubmissionRow): { key: string; title: string; courseId: string | null } {
  const course = s.assignment.lesson?.module.course;
  if (course) return { key: `course:${course.id}`, title: course.title, courseId: course.id };
  const t = s.assignment.tournamentMission?.tournament;
  if (t) return { key: `tournament:${t.id}`, title: t.title, courseId: t.courseId };
  return { key: "other", title: "Khác", courseId: null };
}

export interface PortfolioEditorRow {
  submissionId: string;
  assignmentTitle: string;
  groupKey: string;
  groupTitle: string;
  body: string;
  attachmentUrl: string | null;
  score: number | null;
  maxScore: number;
  gradedAt: Date | null;
  pinned: boolean;
  note: string | null;
}

/** Dữ liệu trang soạn: hồ sơ + mọi bài đã chấm của học viên (mới chấm lên đầu). */
export async function getPortfolioEditor(userId: string, db: DbClient = prisma) {
  const portfolio = await getOrCreatePortfolio(userId, db);
  const [subs, items] = await Promise.all([
    db.assignmentSubmission.findMany({
      where: { userId, status: "graded" },
      orderBy: { gradedAt: "desc" },
      select: submissionSelect,
    }),
    db.portfolioItem.findMany({
      where: { portfolioId: portfolio.id },
      select: { submissionId: true, note: true },
    }),
  ]);
  const pinned = new Map(items.map((i) => [i.submissionId, i.note]));
  const rows: PortfolioEditorRow[] = subs.map((s) => {
    const g = groupOf(s);
    return {
      submissionId: s.id,
      assignmentTitle: s.assignment.title,
      groupKey: g.key,
      groupTitle: g.title,
      body: s.body,
      attachmentUrl: s.attachmentUrl,
      score: s.score,
      maxScore: s.assignment.maxScore,
      gradedAt: s.gradedAt,
      pinned: pinned.has(s.id),
      note: pinned.get(s.id) ?? null,
    };
  });
  return { portfolio, rows };
}

async function loadOwnGradedSubmission(userId: string, submissionId: string, db: DbClient) {
  const s = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: submissionSelect,
  });
  // Không lộ việc submission của người khác tồn tại.
  if (!s || s.userId !== userId) throw new PortfolioError("submission_not_found");
  return s;
}

/**
 * Ghim bài vào hồ sơ, hoặc sửa câu giới thiệu nếu đã ghim. Bài phải là của
 * chính học viên và đang được chấm.
 */
export async function pinPortfolioItem(
  userId: string,
  submissionId: string,
  rawNote: unknown,
  db: PrismaClient = prisma,
) {
  const parsedNote = NoteInput.nullable().optional().safeParse(rawNote);
  if (!parsedNote.success) throw new PortfolioError("validation_failed");
  const note = parsedNote.data ? parsedNote.data : null;

  return db.$transaction(async (tx) => {
    const s = await loadOwnGradedSubmission(userId, submissionId, tx);
    if (s.status !== "graded") throw new PortfolioError("not_graded");
    const portfolio = await getOrCreatePortfolio(userId, tx);
    const courseId = groupOf(s).courseId;

    const existing = await tx.portfolioItem.findUnique({
      where: { portfolioId_submissionId: { portfolioId: portfolio.id, submissionId } },
    });
    if (existing) {
      if (existing.note === note) return { created: false };
      await tx.portfolioItem.update({ where: { id: existing.id }, data: { note } });
      await emitEvent(
        userId,
        LearningEventType.PortfolioItemUpdated,
        { portfolioId: portfolio.id, submissionId, noteLength: note?.length ?? 0 },
        { courseId },
        tx,
      );
      return { created: false };
    }
    await tx.portfolioItem.create({ data: { portfolioId: portfolio.id, submissionId, note } });
    await emitEvent(
      userId,
      LearningEventType.PortfolioItemAdded,
      { portfolioId: portfolio.id, submissionId, noteLength: note?.length ?? 0 },
      { courseId },
      tx,
    );
    return { created: true };
  });
}

/** Bỏ ghim. Idempotent: bài chưa ghim thì không làm gì, không phát event. */
export async function unpinPortfolioItem(
  userId: string,
  submissionId: string,
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    const portfolio = await tx.portfolio.findUnique({ where: { userId } });
    if (!portfolio) return { removed: false };
    const item = await tx.portfolioItem.findUnique({
      where: { portfolioId_submissionId: { portfolioId: portfolio.id, submissionId } },
      select: { id: true, submission: { select: submissionSelect } },
    });
    if (!item) return { removed: false };
    await tx.portfolioItem.delete({ where: { id: item.id } });
    await emitEvent(
      userId,
      LearningEventType.PortfolioItemRemoved,
      { portfolioId: portfolio.id, submissionId },
      { courseId: groupOf(item.submission).courseId },
      tx,
    );
    return { removed: true };
  });
}

/** Bật/tắt công khai, sửa dòng giới thiệu, đổi đường dẫn. */
export async function updatePortfolioSettings(
  userId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const parsed = SettingsInput.safeParse(rawInput);
  if (!parsed.success) throw new PortfolioError("validation_failed");
  const input = parsed.data;
  if (input.slug !== undefined && !isValidPortfolioSlug(input.slug)) {
    throw new PortfolioError("slug_invalid");
  }

  return db.$transaction(async (tx) => {
    const portfolio = await getOrCreatePortfolio(userId, tx);
    if (input.slug !== undefined && input.slug !== portfolio.slug) {
      const taken = await tx.portfolio.findUnique({ where: { slug: input.slug }, select: { id: true } });
      if (taken) throw new PortfolioError("slug_taken");
    }
    const data = {
      ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
      ...(input.headline !== undefined && { headline: input.headline || null }),
      ...(input.slug !== undefined && { slug: input.slug }),
    };
    const updated = await tx.portfolio.update({ where: { id: portfolio.id }, data });
    if (input.isPublic !== undefined && input.isPublic !== portfolio.isPublic) {
      await emitEvent(
        userId,
        LearningEventType.PortfolioVisibilityChanged,
        { portfolioId: portfolio.id, isPublic: input.isPublic },
        {},
        tx,
      );
    }
    return updated;
  });
}

export interface PublicPortfolio {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  completedCourses: { title: string; completedAt: Date }[];
  groups: {
    title: string;
    items: {
      submissionId: string;
      title: string;
      note: string | null;
      body: string;
      attachmentUrl: string | null;
      gradedAt: Date | null;
    }[];
  }[];
}

/**
 * Trang công khai /p/<slug>. Trả null khi không có hoặc chưa công khai — caller
 * trả 404 cho cả hai, không phân biệt. Chỉ mục có bài đang ở trạng thái graded.
 */
export async function getPublicPortfolio(
  slug: string,
  db: DbClient = prisma,
): Promise<PublicPortfolio | null> {
  const p = await db.portfolio.findUnique({
    where: { slug },
    select: {
      slug: true,
      isPublic: true,
      headline: true,
      userId: true,
      user: { select: { displayName: true, avatarUrl: true } },
      items: {
        where: { submission: { status: "graded" } },
        select: { note: true, submission: { select: submissionSelect } },
      },
    },
  });
  if (!p || !p.isPublic) return null;

  const enrollments = await db.enrollment.findMany({
    where: { userId: p.userId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true, course: { select: { title: true } } },
  });

  const sorted = [...p.items].sort(
    (a, b) => (b.submission.gradedAt?.getTime() ?? 0) - (a.submission.gradedAt?.getTime() ?? 0),
  );
  const groups = new Map<string, PublicPortfolio["groups"][number]>();
  for (const it of sorted) {
    const g = groupOf(it.submission);
    let group = groups.get(g.key);
    if (!group) {
      group = { title: g.title, items: [] };
      groups.set(g.key, group);
    }
    group.items.push({
      submissionId: it.submission.id,
      title: it.submission.assignment.title,
      note: it.note,
      body: it.submission.body,
      attachmentUrl: it.submission.attachmentUrl,
      gradedAt: it.submission.gradedAt,
    });
  }

  return {
    slug: p.slug,
    displayName: p.user.displayName,
    avatarUrl: p.user.avatarUrl,
    headline: p.headline,
    completedCourses: enrollments.map((e) => ({
      title: e.course.title,
      completedAt: e.completedAt!,
    })),
    groups: [...groups.values()],
  };
}
