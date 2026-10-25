import { prisma, type PrismaClient } from "@feedbackme/db";
import { canEditCourse } from "../courses/authz";
import { resolveCourseOwner } from "../storage/ledger";
import { LessonDeckError } from "./lessonDeck";

/**
 * Chữ của một bài học để làm NGUỒN cho AI sinh bài giảng slide (docs/tieu-chi/nghe-giang-slide.md, AC2). Giữ cấu trúc
 * (tiêu đề mục, danh sách, hàng bảng, chú thích hình) để AI chia slide theo mạch bài; bỏ hình, thẻ và mọi định dạng khác.
 */

const NAMED: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const tidy = (s: string): string =>
  s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** HTML của khối richtext → chữ có cấu trúc: "## Tiêu đề", "- ý", "ô | ô", "Hình: chú thích". */
export function lessonHtmlToText(html: string): string {
  const withMarks = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|svg|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, (_m, alt: string) => (alt.trim() ? `\n[Hình: ${alt.trim()}]\n` : ""))
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<figcaption\b[^>]*>/gi, "\nChú thích hình: ")
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, n: string) => `\n\n${"#".repeat(Math.min(4, Math.max(2, Number(n))))} `)
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|aside|article|blockquote|details|summary|ul|ol|table|figure|figcaption|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return tidy(decodeEntities(withMarks).replace(/ \|\s*\n/g, "\n").replace(/ \| $/gm, ""));
}

/** Markdown thô → chữ: giữ tiêu đề và gạch đầu dòng, bỏ ảnh, giữ chữ của liên kết, bỏ dấu nhấn. */
export function lessonMarkdownToText(md: string): string {
  return tidy(
    md
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => (alt.trim() ? `[Hình: ${alt.trim()}]` : ""))
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}(#{1,6})\s+/gm, (_m, h: string) => `\n${"#".repeat(Math.min(4, Math.max(2, h.length)))} `)
      .replace(/^\s{0,3}[*+]\s+/gm, "- ")
      .replace(/[*_`]{1,3}/g, ""),
  );
}

export interface LessonSource {
  lessonId: string;
  courseId: string;
  /** Chủ khoá — bài giảng sinh ra thuộc người này. */
  ownerId: string | null;
  title: string;
  moduleTitle: string;
  hasDeck: boolean;
  text: string;
}

/** Chữ của bài học cho người sửa được khoá. Các khối bị ẩn không được đưa vào (đó là thứ giảng viên cố ý giấu học viên). */
export async function getLessonSource(actorId: string, lessonId: string, db: PrismaClient = prisma): Promise<LessonSource> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      liveDeckId: true,
      module: { select: { title: true, courseId: true } },
      contentItems: { where: { isHidden: false, type: { in: ["richtext", "markdown"] } }, orderBy: { orderIndex: "asc" }, select: { type: true, payload: true } },
    },
  });
  if (!lesson) throw new LessonDeckError("not_found");
  const courseId = lesson.module.courseId;
  if (!(await canEditCourse(actorId, courseId, db))) throw new LessonDeckError("forbidden");

  const parts: string[] = [];
  for (const it of lesson.contentItems) {
    const p = (it.payload ?? {}) as { html?: unknown; body?: unknown };
    if (it.type === "richtext" && typeof p.html === "string") parts.push(lessonHtmlToText(p.html));
    else if (it.type === "markdown" && typeof p.body === "string") parts.push(lessonMarkdownToText(p.body));
  }
  return {
    lessonId: lesson.id,
    courseId,
    ownerId: await resolveCourseOwner(courseId, db),
    title: lesson.title,
    moduleTitle: lesson.module.title,
    hasDeck: !!lesson.liveDeckId,
    text: parts.filter(Boolean).join("\n\n"),
  };
}
