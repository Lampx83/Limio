import { prisma, type Prisma, type PrismaClient } from "@feedbackme/db";
import { masteryLabel, type MasteryLabel } from "@feedbackme/shared-types";
import { isUserEnrolled } from "../learning/enroll";
import { ExamError } from "./types";

/**
 * LANG L6 — thư viện đề của khoá luyện đề (`Course.kind = practice_bank`): vài trăm đề, mỗi đề làm được theo hai chế độ
 * (luyện đề / thi thử mô phỏng). Phía HỌC VIÊN: danh sách phân trang có lọc, tiến độ cá nhân, học thử miễn phí.
 *
 * Quyền: đã ghi danh ⇒ thấy và làm mọi đề. Chưa ghi danh vào khoá luyện đề ⇒ chỉ thấy SIÊU DỮ LIỆU (tên, nguồn, độ khó, năm)
 * của các đề; đề không học thử là `locked` và hình dạng dữ liệu KHÔNG chứa câu hỏi/audio/số câu (L6.5) — nội dung chỉ đi
 * qua các hàm làm bài vốn đã kiểm quyền. Khoá thường chưa ghi danh ⇒ `not_enrolled` như trước.
 */

export type PaperType = "official" | "mock" | "practice_set";
export type MyStatus = "not_started" | "in_progress" | "done" | "redo";

export interface LibraryFilters {
  /** Id bộ, hoặc "none" = đề chưa thuộc bộ nào. */
  collectionId?: string;
  paperType?: PaperType;
  year?: string;
  difficulty?: number;
  status?: MyStatus;
  q?: string;
  sort?: "seq" | "unstarted" | "newest";
  cursor?: string;
  limit?: number;
}

export interface LibraryItem {
  examId: string;
  title: string;
  collectionId: string | null;
  collectionTitle: string | null;
  seq: number | null;
  paperType: PaperType | null;
  sourceLabel: string | null;
  yearLabel: string | null;
  difficulty: number | null;
  tags: string[];
  skills: string[];
  allowMock: boolean;
  allowPractice: boolean;
  freePreview: boolean;
  locked: boolean;
  myStatus: MyStatus;
  /** Mức của lần thi thử gần nhất — nhãn ba mức, KHÔNG có số điểm. */
  lastLevel: MasteryLabel | null;
  attemptCount: number;
}

export interface LibraryPage {
  items: LibraryItem[];
  total: number;
  nextCursor: string | null;
  access: "enrolled" | "preview";
}

export const LIBRARY_DEFAULT_LIMIT = 30;
export const LIBRARY_MAX_LIMIT = 100;

const OPEN_EXAM_WHERE = {
  mockMode: true,
  status: "published" as const,
  kind: "written" as const,
  OR: [{ allowMock: true }, { allowPractice: true }],
};

async function loadAccess(userId: string, courseId: string, db: PrismaClient) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, title: true, kind: true, status: true, priceCents: true, currency: true },
  });
  if (!course) throw new ExamError("course_not_found");
  const enrolled = await isUserEnrolled(userId, courseId, db);
  // Khoá chưa xuất bản không lộ cho người ngoài (kể cả danh sách siêu dữ liệu).
  if (!enrolled && course.status !== "published") throw new ExamError("course_not_found");
  if (!enrolled && course.kind !== "practice_bank") throw new ExamError("not_enrolled");
  return { course, enrolled };
}

interface PersonalState {
  status: MyStatus;
  level: MasteryLabel | null;
  attempts: number;
}

