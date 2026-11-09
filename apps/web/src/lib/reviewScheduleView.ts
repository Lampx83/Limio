import { formatVN } from "@/lib/datetime";

/**
 * LANG đợt 4 — phần thuần của trang "Lịch ôn tập": nhãn ngày và tổng hợp. Ngày luôn theo giờ Việt Nam (lib/datetime).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Hôm nay" / "Ngày mai" / "T4 12/11" cho ngày thứ `index` kể từ hôm nay. */
export function scheduleDayLabel(dayStart: Date | string, index: number): string {
  if (index === 0) return "Hôm nay";
  if (index === 1) return "Ngày mai";
  return formatVN(dayStart, { weekday: "short", day: "2-digit", month: "2-digit" });
}

export interface ScheduleDay {
  dayStart: string;
  count: number;
}

/** Tổng thẻ trong cả khoảng lịch. */
export function scheduleTotal(days: ScheduleDay[]): number {
  return days.reduce((n, d) => n + d.count, 0);
}

/** Số thẻ lớn nhất một ngày (để vẽ thanh tỉ lệ); tối thiểu 1 để không chia cho 0. */
export function scheduleMax(days: ScheduleDay[]): number {
  return Math.max(1, ...days.map((d) => d.count));
}

export interface PracticeReviewRow {
  examId: string;
  title: string;
  wrong: number;
}

export function practiceWrongTotal(rows: PracticeReviewRow[]): number {
  return rows.reduce((n, r) => n + r.wrong, 0);
}

/** Không còn việc nào đến hạn ở cả ba khối → trang hiện "Hôm nay bạn đã ôn xong". */
export function nothingToReview(o: { dueToday: number; practiceWrong: number; hasSuggestion: boolean }): boolean {
  return o.dueToday === 0 && o.practiceWrong === 0 && !o.hasSuggestion;
}

export const SUGGESTION_TEXT: Record<"review" | "practice" | "start", string> = {
  review: "Nên ôn lại",
  practice: "Nên luyện thêm",
  start: "Bắt đầu",
};

/** Ngày cuối của khoảng lịch (để ghi "Từ … đến …"); tiện cho test múi giờ. */
export function scheduleEnd(days: ScheduleDay[]): Date | null {
  const last = days.at(-1);
  return last ? new Date(new Date(last.dayStart).getTime() + DAY_MS - 1) : null;
}
