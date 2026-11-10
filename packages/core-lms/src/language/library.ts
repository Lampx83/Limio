import { prisma, type Prisma, type PrismaClient } from "@feedbackme/db";
import {
  CEFR_LEVELS,
  LIBRARY_FOCUS_MAX,
  LIBRARY_FOCUS_TAGS,
  LIBRARY_TEXT_MAX,
  LearningEventType,
  isLibraryFocusTag,
  levelBandsOverlap,
  parseLevelBand,
  type LibraryFocusTag,
} from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";
import { getCourseProgress } from "../learning/progress";
import { CourseAuthzError, isCourseOwner } from "../courses/authz";
import { CourseError } from "../courses/courses";

/**
 * LANG đợt 2 — Thư viện giáo trình (docs/tieu-chi/limio-language-hoc-vien-dot-2.md).
 * Thư viện chỉ liệt kê khoá `published`, `inLibrary` và `enrollMode = open`. Thẻ KHÔNG cấp quyền học: ghi danh,
 * mua, nhập mã vẫn đi qua `/catalog/[slug]` như cũ.
 */

export const LIBRARY_PAGE_SIZE = 12;

// ── Thông tin thư viện của khoá (giảng viên đặt) ───────────────────────────

export interface LibraryMeta {
  inLibrary: boolean;
  publisher: string | null;
  authors: string | null;
  edition: string | null;
  levelBand: string | null;
  focusTags: LibraryFocusTag[];
}

export interface LibraryMetaInput {
  inLibrary?: unknown;
  publisher?: unknown;
  authors?: unknown;
  edition?: unknown;
  levelBand?: unknown;
  focusTags?: unknown;
}

function fail(details: Record<string, string>): never {
  throw new CourseError("validation_failed", details);
}

function cleanText(v: unknown, field: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") fail({ [field]: "phải là chuỗi" });
  const t = v.trim();
  if (t === "") return null;
  if (t.length > LIBRARY_TEXT_MAX) fail({ [field]: `tối đa ${LIBRARY_TEXT_MAX} ký tự` });
  return t;
}

/**
 * Chuẩn hoá và kiểm đầu vào. Hàm thuần; trường vắng mặt (`undefined`) giữ nguyên, `null`/chuỗi rỗng là xoá.
 * Ném `CourseError("validation_failed")` khi sai.
 */
export function normalizeLibraryMeta(input: LibraryMetaInput): Partial<LibraryMeta> {
  const out: Partial<LibraryMeta> = {};
  if (input.inLibrary !== undefined) {
    if (typeof input.inLibrary !== "boolean") fail({ inLibrary: "phải là true/false" });
    out.inLibrary = input.inLibrary;
  }
  for (const f of ["publisher", "authors", "edition"] as const) {
    const v = cleanText(input[f], f);
    if (v !== undefined) out[f] = v;
  }
  if (input.levelBand !== undefined) {
    if (input.levelBand === null || input.levelBand === "") out.levelBand = null;
    else if (typeof input.levelBand !== "string" || !parseLevelBand(input.levelBand.trim())) {
      fail({ levelBand: "dạng A2 hoặc B1-B2 (mức đầu không cao hơn mức sau)" });
    } else out.levelBand = input.levelBand.trim();
  }
  if (input.focusTags !== undefined) {
    if (!Array.isArray(input.focusTags)) fail({ focusTags: "phải là danh sách" });
    const tags = input.focusTags;
    if (tags.length > LIBRARY_FOCUS_MAX) fail({ focusTags: `tối đa ${LIBRARY_FOCUS_MAX} kỹ năng` });
    if (!tags.every(isLibraryFocusTag)) fail({ focusTags: `chỉ nhận ${LIBRARY_FOCUS_TAGS.join(", ")}` });
    if (new Set(tags).size !== tags.length) fail({ focusTags: "không được trùng" });
    out.focusTags = tags as LibraryFocusTag[];
  }
  return out;
}

const META_SELECT = {
  id: true,
  status: true,
  enrollMode: true,
  inLibrary: true,
  publisher: true,
  authors: true,
  edition: true,
  levelBand: true,
  focusTags: true,
} as const;

