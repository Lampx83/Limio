import { randomBytes, randomUUID } from "node:crypto";
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
 * - Học viên chọn khoá đã hoàn thành (có Certificate) để khoe; link chứng
 *   nhận /verify/<certNumber> đi kèm. Bài của một khoá chỉ hiện khi khoá đó
 *   được khoe, và mỗi khoá khoe tối đa PORTFOLIO_MAX_ITEMS_PER_GROUP bài.
 * - Ghim được AssignmentSubmission của chính mình, đã chấm hay chưa đều được.
 *   Bài của khoá thì khoá đó phải đã hoàn thành.
 * - Không snapshot: trang công khai luôn hiện nội dung bài nộp mới nhất.
 * - Trang công khai không bao giờ trả điểm, nhận xét GV, email hay dữ liệu
 *   learner model — kể cả khi học viên ghim bài đã chấm.
 */

export class PortfolioError extends Error {
  constructor(
    public readonly code:
      | "submission_not_found"
      | "course_not_completed"
      | "group_full"
      | "slug_invalid"
      | "slug_taken"
      | "validation_failed",
  ) {
    super(code);
  }
}

export const PORTFOLIO_NOTE_MAX = 500;
export const PORTFOLIO_HEADLINE_MAX = 160;
export const PORTFOLIO_ABOUT_MAX = 500;
/** Trần số bài khoe mỗi khoá (hoặc mỗi đấu trường). Kiểm ở server, UI chỉ phản chiếu. */
export const PORTFOLIO_MAX_ITEMS_PER_GROUP = 2;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export function isValidPortfolioSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !slug.includes("--");
}

const NoteInput = z.string().trim().max(PORTFOLIO_NOTE_MAX);

const SettingsInput = z.object({
  isPublic: z.boolean().optional(),
  headline: z.string().trim().max(PORTFOLIO_HEADLINE_MAX).nullable().optional(),
  about: z.string().trim().max(PORTFOLIO_ABOUT_MAX).nullable().optional(),
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
  // INSERT … ON CONFLICT DO NOTHING rồi đọc lại — không dùng create + bắt P2002
  // (trong transaction một lỗi unique làm hỏng cả transaction) và cũng không
  // dùng Prisma upsert (không phải lúc nào cũng dịch thành ON CONFLICT gốc).
  const slug = await defaultSlug(user.displayName, db);
  await db.$executeRaw`
    INSERT INTO "Portfolio" ("id", "userId", "slug", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${slug}, NOW())
    ON CONFLICT ("userId") DO NOTHING`;
  return db.portfolio.findUniqueOrThrow({ where: { userId } });
}

const submissionSelect = {
  id: true,
  userId: true,
  status: true,
  submittedAt: true,
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
function courseIdOf(s: SubmissionRow): string | null {
  return s.assignment.lesson?.module.course.id ?? null;
}

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
  status: "submitted" | "graded";
  // Điểm chỉ dành cho chính học viên trong trang soạn — trang công khai không có.
  score: number | null;
  maxScore: number;
  submittedAt: Date;
  gradedAt: Date | null;
  pinned: boolean;
  note: string | null;
}

export interface PortfolioEditorCourse {
  courseId: string;
  title: string;
  certNumber: string;
  issuedAt: Date;
  pinned: boolean;
}

/**
 * Dữ liệu trang soạn: hồ sơ, các khoá đã hoàn thành (để chọn khoe) và bài đã
 * nộp (mới nhất lên đầu). Bài của khoá chưa hoàn thành bị loại — không ghim
 * được nên không liệt kê.
 */
export async function getPortfolioEditor(userId: string, db: DbClient = prisma) {
  const portfolio = await getOrCreatePortfolio(userId, db);
  const [subs, items, certs, pinnedCourses] = await Promise.all([
    db.assignmentSubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      select: submissionSelect,
    }),
    db.portfolioItem.findMany({
      where: { portfolioId: portfolio.id },
      select: { submissionId: true, note: true },
    }),
    db.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      select: { id: true, courseId: true, certNumber: true, courseTitleSnapshot: true, issuedAt: true },
    }),
    db.portfolioCourse.findMany({ where: { portfolioId: portfolio.id }, select: { certificateId: true } }),
  ]);
  const pinned = new Map(items.map((i) => [i.submissionId, i.note]));
  const pinnedCertIds = new Set(pinnedCourses.map((c) => c.certificateId));
  const completed = new Set(certs.map((c) => c.courseId));

  const rows: PortfolioEditorRow[] = subs
    .filter((s) => {
      const cid = courseIdOf(s);
      return cid === null || completed.has(cid);
    })
    .map((s) => {
      const g = groupOf(s);
      return {
        submissionId: s.id,
        assignmentTitle: s.assignment.title,
        groupKey: g.key,
        groupTitle: g.title,
        body: s.body,
        attachmentUrl: s.attachmentUrl,
        status: s.status,
        score: s.score,
        maxScore: s.assignment.maxScore,
        submittedAt: s.submittedAt,
        gradedAt: s.gradedAt,
        pinned: pinned.has(s.id),
        note: pinned.get(s.id) ?? null,
      };
    });
  const courses: PortfolioEditorCourse[] = certs.map((c) => ({
    courseId: c.courseId,
    title: c.courseTitleSnapshot,
    certNumber: c.certNumber,
    issuedAt: c.issuedAt,
    pinned: pinnedCertIds.has(c.id),
  }));
  return { portfolio, rows, courses };
}

