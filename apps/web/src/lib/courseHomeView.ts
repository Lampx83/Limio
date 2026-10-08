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