function toMeta(c: {
  inLibrary: boolean;
  publisher: string | null;
  authors: string | null;
  edition: string | null;
  levelBand: string | null;
  focusTags: string[];
}): LibraryMeta {
  return {
    inLibrary: c.inLibrary,
    publisher: c.publisher,
    authors: c.authors,
    edition: c.edition,
    levelBand: c.levelBand,
    focusTags: c.focusTags.filter(isLibraryFocusTag),
  };
}

export interface CourseLibraryState extends LibraryMeta {
  /** Có thật sự hiện ở thư viện không: đã xuất bản và mở ghi danh tự do. */
  listed: boolean;
  /** Vì sao chưa hiện dù đã bật (để giao diện nói rõ). */
  hiddenReason: "not_published" | "invite_only" | null;
}

function stateOf(c: Parameters<typeof toMeta>[0] & { status: string; enrollMode: string }): CourseLibraryState {
  const hiddenReason = c.status !== "published" ? "not_published" : c.enrollMode !== "open" ? "invite_only" : null;
  return { ...toMeta(c), listed: c.inLibrary && hiddenReason === null, hiddenReason };
}

export async function getCourseLibraryState(courseId: string, db: DbClient = prisma): Promise<CourseLibraryState | null> {
  const c = await db.course.findUnique({ where: { id: courseId }, select: META_SELECT });
  return c ? stateOf(c) : null;
}

/**
 * Giảng viên đặt thông tin thư viện cho khoá. Chỉ chủ khoá và admin (cùng triết lý với giá và học liệu bản
 * quyền: đồng giảng viên sửa nội dung nhưng không đổi cách khoá được bán/hiển thị). Khoá chỉ mời bằng link
 * không bật được (không tự ghi danh được thì đưa vào thư viện là mục chết).
 */
export async function updateCourseLibraryMeta(
  userId: string,
  courseId: string,
  input: LibraryMetaInput,
  db: PrismaClient = prisma,
): Promise<CourseLibraryState> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: META_SELECT });
  if (!course) throw new CourseAuthzError("not_found");
  if (!(await isCourseOwner(userId, courseId, db))) throw new CourseAuthzError("forbidden");

  const patch = normalizeLibraryMeta(input);
  if (patch.inLibrary === true && course.enrollMode !== "open") {
    fail({ inLibrary: "khoá chỉ vào bằng link mời không đưa vào thư viện được" });
  }

  const changedListing = patch.inLibrary !== undefined && patch.inLibrary !== course.inLibrary;
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.course.update({ where: { id: courseId }, data: patch, select: META_SELECT });
    if (changedListing) {
      const type = patch.inLibrary ? LearningEventType.LibraryCourseListed : LearningEventType.LibraryCourseUnlisted;
      await logAudit({ action: type, actorUserId: userId, payload: { courseId } }, tx);
      await emitEvent(userId, type, { courseId }, { courseId }, tx);
    }
    return row;
  });
  return stateOf(updated);
}

// ── Lưu / bỏ lưu ───────────────────────────────────────────────────────────

function listedWhere(): Prisma.CourseWhereInput {
  return { status: "published", inLibrary: true, enrollMode: "open" };
}

/**
 * Lưu một giáo trình. Idempotent: lưu lại thì không nhân đôi và không ghi sự kiện lần hai. Khoá không nằm trong
 * thư viện (nháp, ngoài thư viện, chỉ mời) → `not_found`, không tạo hàng.
 */
export async function saveLibraryCourse(userId: string, courseId: string, db: PrismaClient = prisma): Promise<{ saved: true }> {
  const ok = await db.course.findFirst({ where: { id: courseId, ...listedWhere() }, select: { id: true } });
  if (!ok) throw new CourseError("not_found");
  await db.$transaction(async (tx) => {
    const r = await tx.courseSave.createMany({ data: [{ userId, courseId }], skipDuplicates: true });
    if (r.count > 0) await emitEvent(userId, LearningEventType.LibraryCourseSaved, { courseId }, { courseId }, tx);
  });
  return { saved: true };
}

