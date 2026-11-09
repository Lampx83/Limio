/**
 * LANG đợt 3a — phần thuần của khung bài học Language: tách khối từ vựng sang tab riêng và đếm từ. Tách khỏi React
 * để thử được không cần dựng giao diện.
 */

export type LessonView = "lesson" | "vocab";

export function parseLessonView(raw: unknown): LessonView {
  return raw === "vocab" ? "vocab" : "lesson";
}

interface Item {
  type: string;
  payload?: unknown;
}

/** Số từ trong một khối `vocab_list` (0 nếu payload hỏng). */
export function vocabItemCount(item: Item): number {
  if (item.type !== "vocab_list") return 0;
  const items = (item.payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? items.length : 0;
}

/**
 * Chia khối của bài thành phần "Bài học" và phần "Từ vựng". Khối `vocab_list` không có từ nào bị bỏ (không có gì để
 * hiện) và không tính vào tab. `count` = tổng số từ.
 */
export function splitLessonItems<T extends Item>(items: T[]): { lesson: T[]; vocab: T[]; count: number } {
  const vocab = items.filter((i) => vocabItemCount(i) > 0);
  const lesson = items.filter((i) => i.type !== "vocab_list");
  return { lesson, vocab, count: vocab.reduce((n, i) => n + vocabItemCount(i), 0) };
}

/** Đường dẫn của một chế độ xem trong cùng bài ("Bài học" là đường dẫn gốc, không kèm tham số). */
export function lessonViewHref(slug: string, lessonId: string, view: LessonView): string {
  const base = `/learn/${slug}/lessons/${lessonId}`;
  return view === "vocab" ? `${base}?view=vocab` : base;
}
