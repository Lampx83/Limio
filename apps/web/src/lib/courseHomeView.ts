/**
 * Chữ hiển thị ở trang khoá học của học viên (lộ trình), tách ra để kiểm thử được.
 *
 * Sinh viên Thực hành 1 chỉ ra những chỗ đọc là không hiểu:
 *  - "Level 1 · Newcomer — +140 → L2": tiếng Anh, có mũi tên và dấu cộng.
 *  - Nút "Tiếp tục bài gần nhất" không nói bài nào.
 *  - Bảng xếp hạng cho thấy hạng của mình nhưng không nói còn cách hạng trên bao nhiêu.
 */

const LEVEL_NAME_VI: Record<string, string> = {
  Newcomer: "Người mới",
  Engaged: "Chăm chỉ",
  Dedicated: "Tận tâm",
  Expert: "Thành thạo",
  Master: "Bậc thầy",
};

/** Tên cấp bằng tiếng Việt; tên lạ (do cấu hình thêm sau) thì giữ nguyên. */
export function levelNameVi(name: string): string {
  return LEVEL_NAME_VI[name] ?? name;
}

export function describeLevel(input: {
  level: number;
  levelName: string;
  xpToNext: number | null;
  isMaxLevel: boolean;
}): string {
  const head = `Cấp ${input.level} · ${levelNameVi(input.levelName)}`;
  if (input.isMaxLevel) return `${head} (cấp cao nhất)`;
  if (input.xpToNext === null) return head;
  return `${head}. Cần thêm ${input.xpToNext} XP để lên cấp ${input.level + 1}.`;
}

export interface LessonProgressItem {
  id: string;
  title: string;
  completed: boolean;
  locked: boolean;
}

/**
 * Bài mà nút "Tiếp tục" trỏ tới — và cũng là bài được đánh dấu trong danh sách, để hai chỗ không bao giờ
 * nói khác nhau. Bài mở gần nhất còn dở thì là bài đó ("Đang học"); đã xong thì là bài chưa học đầu tiên
 * ("Bài tiếp theo"). Trước đây nút cứ trỏ về bài mở gần nhất, nên học xong Bài 1.1 vẫn thấy
 * "Tiếp tục: Bài 1.1" ngay trên dòng "Bài 1.2 · Bài tiếp theo".
 * `lessons` theo thứ tự khoá. Học xong cả khoá thì quay về bài gần nhất (để ôn); null nếu chưa có gì.
 */
export function pickContinueLesson(
  lastLessonId: string | null,
  lessons: LessonProgressItem[],
): { id: string; title: string; kind: "current" | "next" } | null {
  const last = lastLessonId ? lessons.find((l) => l.id === lastLessonId) : undefined;
  if (last && !last.completed) return { id: last.id, title: last.title, kind: "current" };
  const next = lessons.find((l) => !l.completed && !l.locked);
  if (next) return { id: next.id, title: next.title, kind: "next" };
  return last ? { id: last.id, title: last.title, kind: "current" } : null;
}

/** Nhãn nút vào học: nói rõ bài nào. `title` rỗng thì quay về câu chung. */
export function continueButtonText(kind: "continue" | "start", title: string | null): string {
  const verb = kind === "continue" ? "Tiếp tục" : "Bắt đầu";
  return title ? `${verb}: ${title}` : kind === "continue" ? "Tiếp tục bài gần nhất" : "Bắt đầu học";
}

export function streakLabel(days: number): string {
  return `Học liên tục ${days} ngày`;
}

/**
 * Khoảng cách XP tới người ngay trên mình. Chỉ tính được khi người đó nằm trong
 * danh sách đang hiện; null nếu mình đứng đầu, hoặc không có dữ liệu để so.
 */
export function gapToNextRank(input: {
  entries: Array<{ rank: number; xp: number }>;
  me: { rank: number; xp: number } | null;
}): { aboveRank: number; gapXp: number } | null {
  const { entries, me } = input;
  if (!me || me.rank <= 1) return null;
  const above = entries.find((e) => e.rank === me.rank - 1);
  if (!above) return null;
  return { aboveRank: above.rank, gapXp: Math.max(0, above.xp - me.xp) };
}

export function gapText(gap: { aboveRank: number; gapXp: number }): string {
  if (gap.gapXp === 0) return `Bạn đang ngang điểm với hạng ${gap.aboveRank}.`;
  return `Còn cách hạng ${gap.aboveRank} ${gap.gapXp.toLocaleString("vi-VN")} XP.`;
}