/** Trạng thái cá nhân cho một tập đề: lượt thi (ExamAttempt) và buổi luyện (ExamPracticeSession). */
async function personalStates(userId: string, examIds: string[], db: PrismaClient): Promise<Map<string, PersonalState>> {
  const out = new Map<string, PersonalState>();
  if (examIds.length === 0) return out;
  const [attempts, sessions] = await Promise.all([
    db.examAttempt.findMany({
      where: { userId, examId: { in: examIds } },
      orderBy: { startedAt: "desc" },
      select: { examId: true, status: true, scorePct: true },
    }),
    db.examPracticeSession.findMany({ where: { userId, examId: { in: examIds } }, select: { examId: true, status: true } }),
  ]);
  const acc = new Map<string, { inProgress: boolean; done: boolean; level: MasteryLabel | null; levelSet: boolean; attempts: number }>();
  const get = (id: string) => {
    let v = acc.get(id);
    if (!v) acc.set(id, (v = { inProgress: false, done: false, level: null, levelSet: false, attempts: 0 }));
    return v;
  };
  for (const a of attempts) {
    const v = get(a.examId);
    v.attempts++;
    if (a.status === "in_progress") v.inProgress = true;
    else {
      v.done = true;
      // attempts đã xếp mới nhất trước: lấy mức của lượt NỘP gần nhất có điểm.
      if (!v.levelSet && a.scorePct !== null) {
        v.level = masteryLabel(a.scorePct / 100);
        v.levelSet = true;
      }
    }
  }
  for (const s of sessions) {
    const v = get(s.examId);
    if (s.status === "in_progress") v.inProgress = true;
    else if (s.status === "completed") v.done = true;
  }
  for (const [id, v] of acc) {
    const status: MyStatus = v.inProgress ? "in_progress" : v.done ? (v.level === "needs_review" ? "redo" : "done") : "not_started";
    out.set(id, { status, level: v.level, attempts: v.attempts });
  }
  return out;
}

