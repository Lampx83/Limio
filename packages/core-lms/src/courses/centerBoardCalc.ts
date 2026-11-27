/**
 * CENTER L0 — định nghĩa dùng chung cho Bảng điều phối và Dashboard quản trị trung tâm
 * (docs/CENTER-dashboard-dieu-phoi-AC.md, mục L0). THUẦN, không chạm DB: dashboard và bảng điều phối đếm cùng một cách
 * vì cùng gọi các hàm này, nên bấm một con số trên dashboard tới đúng các khối trên bảng.
 */
import { CHECKIN_OPEN_BEFORE_MIN } from "./teacherCheckInCalc";

export type StoredMeetingStatus = "planned" | "held" | "cancelled";

/** Trạng thái hiển thị của một buổi (L0.1): huỷ › đã dạy › đang diễn ra › quá giờ chưa kết thúc › sắp tới. */
export type MeetingDisplayState = "cancelled" | "held" | "live" | "overdue" | "upcoming";

export function meetingDisplayState(i: { status: StoredMeetingStatus; startsAt: Date; endsAt: Date; now: Date }): MeetingDisplayState {
  if (i.status === "cancelled") return "cancelled";
  if (i.status === "held") return "held";
  const t = i.now.getTime();
  if (t >= i.startsAt.getTime() && t < i.endsAt.getTime()) return "live";
  if (t >= i.endsAt.getTime()) return "overdue";
  return "upcoming";
}

/** Cờ cần chú ý của một buổi (L0.2); một buổi có thể có nhiều cờ. */
export type BoardFlag = "no_teacher" | "no_checkin" | "late" | "substitute" | "no_attendance" | "room_clash" | "teacher_clash";

export interface FlagInput {
  state: MeetingDisplayState;
  /** Có giáo viên dự kiến (hoặc giáo viên phụ trách lớp) hay không. */
  hasExpectedTeacher: boolean;
  /** Đã có người check-in. */
  checkedIn: boolean;
  /** Cờ phân loại check-in của C5.4 (late/substitute…). */
  checkInFlags: ReadonlyArray<string>;
  /** Buổi đã kết thúc (có closedAt) mà chưa có dòng điểm danh nào (C5.5). */
  attendanceMissing: boolean;
  startsAt: Date;
  thresholdMin: number;
  now: Date;
  clash: { room: boolean; teacher: boolean };
}

export function meetingFlags(i: FlagInput): BoardFlag[] {
  if (i.state === "cancelled") return [];
  const out: BoardFlag[] = [];
  // Chưa có người dạy: chỉ đáng báo khi buổi còn có thể xếp (chưa dạy xong).
  if (!i.hasExpectedTeacher && i.state !== "held") out.push("no_teacher");
  // Đã qua giờ bắt đầu + ngưỡng mà chưa ai bấm "Bắt đầu buổi": đang diễn ra, quá giờ, và cả buổi đã kết thúc mà không ai bấm (khớp "Không check-in" của
  // đối chiếu C5.4, nơi buổi đã dạy mà không có dòng check-in vẫn bị đếm).
  if (!i.checkedIn && i.state !== "upcoming" && i.hasExpectedTeacher && i.now.getTime() > i.startsAt.getTime() + i.thresholdMin * 60_000) out.push("no_checkin");
  if (i.checkInFlags.includes("late")) out.push("late");
  if (i.checkInFlags.includes("substitute")) out.push("substitute");
  if (i.attendanceMissing) out.push("no_attendance");
  if (i.clash.room) out.push("room_clash");
  if (i.clash.teacher) out.push("teacher_clash");
  return out;
}

/** Khoá so sánh tên phòng (Q2): bỏ khoảng trắng thừa, không phân biệt hoa thường. null/rỗng = chưa xếp phòng. */
export function roomKey(room: string | null | undefined): string | null {
  const k = (room ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return k === "" ? null : k;
}

export interface ClashInput {
  id: string;
  startsAt: Date;
  endsAt: Date;
  room: string | null;
  teacherId: string | null;
  cancelled: boolean;
}

/**
 * Trùng phòng / trùng giáo viên (L0.2, M1.5): hai buổi KHÔNG huỷ có khoảng giờ giao nhau (chạm đầu mút không tính) cùng phòng
 * hoặc cùng giáo viên. Cùng lớp thì không tự trùng nhau vì buổi của một lớp không chồng giờ (nếu có thì vẫn báo, đó là lỗi lịch).
 */
export function detectClashes(items: readonly ClashInput[]): Map<string, { room: boolean; teacher: boolean }> {
  const out = new Map<string, { room: boolean; teacher: boolean }>();
  for (const it of items) out.set(it.id, { room: false, teacher: false });
  const live = items.filter((i) => !i.cancelled).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j]!;
      if (b.startsAt.getTime() >= a.endsAt.getTime()) break; // đã sắp theo giờ bắt đầu: các buổi sau không còn giao với a
      const ra = roomKey(a.room);
      if (ra !== null && ra === roomKey(b.room)) {
        out.get(a.id)!.room = true;
        out.get(b.id)!.room = true;
      }
      if (a.teacherId !== null && a.teacherId === b.teacherId) {
        out.get(a.id)!.teacher = true;
        out.get(b.id)!.teacher = true;
      }
    }
  }
  return out;
}