async function loadOwnSubmission(userId: string, submissionId: string, db: DbClient) {
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
 * chính học viên; bài của khoá thì khoá phải đã hoàn thành; mỗi khoá (hoặc
 * đấu trường) tối đa PORTFOLIO_MAX_ITEMS_PER_GROUP bài.
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
    const s = await loadOwnSubmission(userId, submissionId, tx);
    const portfolio = await getOrCreatePortfolio(userId, tx);
    // Hai lần ghim đồng thời không được cùng lọt qua phép đếm trần.
    await tx.$queryRaw`SELECT 1 FROM "Portfolio" WHERE "id" = ${portfolio.id} FOR UPDATE`;
    const group = groupOf(s);
    const courseId = courseIdOf(s);

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
        { courseId: group.courseId },
        tx,
      );
      return { created: false };
    }

    if (courseId) {
      const cert = await tx.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      });
      if (!cert) throw new PortfolioError("course_not_completed");
    }
    const siblings = await tx.portfolioItem.findMany({
      where: { portfolioId: portfolio.id },
      select: { submission: { select: submissionSelect } },
    });
    if (siblings.filter((i) => groupOf(i.submission).key === group.key).length >= PORTFOLIO_MAX_ITEMS_PER_GROUP) {
      throw new PortfolioError("group_full");
    }

    await tx.portfolioItem.create({ data: { portfolioId: portfolio.id, submissionId, note } });
    await emitEvent(
      userId,
      LearningEventType.PortfolioItemAdded,
      { portfolioId: portfolio.id, submissionId, noteLength: note?.length ?? 0 },
      { courseId: group.courseId },
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

/**
 * Khoe một khoá đã hoàn thành (kèm chứng nhận) trên trang công khai.
 * Chưa có chứng nhận → course_not_completed. Idempotent.
 */
export async function pinPortfolioCourse(userId: string, courseId: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const cert = await tx.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!cert) throw new PortfolioError("course_not_completed");
    const portfolio = await getOrCreatePortfolio(userId, tx);
    const existing = await tx.portfolioCourse.findUnique({
      where: { portfolioId_certificateId: { portfolioId: portfolio.id, certificateId: cert.id } },
      select: { id: true },
    });
    if (existing) return { created: false };
    await tx.portfolioCourse.create({ data: { portfolioId: portfolio.id, certificateId: cert.id } });
    await emitEvent(
      userId,
      LearningEventType.PortfolioCourseAdded,
      { portfolioId: portfolio.id, certificateId: cert.id, courseId },
      { courseId },
      tx,
    );
    return { created: true };
  });
}