/** Bỏ lưu. Idempotent; được phép cả khi khoá đã rời thư viện (để dọn mục đã lưu). */
export async function unsaveLibraryCourse(userId: string, courseId: string, db: PrismaClient = prisma): Promise<{ saved: false }> {
  await db.$transaction(async (tx) => {
    const r = await tx.courseSave.deleteMany({ where: { userId, courseId } });
    if (r.count > 0) await emitEvent(userId, LearningEventType.LibraryCourseUnsaved, { courseId }, { courseId }, tx);
  });
  return { saved: false };
}

// ── Truy vấn thư viện cho học viên ─────────────────────────────────────────

export type LibraryTab = "all" | "saved";
export type LibrarySort = "relevant" | "newest" | "name";

export interface LibraryQuery {
  q: string;
  publisher: string;
  level: string;
  focus: LibraryFocusTag | "";
  tab: LibraryTab;
  sort: LibrarySort;
  page: number;
}

/** Đọc tham số URL thành truy vấn hợp lệ; giá trị lạ bị bỏ (không ném lỗi). */
export function parseLibraryQuery(raw: Record<string, unknown>): LibraryQuery {
  const str = (k: string, max = 100) => (typeof raw[k] === "string" ? (raw[k] as string).trim().slice(0, max) : "");
  const level = str("level", 10);
  const focus = str("focus", 20);
  const sort = str("sort", 12);
  const page = Number.parseInt(str("page", 6), 10);
  return {
    q: str("q"),
    publisher: str("publisher", LIBRARY_TEXT_MAX),
    level: parseLevelBand(level) ? level : "",
    focus: isLibraryFocusTag(focus) ? focus : "",
    tab: str("tab", 6) === "saved" ? "saved" : "all",
    sort: sort === "newest" || sort === "name" ? sort : "relevant",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}

/** Mọi chuỗi trình độ hợp lệ (mức đơn hoặc khoảng) giao với `level` — dùng để lọc trong DB bằng `in`. */
export function levelBandsOverlapping(level: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < CEFR_LEVELS.length; i++) {
    for (let j = i; j < CEFR_LEVELS.length; j++) {
      const band = i === j ? CEFR_LEVELS[i]! : `${CEFR_LEVELS[i]}-${CEFR_LEVELS[j]}`;
      if (levelBandsOverlap(band, level)) out.push(band);
    }
  }
  return out;
}

/** Mô tả khoá thành đoạn chữ thuần ngắn: bỏ thẻ HTML, ký hiệu Markdown phổ biến, gộp khoảng trắng. */
export function plainExcerpt(text: string, max = 160): string {
  const t = text
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]+/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export interface LibraryCard {
  id: string;
  slug: string;
  title: string;
  publisher: string | null;
  authors: string | null;
  edition: string | null;
  levelBand: string | null;
  coverUrl: string | null;
  excerpt: string;
  focusTags: LibraryFocusTag[];
  saved: boolean;
  /** Ghi danh còn hiệu lực (cùng định nghĩa với `isUserEnrolled`). */
  enrolled: boolean;
  priceCents: number | null;
  currency: string;
  cheapestPlan: { priceCents: number; currency: string } | null;
  /** Bài xem thử đầu tiên (hiển thị, `previewable`); null = không có → ẩn nút Preview. */
  previewLessonId: string | null;
}

export interface LibraryInProgress {
  card: LibraryCard;
  lessonId: string;
  lessonTitle: string;
  unitTitle: string;
  unitDone: number;
  unitTotal: number;
  completionPct: number;
}

export interface LibraryPage {
  query: LibraryQuery;
  /** Khối "Đang học" — chỉ khi không có tìm kiếm/lọc/tab Đã lưu và đang ở trang 1. */
  inProgress: LibraryInProgress | null;
  cards: LibraryCard[];
  /** Số khoá khớp bộ lọc hiện tại (kể cả thẻ Đang học nếu nó khớp). */
  matching: number;
  totalAll: number;
  savedCount: number;
  pageCount: number;
  facets: { publishers: string[]; levels: string[]; focus: LibraryFocusTag[] };
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  publisher: true,
  authors: true,
  edition: true,
  levelBand: true,
  coverUrl: true,
  focusTags: true,
  priceCents: true,
  currency: true,
  accessPlans: {
    where: { isActive: true },
    orderBy: { priceCents: "asc" },
    take: 1,
    select: { priceCents: true, currency: true },
  },
} as const;

