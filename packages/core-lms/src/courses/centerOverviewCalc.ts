/**
 * Hàm thuần của Tổng quan trung tâm (CENTER L, docs/CENTER-dashboard-dieu-phoi-AC.md). Không đụng DB để test được từng định nghĩa.
 * Định nghĩa gốc (chuyên cần, vắng liên tiếp) ở `centerBoardCalc.ts` (L0); ở đây chỉ ghép chúng lại.
 */
import { attendanceRate, consecutiveAbsences } from "./centerBoardCalc";

/** Ngưỡng mặc định (Q3). Cấu hình theo tổ chức là L6, chưa làm: các số này là hằng cho tới khi có. */
export const OVERVIEW_DEFAULTS = {
  /** Vắng liên tiếp từ N buổi thì đưa vào danh sách liên hệ. */
  consecutiveAbsences: 2,
  /** Chuyên cần dưới mức này (0..1) là thấp. */
  lowAttendance: 0.7,
  /** Cần ít nhất ngần này lượt điểm danh mới nói chuyên cần thấp, tránh gắn cờ oan vì mẫu quá nhỏ. */
  minMarksForRate: 5,
  /** Lớp còn không quá ngần này buổi thì là "sắp kết thúc". */
  endingSoonMeetings: 3,
  /** Giờ dạy đã xếp trong 7 ngày tới vượt mức này thì là nhiều việc. */
  overloadHoursPerWeek: 20,
  /** Số ngày tính chuyên cần. */
  windowDays: 30,
} as const;

export type OverviewThresholds = { [K in keyof typeof OVERVIEW_DEFAULTS]: number };

export type AttendanceStatusValue = "present" | "late" | "absent" | "excused";

export interface AttendanceRow {
  userId: string;
  sectionId: string;
  startsAt: Date;
  status: AttendanceStatusValue;
}

export interface AtRiskStudent {
  userId: string;
  sectionId: string;
  /** Số buổi vắng liên tiếp gần nhất (L0.4). */
  consecutive: number;
  /** Chuyên cần trong cửa sổ (L0.3), null khi chưa đủ mẫu. */
  rate: number | null;
  marks: number;
  lastAbsentAt: Date | null;
  reasons: Array<"consecutive" | "low_rate">;
}

/**
 * Học viên cần liên hệ (L4.1, L4.2): MỘT dòng cho mỗi (học viên, lớp), ghi cả hai lý do nếu đủ cả hai. `rows` gồm các buổi ĐÃ DẠY,
 * dài hơn cửa sổ chuyên cần để chuỗi vắng không bị cắt ở đầu cửa sổ; chuyên cần chỉ tính từ `windowStart`.
 */
export function findAtRisk(rows: readonly AttendanceRow[], windowStart: Date, th: OverviewThresholds): AtRiskStudent[] {
  const groups = new Map<string, AttendanceRow[]>();
  for (const r of rows) {
    const k = `${r.userId}|${r.sectionId}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const out: AtRiskStudent[] = [];
  for (const g of groups.values()) {
    const consecutive = consecutiveAbsences(g);
    const inWindow = g.filter((r) => r.startsAt.getTime() >= windowStart.getTime());
    const tally = { present: 0, late: 0, absent: 0 };
    for (const r of inWindow) if (r.status !== "excused") tally[r.status]++;
    const marks = tally.present + tally.late + tally.absent;
    const rate = marks >= th.minMarksForRate ? attendanceRate(tally) : null;
    const reasons: AtRiskStudent["reasons"] = [];
    if (consecutive >= th.consecutiveAbsences) reasons.push("consecutive");
    if (rate !== null && rate < th.lowAttendance) reasons.push("low_rate");
    if (reasons.length === 0) continue;
    const absents = g.filter((r) => r.status === "absent").map((r) => r.startsAt.getTime());
    out.push({
      userId: g[0]!.userId,
      sectionId: g[0]!.sectionId,
      consecutive,
      rate,
      marks,
      lastAbsentAt: absents.length ? new Date(Math.max(...absents)) : null,
      reasons,
    });
  }
  // Nặng trước: vắng liên tiếp nhiều, rồi chuyên cần thấp.
  return out.sort((a, b) => b.consecutive - a.consecutive || (a.rate ?? 1) - (b.rate ?? 1));
}

/** Tổng giờ của các buổi (không tính buổi huỷ) có giờ bắt đầu trong [from, to), cộng theo giáo viên. */
export function hoursByTeacher(
  meetings: ReadonlyArray<{ teacherId: string | null; startsAt: Date; endsAt: Date; status: "planned" | "held" | "cancelled" }>,
  range: { from: Date; to: Date },
  only?: "planned" | "held",
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of meetings) {
    if (!m.teacherId || m.status === "cancelled") continue;
    if (only && m.status !== only) continue;
    if (m.startsAt.getTime() < range.from.getTime() || m.startsAt.getTime() >= range.to.getTime()) continue;
    out.set(m.teacherId, (out.get(m.teacherId) ?? 0) + (m.endsAt.getTime() - m.startsAt.getTime()) / 3600_000);
  }
  return out;
}

/** Lớp sắp kết thúc (L3.2): đang chạy và còn không quá `endingSoonMeetings` buổi chưa dạy. */
export function isEndingSoon(lc: { status: string; total: number; held: number }, th: OverviewThresholds): boolean {
  return lc.status === "running" && lc.total - lc.held <= th.endingSoonMeetings && lc.total - lc.held >= 0;
}

/** Chuyên cần của lớp có đủ mẫu để so với ngưỡng hay không (L3.1). */
export function classAttendance(t: { present: number; late: number; absent: number }, th: OverviewThresholds): { rate: number | null; marks: number; low: boolean } {
  const marks = t.present + t.late + t.absent;
  const rate = marks >= th.minMarksForRate ? attendanceRate(t) : null;
  return { rate, marks, low: rate !== null && rate < th.lowAttendance };
}
