/**
 * Chọn những bài cần làm mới khi cập nhật khoá tại chỗ (`refresh-course.ts`): hàm thuần, có test.
 *
 * Mỗi bài có khoá "tên chương / tên bài". `--since <manifest cũ>`: chỉ bài có nội dung khác bản cũ (hoặc chưa có trong bản cũ).
 * `--only "A|B"`: chỉ bài có khoá chứa một trong các chuỗi (không phân biệt hoa thường). Cả hai cùng có thì phải thoả cả hai.
 */

export interface LessonRef<L = unknown> {
  moduleTitle: string;
  lessonTitle: string;
  spec: L;
}

export const lessonKey = (moduleTitle: string, lessonTitle: string): string => `${moduleTitle} / ${lessonTitle}`;

/** JSON ổn định (khoá đối tượng xếp theo thứ tự chữ) để so hai bản của cùng một bài. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function selectLessons<L>(refs: LessonRef<L>[], opts: { since?: Map<string, string>; only?: string[] }): LessonRef<L>[] {
  const only = (opts.only ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return refs.filter((r) => {
    const key = lessonKey(r.moduleTitle, r.lessonTitle);
    if (only.length > 0 && !only.some((o) => key.toLowerCase().includes(o))) return false;
    if (opts.since) {
      const old = opts.since.get(key);
      if (old !== undefined && old === stableStringify(r.spec)) return false;
    }
    return true;
  });
}