type CardRow = Prisma.CourseGetPayload<{ select: typeof CARD_SELECT }>;

function toCard(
  c: CardRow,
  ctx: { saved: Set<string>; enrolled: Set<string>; preview: Map<string, string> },
): LibraryCard {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    publisher: c.publisher,
    authors: c.authors,
    edition: c.edition,
    levelBand: c.levelBand,
    coverUrl: c.coverUrl,
    excerpt: plainExcerpt(c.description),
    focusTags: c.focusTags.filter(isLibraryFocusTag),
    saved: ctx.saved.has(c.id),
    enrolled: ctx.enrolled.has(c.id),
    priceCents: c.priceCents,
    currency: c.currency,
    cheapestPlan: c.accessPlans[0] ?? null,
    previewLessonId: ctx.preview.get(c.id) ?? null,
  };
}

/** Khoá nào trong `courseIds` người này đang có quyền học (cùng luật với `isUserEnrolled`, gộp một truy vấn). */
async function enrolledSet(userId: string, courseIds: string[], db: PrismaClient, now: Date): Promise<Set<string>> {
  if (courseIds.length === 0) return new Set();
  const rows = await db.enrollment.findMany({
    where: {
      userId,
      courseId: { in: courseIds },
      status: { notIn: ["dropped", "refunded", "expired"] },
      OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }],
    },
    select: { courseId: true },
  });
  return new Set(rows.map((r) => r.courseId));
}

/** Bài xem thử hiển thị đầu tiên của mỗi khoá (theo thứ tự module rồi bài). */
async function previewLessons(courseIds: string[], db: PrismaClient): Promise<Map<string, string>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db.lesson.findMany({
    where: { previewable: true, isHidden: false, module: { courseId: { in: courseIds }, isHidden: false } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true, module: { select: { courseId: true } } },
  });
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(r.module.courseId)) out.set(r.module.courseId, r.id);
  return out;
}

/** Khoá đang học dở trong thư viện: ghi danh còn hiệu lực, có bài mở gần nhất, chưa học hết bài đang mở. */
async function findInProgress(
  userId: string,
  db: PrismaClient,
  now: Date,
): Promise<{ courseId: string; lessonId: string; lessonTitle: string; unitTitle: string; unitDone: number; unitTotal: number; completionPct: number } | null> {
  const enr = await db.enrollment.findMany({
    where: {
      userId,
      status: "active",
      lastLessonId: { not: null },
      course: listedWhere(),
      OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }],
    },
    orderBy: { enrolledAt: "desc" },
    take: 5,
    select: { courseId: true, lastLessonId: true },
  });
  for (const e of enr) {
    const progress = await getCourseProgress(userId, e.courseId, db);
    const flat = progress.modules.flatMap((m) => m.lessons.map((l) => ({ l, m })));
    const resume = flat.find((x) => x.l.id === e.lastLessonId && !x.l.completed && !x.l.locked);
    const target = resume ?? flat.find((x) => !x.l.completed && !x.l.locked);
    if (!target) continue;
    const unit = target.m.lessons;
    return {
      courseId: e.courseId,
      lessonId: target.l.id,
      lessonTitle: target.l.title,
      unitTitle: target.m.title,
      unitDone: unit.filter((l) => l.completed).length,
      unitTotal: unit.length,
      completionPct: progress.courseCompletionPct,
    };
  }
  return null;
}

/**
 * Trang Thư viện giáo trình. Chỉ ĐỌC. Dữ liệu "Đã lưu" và "Đang học" chỉ của chính `userId`.
 * Sắp xếp "Phù hợp nhất" = đã lưu trước → cùng trình độ với khoá đang học → xuất bản gần nhất; không dùng mục tiêu.
 * Lọc và đếm làm trong DB; chỉ lấy khoá của trang hiện tại ở dạng đầy đủ (mô tả, giá, bài xem thử).
 */
