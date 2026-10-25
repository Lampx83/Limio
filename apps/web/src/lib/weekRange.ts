/**
 * Tuần (thứ hai → chủ nhật, theo giờ Việt Nam) cho các trang đối chiếu lịch dạy. Ngày là chuỗi YYYY-MM-DD.
 */
const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3600_000;

const parse = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parse(v)) && fmt(parse(v)) === v;
}

/** Hôm nay theo giờ Việt Nam. */
export function todayVN(now: Date = new Date()): string {
  return fmt(now.getTime() + VN_OFFSET_MS - ((now.getTime() + VN_OFFSET_MS) % DAY_MS));
}

/** Thứ hai của tuần chứa `day`. */
export function weekStart(day: string): string {
  const ms = parse(day);
  const isoWeekday = ((new Date(ms).getUTCDay() + 6) % 7) + 1; // 1 = thứ hai … 7 = chủ nhật
  return fmt(ms - (isoWeekday - 1) * DAY_MS);
}

export interface Week {
  from: string;
  to: string;
  prev: string;
  next: string;
}

/** Tuần chứa `raw` (hoặc hôm nay nếu `raw` rỗng hay sai dạng): từ thứ hai tới chủ nhật, kèm thứ hai của tuần trước và sau. */
export function resolveWeek(raw: string | string[] | undefined, now: Date = new Date()): Week {
  const day = typeof raw === "string" && isDayKey(raw) ? raw : todayVN(now);
  const from = weekStart(day);
  const ms = parse(from);
  return { from, to: fmt(ms + 6 * DAY_MS), prev: fmt(ms - 7 * DAY_MS), next: fmt(ms + 7 * DAY_MS) };
}