/**
 * Trình độ của khoá để gom hàng ở Bảng điều phối (mỗi dòng là một trình độ, vd "HSK 3"). Khoá chưa có trường trình độ riêng nên rút theo thứ tự:
 * trình độ đầu ra của giáo trình gốc (`CoursePack.outcomeLevel`) › "HSK n" hoặc "Cấp n" trong tên khoá (HSK 3.0 không phải cấp 3.0) › mức CEFR
 * (`Course.levelBand`, vd "A2", "B1-B2") › null (chưa rõ). Chuỗi trả về đã chuẩn hoá khoảng trắng để cùng trình độ luôn gom chung một hàng.
 */
export function deriveCourseLevel(i: { packLevel?: string | null; title: string; levelBand?: string | null }): string | null {
  const clean = (v: string | null | undefined) => (v ?? "").trim().replace(/\s+/g, " ");
  const pack = clean(i.packLevel);
  if (pack) return pack;
  const t = i.title ?? "";
  if (/HSK/i.test(t)) {
    const cap = /C[ấa]p\s*([1-9])(?!\d)/i.exec(t);
    if (cap) return `HSK ${cap[1]}`;
    const m = /HSK\s*-?\s*([1-9])(?![\d.])/i.exec(t);
    if (m) return `HSK ${m[1]}`;
  }
  const band = clean(i.levelBand);
  return band || null;
}

/** Chuyên cần (L0.3): (có + trễ) ÷ (có + trễ + vắng); vắng có phép KHÔNG vào mẫu số. null khi chưa có buổi nào tính được. */
export function attendanceRate(c: { present: number; late: number; absent: number }): number | null {
  const denom = c.present + c.late + c.absent;
  return denom === 0 ? null : (c.present + c.late) / denom;
}

/**
 * Vắng liên tiếp (L0.4): đếm các buổi đã dạy gần nhất của học viên ở MỘT lớp, từ mới về cũ, cho tới khi gặp buổi không vắng.
 * `excused` bị bỏ qua (không cắt chuỗi, không cộng vào). Đầu vào là các dòng điểm danh của buổi đã dạy, không cần đã sắp.
 */
export function consecutiveAbsences(records: ReadonlyArray<{ startsAt: Date; status: "present" | "late" | "absent" | "excused" }>): number {
  const sorted = [...records].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  let n = 0;
  for (const r of sorted) {
    if (r.status === "excused") continue;
    if (r.status === "absent") n++;
    else break;
  }
  return n;
}

export type ClassLifecycleStatus = "no_schedule" | "planned" | "running" | "finished";

export interface ClassLifecycle {
  status: ClassLifecycleStatus;
  /** Buổi đầu / buổi cuối (không tính buổi huỷ, có tính buổi dạy bù); null khi chưa đặt lịch. */
  start: Date | null;
  end: Date | null;
  held: number;
  total: number;
}

/** Vòng đời lớp (L0.5): start = giờ bắt đầu buổi đầu, end = giờ kết thúc buổi cuối; tiến độ = đã dạy ÷ tổng (không tính huỷ). */
export function classLifecycle(meetings: ReadonlyArray<{ startsAt: Date; endsAt: Date; status: StoredMeetingStatus }>, now: Date): ClassLifecycle {
  const real = meetings.filter((m) => m.status !== "cancelled");
  if (real.length === 0) return { status: "no_schedule", start: null, end: null, held: 0, total: 0 };
  const start = new Date(Math.min(...real.map((m) => m.startsAt.getTime())));
  const end = new Date(Math.max(...real.map((m) => m.endsAt.getTime())));
  const held = real.filter((m) => m.status === "held").length;
  const status: ClassLifecycleStatus = held === real.length ? "finished" : now.getTime() < start.getTime() ? "planned" : "running";
  return { status, start, end, held, total: real.length };
}

/** Phút trước giờ bắt đầu mà nút "Bắt đầu buổi" mở (nhắc lại hằng của C5 để giao diện không phải import hai nơi). */
export const BOARD_CHECKIN_OPEN_BEFORE_MIN = CHECKIN_OPEN_BEFORE_MIN;
