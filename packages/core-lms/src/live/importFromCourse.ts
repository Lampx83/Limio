import type { LiveSlide, PrismaClient } from "@feedbackme/db";
import { canEditCourse } from "../courses/authz";
import { addLiveSlidesBulk, type CreateSlideInput } from "./decks";

/**
 * Nhập bài giảng có sẵn từ khoá học vào một LiveDeck (dạy trực tiếp).
 *
 * Phương án nhỏ nhất chạy được: mỗi bài học được chọn → 1..n slide "content"
 * (tiêu đề = tên bài, phụ đề = tên chương, gạch đầu dòng = các dòng chữ trích
 * từ khối richtext/markdown của bài). Video/PDF/file/quiz KHÔNG được nhập —
 * slide chỉ mang chữ. Chỉ ĐỌC nội dung khoá và GHI vào LiveDeck của chính
 * giảng viên; không đụng dữ liệu khoá nên không phát LearningEvent (giống các
 * thao tác soạn deck khác).
 */

export const MAX_BULLETS_PER_SLIDE = 6;
export const MAX_BULLET_CHARS = 160;
export const MAX_IMPORT_SLIDES = 60;
export const MAX_IMPORT_LESSONS = 20;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decode(s: string): string {
  return s.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > MAX_BULLET_CHARS ? t.slice(0, MAX_BULLET_CHARS - 1) + "…" : t;
}

/** HTML richtext → các dòng chữ thuần (mỗi khối p/li/heading/tr một dòng). */
export function htmlToLines(html: string): string[] {
  return decode(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map(clip)
    .filter(Boolean);
}

/** Markdown thô → các dòng chữ thuần (bỏ #, gạch đầu dòng, **, hình ảnh). */
export function markdownToLines(md: string): string[] {
  return md
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}(#{1,6}|[-*+>]|\d+[.)])\s+/, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`]{1,3}/g, ""),
    )
    .map(clip)
    .filter((l) => l && !/^[-=|:\s]+$/.test(l));
}

export interface ImportItem {
  type: string;
  payload: unknown;
}

/** Các khối của 1 bài → cấu hình slide content (đã cắt theo MAX_BULLETS_PER_SLIDE). */
export function lessonToSlides(
  lessonTitle: string,
  moduleTitle: string,
  items: ImportItem[],
): CreateSlideInput[] {
  const lines: string[] = [];
  for (const it of items) {
    const p = (it.payload ?? {}) as { html?: unknown; body?: unknown };
    if (it.type === "richtext" && typeof p.html === "string") lines.push(...htmlToLines(p.html));
    else if (it.type === "markdown" && typeof p.body === "string") lines.push(...markdownToLines(p.body));
  }
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += MAX_BULLETS_PER_SLIDE) {
    chunks.push(lines.slice(i, i + MAX_BULLETS_PER_SLIDE));
  }
  if (chunks.length === 0) chunks.push([]);
  return chunks.map((bullets, i) => ({
    type: "content" as const,
    config: {
      title: (i === 0 ? lessonTitle : `${lessonTitle} (tiếp)`).slice(0, 200),
      subtitle: moduleTitle.slice(0, 200),
      bullets,
    },
  }));
}

export async function listImportableCourses(
  userId: string,
  db: PrismaClient,
): Promise<Array<{ id: string; title: string }>> {
  const candidates = await db.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  const ok = await Promise.all(candidates.map((c) => canEditCourse(userId, c.id, db)));
  return candidates.filter((_, i) => ok[i]);
}

export async function getCourseOutlineForImport(
  userId: string,
  courseId: string,
  db: PrismaClient,
) {
  if (!(await canEditCourse(userId, courseId, db))) {
    throw new Error("Not authorized to read this course");
  }
  return db.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true },
      },
    },
  });
}

export async function importCourseLessonsIntoDeck(
  input: { deckId: string; userId: string; courseId: string; lessonIds: string[] },
  db: PrismaClient,
): Promise<LiveSlide[]> {
  const { deckId, userId, courseId } = input;
  if (!(await canEditCourse(userId, courseId, db))) {
    throw new Error("Not authorized to read this course");
  }
  const deck = await db.liveDeck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to edit this deck");
  }
  const wanted = Array.from(new Set(input.lessonIds)).slice(0, MAX_IMPORT_LESSONS);
  const lessons = await db.lesson.findMany({
    where: { id: { in: wanted }, module: { courseId } },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      module: { select: { title: true, orderIndex: true } },
      contentItems: {
        where: { isHidden: false, type: { in: ["richtext", "markdown"] } },
        orderBy: { orderIndex: "asc" },
        select: { type: true, payload: true },
      },
    },
  });
  lessons.sort(
    (a, b) => a.module.orderIndex - b.module.orderIndex || a.orderIndex - b.orderIndex,
  );
  const slides = lessons
    .flatMap((l) => lessonToSlides(l.title, l.module.title, l.contentItems))
    .slice(0, MAX_IMPORT_SLIDES);
  return addLiveSlidesBulk(deckId, userId, slides, db);
}