const decodeCursor = (c: string | undefined): number => {
  const n = Number(c);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export async function listPracticeLibrary(
  userId: string,
  courseId: string,
  filters: LibraryFilters = {},
  db: PrismaClient = prisma,
): Promise<LibraryPage> {
  const { enrolled } = await loadAccess(userId, courseId, db);

  const where: Prisma.ExamWhereInput = { courseId, ...OPEN_EXAM_WHERE };
  const and: Prisma.ExamWhereInput[] = [];
  if (filters.collectionId === "none") and.push({ collectionId: null });
  else if (filters.collectionId) and.push({ collectionId: filters.collectionId });
  if (filters.paperType) and.push({ paperType: filters.paperType });
  if (filters.year) and.push({ yearLabel: filters.year });
  if (filters.difficulty) and.push({ difficulty: filters.difficulty });
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { sourceLabel: { contains: q, mode: "insensitive" } },
        { tags: { hasSome: [q, q.toLowerCase(), q.toUpperCase()] } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const exams = await db.exam.findMany({
    where,
    select: {
      id: true,
      title: true,
      seq: true,
      paperType: true,
      sourceLabel: true,
      yearLabel: true,
      difficulty: true,
      tags: true,
      freePreview: true,
      allowMock: true,
      allowPractice: true,
      createdAt: true,
      collectionId: true,
      collection: { select: { title: true, orderIndex: true } },
      sections: { select: { languageSkill: true } },
    },
  });

  const states = enrolled ? await personalStates(userId, exams.map((e) => e.id), db) : new Map<string, PersonalState>();
  let items = exams.map((e) => {
    const st = states.get(e.id);
    const locked = !enrolled && !e.freePreview;
    return {
      item: {
        examId: e.id,
        title: e.title,
        collectionId: e.collectionId,
        collectionTitle: e.collection?.title ?? null,
        seq: e.seq,
        paperType: e.paperType as PaperType | null,
        sourceLabel: e.sourceLabel,
        yearLabel: e.yearLabel,
        difficulty: e.difficulty,
        tags: e.tags,
        skills: [...new Set(e.sections.map((s) => s.languageSkill).filter((s): s is NonNullable<typeof s> => !!s))],
        allowMock: e.allowMock,
        allowPractice: e.allowPractice,
        freePreview: e.freePreview,
        locked,
        myStatus: st?.status ?? ("not_started" as MyStatus),
        lastLevel: st?.level ?? null,
        attemptCount: st?.attempts ?? 0,
      } satisfies LibraryItem,
      collOrder: e.collection ? e.collection.orderIndex : Number.POSITIVE_INFINITY,
      createdAt: e.createdAt.getTime(),
    };
  });

  if (filters.status) items = items.filter((x) => x.item.myStatus === filters.status);

  const bySeq = (a: (typeof items)[number], b: (typeof items)[number]) =>
    a.collOrder - b.collOrder ||
    (a.item.seq ?? Number.POSITIVE_INFINITY) - (b.item.seq ?? Number.POSITIVE_INFINITY) ||
    a.item.title.localeCompare(b.item.title, "vi");
  const sort = filters.sort ?? "seq";
  if (sort === "newest") items.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === "unstarted") {
    const rank = (s: MyStatus) => (s === "not_started" ? 0 : s === "in_progress" ? 1 : s === "redo" ? 2 : 3);
    items.sort((a, b) => rank(a.item.myStatus) - rank(b.item.myStatus) || bySeq(a, b));
  } else items.sort(bySeq);

  const limit = Math.min(LIBRARY_MAX_LIMIT, Math.max(1, Math.trunc(filters.limit ?? LIBRARY_DEFAULT_LIMIT)));
  const offset = decodeCursor(filters.cursor);
  const page = items.slice(offset, offset + limit);
  return {
    items: page.map((x) => x.item),
    total: items.length,
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
    access: enrolled ? "enrolled" : "preview",
  };
}

export interface PracticeLibrarySummary {
  course: { id: string; slug: string; title: string; kind: string; priceCents: number | null; currency: string };
  enrolled: boolean;
  totalExams: number;
  doneExams: number;
  /** Số đề đã làm nhưng mức gần nhất là "Cần ôn" — dùng cho gợi ý "nên làm lại". */
  redoExams: number;
  previewExams: number;
  collections: { id: string; title: string; count: number; done: number }[];
  /** Đề chưa thuộc bộ nào. */
  unassigned: { count: number; done: number };
  inProgress: { examId: string; title: string; kind: "attempt" | "practice"; refId: string }[];
}

export async function getPracticeLibrarySummary(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<PracticeLibrarySummary> {
  const { course, enrolled } = await loadAccess(userId, courseId, db);
  const [exams, collections] = await Promise.all([
    db.exam.findMany({ where: { courseId, ...OPEN_EXAM_WHERE }, select: { id: true, title: true, collectionId: true, freePreview: true } }),
    db.examCollection.findMany({ where: { courseId }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true } }),
  ]);
  const states = enrolled ? await personalStates(userId, exams.map((e) => e.id), db) : new Map<string, PersonalState>();
  const isDone = (id: string) => {
    const s = states.get(id)?.status;
    return s === "done" || s === "redo";
  };

  const perColl = new Map<string, { count: number; done: number }>();
  const unassigned = { count: 0, done: 0 };
  for (const e of exams) {
    const bucket = e.collectionId ? (perColl.get(e.collectionId) ?? perColl.set(e.collectionId, { count: 0, done: 0 }).get(e.collectionId)!) : unassigned;
    bucket.count++;
    if (isDone(e.id)) bucket.done++;
  }

  let inProgress: PracticeLibrarySummary["inProgress"] = [];
  if (enrolled && exams.length > 0) {
    const ids = exams.map((e) => e.id);
    const title = new Map(exams.map((e) => [e.id, e.title]));
    const [att, ses] = await Promise.all([
      db.examAttempt.findMany({ where: { userId, examId: { in: ids }, status: "in_progress" }, orderBy: { startedAt: "desc" }, select: { id: true, examId: true } }),
      db.examPracticeSession.findMany({ where: { userId, examId: { in: ids }, status: "in_progress" }, orderBy: { startedAt: "desc" }, select: { id: true, examId: true } }),
    ]);
    inProgress = [
      ...att.map((a) => ({ examId: a.examId, title: title.get(a.examId)!, kind: "attempt" as const, refId: a.id })),
      ...ses.map((s) => ({ examId: s.examId, title: title.get(s.examId)!, kind: "practice" as const, refId: s.id })),
    ].slice(0, 5);
  }

  return {
    course: { id: course.id, slug: course.slug, title: course.title, kind: course.kind, priceCents: course.priceCents, currency: course.currency },
    enrolled,
    totalExams: exams.length,
    doneExams: exams.filter((e) => isDone(e.id)).length,
    redoExams: exams.filter((e) => states.get(e.id)?.status === "redo").length,
    previewExams: exams.filter((e) => e.freePreview).length,
    collections: collections.filter((c) => perColl.has(c.id)).map((c) => ({ id: c.id, title: c.title, ...perColl.get(c.id)! })),
    unassigned,
    inProgress,
  };
}
