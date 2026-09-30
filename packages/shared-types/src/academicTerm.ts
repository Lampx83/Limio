/**
 * Kỳ học của một Organization (trường) — cấu hình bởi OrgAdmin/Platform Admin,
 * dùng để hiện "đang là tuần mấy của kỳ" trên lịch của mọi tài khoản trong trường.
 *
 * Đặt ở shared-types vì lớp lưu (core-lms: kiểm tra chồng lấn) lẫn giao diện
 * (apps/web: nhãn tuần, cột tuần trong lịch tháng) cùng cần MỘT định nghĩa
 * "tuần 1 là tuần nào" — hai bản lệch nhau là loại lỗi im lặng, không ai thấy
 * cho đến khi giáo viên hỏi vì sao lịch báo sai tuần.
 *
 * Mọi hàm làm việc trên "khoá ngày" `YYYY-MM-DD` (lịch dương, không múi giờ).
 * Cố ý KHÔNG nhận Date: đổi Date → ngày phải đi qua đúng một chỗ có múi giờ
 * (apps/web/src/lib/datetime.ts, cố định giờ Việt Nam), nếu không cùng một
 * hạn nộp sẽ rơi vào hai ngày khác nhau tuỳ máy người xem.
 *
 * Quy ước tuần: T2–CN. Tuần 1 = tuần chứa ngày bắt đầu (kể cả khi kỳ bắt đầu giữa
 * tuần), nên số tuần ở nhãn và ở từng hàng của lịch tháng luôn khớp nhau.
 */

/** Trần số tuần/kỳ — 1 năm học; lớn hơn nhiều khả năng là gõ nhầm. */
export const ACADEMIC_TERM_MAX_WEEKS = 60;

export interface AcademicTermLike {
  id: string;
  name: string;
  /** `YYYY-MM-DD` — ngày bắt đầu kỳ (thường là thứ Hai). */
  startDate: string;
  weekCount: number;
}

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function keyToUtcMs(key: string): number {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`invalid_day_key: ${key}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function utcMsToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True nếu là `YYYY-MM-DD` và là ngày có thật (không phải 2026-02-31). */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
  return utcMsToKey(keyToUtcMs(value)) === value;
}

export function addDaysToKey(key: string, days: number): string {
  return utcMsToKey(keyToUtcMs(key) + days * MS_PER_DAY);
}

/** Số ngày từ a đến b (b sau a → dương). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / MS_PER_DAY);
}

/** 0 = Thứ Hai … 6 = Chủ Nhật. */
export function weekdayIndexMon0(key: string): number {
  return (new Date(keyToUtcMs(key)).getUTCDay() + 6) % 7;
}

/** Thứ Hai của tuần chứa `key`. */
export function mondayOfKey(key: string): string {
  return addDaysToKey(key, -weekdayIndexMon0(key));
}

/** Ngày đầu tiên của kỳ tính theo lịch: thứ Hai của tuần 1. */
export function termFirstDay(term: Pick<AcademicTermLike, "startDate">): string {
  return mondayOfKey(term.startDate);
}

/** Ngày cuối cùng của kỳ: Chủ Nhật của tuần cuối. */
export function termLastDay(term: Pick<AcademicTermLike, "startDate" | "weekCount">): string {
  return addDaysToKey(termFirstDay(term), term.weekCount * 7 - 1);
}

/** Hai kỳ chồng lấn nếu dùng chung dù chỉ một tuần lịch. */
export function termsOverlap(
  a: Pick<AcademicTermLike, "startDate" | "weekCount">,
  b: Pick<AcademicTermLike, "startDate" | "weekCount">,
): boolean {
  return termFirstDay(a) <= termLastDay(b) && termFirstDay(b) <= termLastDay(a);
}

/** Tuần thứ mấy của kỳ (1-based), hoặc null nếu `key` nằm ngoài kỳ. */
export function weekOfTerm(
  key: string,
  term: Pick<AcademicTermLike, "startDate" | "weekCount">,
): number | null {
  const offset = daysBetweenKeys(termFirstDay(term), key);
  if (offset < 0) return null;
  const week = Math.floor(offset / 7) + 1;
  return week <= term.weekCount ? week : null;
}

export type AcademicPosition<T extends AcademicTermLike = AcademicTermLike> =
  | { kind: "in_term"; term: T; week: number; weekCount: number }
  /** Ngoài kỳ nào, nhưng còn một kỳ sắp bắt đầu. */
  | { kind: "before_term"; term: T; daysUntilStart: number }
  /** Ngoài mọi kỳ và không có kỳ nào sắp tới. */
  | { kind: "no_term" };

/**
 * Hôm nay nằm ở đâu trong các kỳ của trường. Kỳ không chồng nhau (service chặn
 * lúc lưu) nên tối đa một kỳ khớp; nếu dữ liệu cũ vẫn chồng, kỳ bắt đầu muộn hơn thắng.
 */
export function resolveAcademicPosition<T extends AcademicTermLike>(
  todayKey: string,
  terms: readonly T[],
): AcademicPosition<T> {
  const sorted = [...terms].sort((a, b) => termFirstDay(b).localeCompare(termFirstDay(a)));
  for (const term of sorted) {
    const week = weekOfTerm(todayKey, term);
    if (week !== null) return { kind: "in_term", term, week, weekCount: term.weekCount };
  }
  const upcoming = terms
    .filter((t) => termFirstDay(t) > todayKey)
    .sort((a, b) => termFirstDay(a).localeCompare(termFirstDay(b)))[0];
  if (upcoming) {
    return {
      kind: "before_term",
      term: upcoming,
      daysUntilStart: daysBetweenKeys(todayKey, termFirstDay(upcoming)),
    };
  }
  return { kind: "no_term" };
}

/** Số tuần của kỳ chứa `key`, dùng cho cột "Tuần" của lịch tháng. */
export function weekLabelForDay<T extends AcademicTermLike>(
  key: string,
  terms: readonly T[],
): { week: number; term: T } | null {
  for (const term of terms) {
    const week = weekOfTerm(key, term);
    if (week !== null) return { week, term };
  }
  return null;
}
