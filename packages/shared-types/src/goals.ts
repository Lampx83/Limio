/**
 * CENTER C6 — mục tiêu học tập: khung năng lực và danh sách cấp độ chuẩn.
 *
 * Đặt ở shared-types vì cả core-lms (kiểm giá trị khi lưu), core-feedback (nhận định tiến độ) và apps/web (ô chọn)
 * đều cần, mà hai module business không được import nhau (CLAUDE.md §4.3). Chỉ hằng số và hàm thuần.
 */

export const GOAL_FRAMEWORKS = ["HSK", "IELTS", "TOEIC", "CEFR", "custom"] as const;
export type GoalFramework = (typeof GOAL_FRAMEWORKS)[number];

export const GOAL_FRAMEWORK_LABEL: Record<GoalFramework, string> = {
  HSK: "HSK (tiếng Trung)",
  IELTS: "IELTS",
  TOEIC: "TOEIC",
  CEFR: "CEFR (A1–C2)",
  custom: "Mục tiêu tự đặt",
};

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
};

/** Cấp độ chuẩn theo khung; `custom` không có danh sách (nhập nhãn tự do). */
export const GOAL_LEVELS: Record<Exclude<GoalFramework, "custom">, readonly string[]> = {
  HSK: [1, 2, 3, 4, 5, 6].map((n) => `HSK ${n}`),
  IELTS: range(4, 9, 0.5).map((n) => `IELTS ${n.toFixed(1)}`),
  TOEIC: range(400, 900, 100).map((n) => `TOEIC ${n}`),
  CEFR: ["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => `CEFR ${l}`),
};

export const GOAL_CUSTOM_LABEL_MAX = 60;
/** Số giờ học mỗi tuần hợp lệ. */
export const GOAL_HOURS_PER_WEEK_MIN = 0.5;
export const GOAL_HOURS_PER_WEEK_MAX = 60;
/** Hạn xa nhất tính từ hôm nay. */
export const GOAL_MAX_YEARS_AHEAD = 10;

export function isGoalFramework(v: unknown): v is GoalFramework {
  return typeof v === "string" && (GOAL_FRAMEWORKS as readonly string[]).includes(v);
}

export function goalLevelOptions(framework: GoalFramework): readonly string[] {
  return framework === "custom" ? [] : GOAL_LEVELS[framework];
}

/** Cấp độ có hợp lệ với khung không: khung chuẩn phải thuộc danh sách; `custom` là nhãn 1–60 ký tự. */
export function isValidGoalLevel(framework: GoalFramework, level: string): boolean {
  if (framework === "custom") {
    const t = level.trim();
    return t.length >= 1 && t.length <= GOAL_CUSTOM_LABEL_MAX;
  }
  return GOAL_LEVELS[framework].includes(level);
}

/** Nhận định tiến độ so với kế hoạch (tính khi đọc, xem quy tắc ở docs/CENTER-schedule-attendance-AC.md, C6). */
export type GoalPaceStatus = "ahead" | "on_track" | "behind" | "too_early" | "no_hours_target" | "overdue";

export const GOAL_PACE_LABEL: Record<GoalPaceStatus, string> = {
  ahead: "Đang vượt kế hoạch",
  on_track: "Đang đúng kế hoạch",
  behind: "Đang chậm so với kế hoạch",
  too_early: "Mới đặt mục tiêu, chưa đủ dữ liệu để nhận định",
  no_hours_target: "Chưa đặt số giờ học mỗi tuần nên chưa nhận định được",
  overdue: "Đã qua hạn của mục tiêu",
};

/** Ngưỡng của quy tắc nhận định: tỉ lệ giờ thực tế / giờ kỳ vọng. */
export const GOAL_PACE_AHEAD_AT = 1.15;
export const GOAL_PACE_BEHIND_BELOW = 0.8;
