// Single source of truth for date/time DISPLAY across the web app.
//
// Every formatter here is pinned to the national timezone (APP_TIMEZONE) so that
// every user — regardless of their browser/OS timezone — sees identical exam
// deadlines, schedules, tournament windows, etc. This is intentional: the system
// runs nationally and absolute time markers (exam close, submission deadline)
// must read the same for everyone in a shared room.
//
// To switch to per-user timezones later, change resolveTimeZone() in ONE place
// to read the timezone from the session/user (the User.timezone column already
// exists) instead of returning the constant. Every call site flows through here.
//
// NOTE: only use these for DATE values. Number formatting (e.g. xp.toLocaleString)
// is unrelated and must NOT be routed through this module.

export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";
export const APP_LOCALE = "vi-VN";

type DateInput = Date | string | number;

function resolveTimeZone(): string {
  // Single switch point: return a per-user tz here to go multi-timezone later.
  return APP_TIMEZONE;
}

function toDate(v: DateInput): Date {
  return v instanceof Date ? v : new Date(v);
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

/** 20/05/2026 */
export function formatDate(v: DateInput, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...DATE_OPTS,
    ...opts,
    timeZone: resolveTimeZone(),
  }).format(toDate(v));
}

/** 14:30 */
export function formatTime(v: DateInput, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...TIME_OPTS,
    ...opts,
    timeZone: resolveTimeZone(),
  }).format(toDate(v));
}

/** 20/05/2026 14:30 */
export function formatDateTime(v: DateInput, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...DATE_OPTS,
    ...TIME_OPTS,
    ...opts,
    timeZone: resolveTimeZone(),
  }).format(toDate(v));
}

/**
 * Escape hatch for custom option sets (weekday, month names, seconds, …).
 * Always injects the app timezone; callers only pass the formatting shape.
 */
export function formatVN(v: DateInput, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...opts,
    timeZone: resolveTimeZone(),
  }).format(toDate(v));
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
  ["second", 1000],
];

/** "2 giờ nữa" / "3 ngày trước" — timezone-independent (pure elapsed delta). */
export function formatRelative(v: DateInput, now: DateInput = new Date()): string {
  const diff = toDate(v).getTime() - toDate(now).getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(APP_LOCALE.split("-")[0], { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "";
}


// ── Ô nhập ngày giờ (<input type="datetime-local">) ─────────────────────────────
// Toàn hệ thống cố định giờ Việt Nam (xem đầu file). Ô datetime-local không mang múi giờ,
// nên PHẢI đổi qua lại bằng đúng múi giờ này; nếu dùng giờ trình duyệt hoặc cắt chuỗi ISO
// (UTC) thì giờ hiển thị lệch so với giờ đã lưu.
// Việt Nam không có giờ mùa hè nên độ lệch cố định +07:00.

const VN_OFFSET = "+07:00";

/** ISO/Date → "YYYY-MM-DDTHH:mm" theo giờ Việt Nam, để đổ vào ô datetime-local. */
export function toDateTimeInputValue(v: DateInput): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(v));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DDTHH:mm" (giờ Việt Nam) → ISO UTC để gửi lên API. Rỗng/sai định dạng → null. */
export function fromDateTimeInputValue(s: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s}:00${VN_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