export async function listLibrary(
  userId: string,
  rawQuery: Record<string, unknown>,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<LibraryPage> {
  const query = parseLibraryQuery(rawQuery);
  const base = listedWhere();

  const [facetRows, savedRows] = await Promise.all([
    db.course.findMany({ where: base, select: { publisher: true, levelBand: true, focusTags: true } }),
    db.courseSave.findMany({ where: { userId, course: base }, select: { courseId: true } }),
  ]);
  const saved = new Set(savedRows.map((r) => r.courseId));
  const publishers = [...new Set(facetRows.map((r) => r.publisher).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "vi"));
  const levels = [...new Set(facetRows.map((r) => r.levelBand).filter((v): v is string => !!v))];
  const focus = LIBRARY_FOCUS_TAGS.filter((t) => facetRows.some((r) => r.focusTags.includes(t)));

  const hasFilter = !!(query.q || query.publisher || query.level || query.focus);
  const showFeatured = !hasFilter && query.tab === "all" && query.page === 1;
  const inProgressRaw = await findInProgress(userId, db, now);

  const where: Prisma.CourseWhereInput = {
    ...base,
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { authors: { contains: query.q, mode: "insensitive" } },
            { publisher: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.publisher ? { publisher: query.publisher } : {}),
    ...(query.focus ? { focusTags: { has: query.focus } } : {}),
    ...(query.level ? { levelBand: { in: levelBandsOverlapping(query.level) } } : {}),
    ...(query.tab === "saved" ? { id: { in: [...saved] } } : {}),
  };

  const keyRows = await db.course.findMany({ where, select: { id: true, title: true, levelBand: true, publishedAt: true } });
  const matching = keyRows.length;

  const inProgressLevel = inProgressRaw
    ? ((await db.course.findUnique({ where: { id: inProgressRaw.courseId }, select: { levelBand: true } }))?.levelBand ?? null)
    : null;
  const ts = (d: Date | null) => (d ? d.getTime() : 0);
  const rows = keyRows
    .filter((r) => !(showFeatured && inProgressRaw && r.id === inProgressRaw.courseId))
    .sort((a, b) => {
      if (query.sort === "name") return a.title.localeCompare(b.title, "vi");
      if (query.sort === "newest") return ts(b.publishedAt) - ts(a.publishedAt) || a.id.localeCompare(b.id);
      const sa = saved.has(a.id) ? 1 : 0;
      const sb = saved.has(b.id) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      const la = inProgressLevel && a.levelBand && levelBandsOverlap(a.levelBand, inProgressLevel) ? 1 : 0;
      const lb = inProgressLevel && b.levelBand && levelBandsOverlap(b.levelBand, inProgressLevel) ? 1 : 0;
      if (la !== lb) return lb - la;
      return ts(b.publishedAt) - ts(a.publishedAt) || a.id.localeCompare(b.id);
    });

  const pageCount = Math.max(1, Math.ceil(rows.length / LIBRARY_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const pageIds = rows.slice((page - 1) * LIBRARY_PAGE_SIZE, page * LIBRARY_PAGE_SIZE).map((r) => r.id);

  const detailIds = showFeatured && inProgressRaw ? [...pageIds, inProgressRaw.courseId] : pageIds;
  const [courses, enrolled, preview] = await Promise.all([
    detailIds.length ? db.course.findMany({ where: { id: { in: detailIds } }, select: CARD_SELECT }) : Promise.resolve([] as CardRow[]),
    enrolledSet(userId, detailIds, db, now),
    previewLessons(detailIds, db),
  ]);
  const ctx = { saved, enrolled, preview };
  const byId = new Map(courses.map((c) => [c.id, c]));
  const cards = pageIds.flatMap((id) => (byId.has(id) ? [toCard(byId.get(id)!, ctx)] : []));

  let inProgress: LibraryInProgress | null = null;
  if (showFeatured && inProgressRaw && byId.has(inProgressRaw.courseId)) {
    inProgress = {
      card: toCard(byId.get(inProgressRaw.courseId)!, ctx),
      lessonId: inProgressRaw.lessonId,
      lessonTitle: inProgressRaw.lessonTitle,
      unitTitle: inProgressRaw.unitTitle,
      unitDone: inProgressRaw.unitDone,
      unitTotal: inProgressRaw.unitTotal,
      completionPct: inProgressRaw.completionPct,
    };
  }

  return {
    query: { ...query, page },
    inProgress,
    cards,
    matching,
    totalAll: facetRows.length,
    savedCount: saved.size,
    pageCount,
    facets: { publishers, levels, focus },
  };
}