/** Thôi khoe khoá. Các bài đã ghim của khoá được giữ lại nhưng ẩn khỏi trang công khai. */
export async function unpinPortfolioCourse(userId: string, courseId: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const portfolio = await tx.portfolio.findUnique({ where: { userId } });
    if (!portfolio) return { removed: false };
    const cert = await tx.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!cert) return { removed: false };
    const existing = await tx.portfolioCourse.findUnique({
      where: { portfolioId_certificateId: { portfolioId: portfolio.id, certificateId: cert.id } },
      select: { id: true },
    });
    if (!existing) return { removed: false };
    await tx.portfolioCourse.delete({ where: { id: existing.id } });
    await emitEvent(
      userId,
      LearningEventType.PortfolioCourseRemoved,
      { portfolioId: portfolio.id, certificateId: cert.id, courseId },
      { courseId },
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
      ...(input.about !== undefined && { about: input.about || null }),
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
  about: string | null;
  /** Tổng số bài đang hiện trên trang (đã trừ bài của khoá không khoe). */
  workCount: number;
  groups: {
    key: string;
    title: string;
    /** Có khi nhóm là một khoá đã hoàn thành được khoe; null với đấu trường / "Khác". */
    certificate: { certNumber: string; issuedAt: Date } | null;
    items: {
      submissionId: string;
      title: string;
      note: string | null;
      body: string;
      attachmentUrl: string | null;
      submittedAt: Date;
      /** Chỉ có khi bài đang ở trạng thái đã chấm. Không bao giờ kèm điểm hay nhận xét. */
      gradedAt: Date | null;
    }[];
  }[];
}

/**
 * Trang công khai /p/<slug>. Trả null khi không có hoặc chưa công khai — caller
 * trả 404 cho cả hai, không phân biệt. Nhóm khoá = các khoá học viên chọn khoe;
 * bài của khoá không được khoe thì ẩn.
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
      about: true,
      user: { select: { displayName: true, avatarUrl: true } },
      courses: {
        select: {
          certificate: {
            select: { courseId: true, certNumber: true, courseTitleSnapshot: true, issuedAt: true },
          },
        },
      },
      items: { select: { note: true, submission: { select: submissionSelect } } },
    },
  });
  if (!p || !p.isPublic) return null;

  const groups = new Map<string, PublicPortfolio["groups"][number]>();
  const pinnedCourses = p.courses
    .map((c) => c.certificate)
    .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  for (const c of pinnedCourses) {
    groups.set(`course:${c.courseId}`, {
      key: `course:${c.courseId}`,
      title: c.courseTitleSnapshot,
      certificate: { certNumber: c.certNumber, issuedAt: c.issuedAt },
      items: [],
    });
  }

  const sorted = [...p.items].sort(
    (a, b) => b.submission.submittedAt.getTime() - a.submission.submittedAt.getTime(),
  );
  let workCount = 0;
  for (const it of sorted) {
    const g = groupOf(it.submission);
    let group = groups.get(g.key);
    if (!group) {
      // Bài của khoá chưa được khoe: ẩn. Đấu trường / "Khác" không gắn khoá nên luôn hiện.
      if (g.key.startsWith("course:")) continue;
      group = { key: g.key, title: g.title, certificate: null, items: [] };
      groups.set(g.key, group);
    }
    group.items.push({
      submissionId: it.submission.id,
      title: it.submission.assignment.title,
      note: it.note,
      body: it.submission.body,
      attachmentUrl: it.submission.attachmentUrl,
      submittedAt: it.submission.submittedAt,
      gradedAt: it.submission.status === "graded" ? it.submission.gradedAt : null,
    });
    workCount += 1;
  }

  return {
    slug: p.slug,
    displayName: p.user.displayName,
    avatarUrl: p.user.avatarUrl,
    headline: p.headline,
    about: p.about,
    workCount,
    groups: [...groups.values()],
  };
}
