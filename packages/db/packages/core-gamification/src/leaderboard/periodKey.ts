// Ranking-board period bucketing for VN+07 (Asia/Ho_Chi_Minh).
//
// VN has no DST and a fixed +07:00 offset, so we shift UTC by 7h and
// derive bucket keys from the resulting "VN-local" calendar fields. This
// keeps the helper dependency-free and trivially reversible.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type Period = "daily" | "weekly" | "monthly" | "all_time";

function toVn(date: Date): Date {
  return new Date(date.getTime() + VN_OFFSET_MS);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// ISO week number computed against the *VN-shifted* calendar. Week starts
// Monday; week 1 is the week containing Jan 4 (ISO 8601).
function isoWeekParts(vn: Date): { year: number; week: number } {
  // Operate on the VN-shifted date as if it were UTC.
  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() || 7) - 1)) / 7);
  return { year, week };
}

export function periodKeyOf(period: Period, date: Date = new Date()): string {
  if (period === "all_time") return "all_time";
  const vn = toVn(date);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth() + 1;
  const d = vn.getUTCDate();
  if (period === "daily") return `${y}-${pad2(m)}-${pad2(d)}`;
  if (period === "monthly") return `${y}-${pad2(m)}`;
  // weekly
  const { year, week } = isoWeekParts(vn);
  return `${year}-W${pad2(week)}`;
}

// Inclusive start / exclusive end of the UTC instant range covered by a
// VN+07 bucket. Used by aggregation queries against `XpTransaction`.
export function periodRange(period: Period, date: Date = new Date()): { start: Date; end: Date } {
  if (period === "all_time") {
    return { start: new Date(0), end: new Date(8640000000000000) };
  }
  const vn = toVn(date);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  const d = vn.getUTCDate();

  let startVn: Date;
  let endVn: Date;
  if (period === "daily") {
    startVn = new Date(Date.UTC(y, m, d));
    endVn = new Date(Date.UTC(y, m, d + 1));
  } else if (period === "monthly") {
    startVn = new Date(Date.UTC(y, m, 1));
    endVn = new Date(Date.UTC(y, m + 1, 1));
  } else {
    // weekly — back up to Monday in VN local terms
    const day = vn.getUTCDay() || 7; // Sun=7
    startVn = new Date(Date.UTC(y, m, d - (day - 1)));
    endVn = new Date(startVn.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  // Convert VN-local boundary back to actual UTC instant.
  return {
    start: new Date(startVn.getTime() - VN_OFFSET_MS),
    end: new Date(endVn.getTime() - VN_OFFSET_MS),
  };
}
