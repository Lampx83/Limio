/**
 * CENTER C5 — phân loại việc giáo viên bắt đầu buổi, TÍNH KHI ĐỌC (không lưu cứng) để đổi quy tắc hay ngưỡng không
 * phải sửa dữ liệu. Thuần, không chạm DB. Mục đích là ĐỐI CHIẾU LỊCH DẠY để biết buổi nào cần xếp dạy bù hoặc bổ sung,
 * không phải chấm công.
 */

/** Mở nút "Bắt đầu buổi" trước giờ bắt đầu bao nhiêu phút. */
export const CHECKIN_OPEN_BEFORE_MIN = 30;
/** Ngưỡng mặc định (phút) để coi là đúng giờ / không kết thúc sớm; cấu hình theo tổ chức. */
export const DEFAULT_CHECKIN_THRESHOLD_MIN = 15;
export const CHECKIN_THRESHOLD_MIN_ALLOWED = 5;
export const CHECKIN_THRESHOLD_MAX_ALLOWED = 120;

export function checkInWindow(startsAt: Date, endsAt: Date): { opensAt: Date; closesAt: Date } {
  return { opensAt: new Date(startsAt.getTime() - CHECKIN_OPEN_BEFORE_MIN * 60_000), closesAt: endsAt };
}

export type CheckInFlag = "on_time" | "late" | "early_end" | "substitute" | "no_check_in";
/** cancelled: buổi huỷ; waiting: chưa ai bấm và chưa qua giờ kết thúc; checked_in: đã có người bấm; no_check_in: qua giờ mà không ai bấm. */
export type CheckInState = "cancelled" | "waiting" | "checked_in" | "no_check_in";

export interface ClassifyInput {
  startsAt: Date;
  endsAt: Date;
  cancelled: boolean;
  /** Giáo viên dự kiến (hoặc giáo viên phụ trách lớp khi buổi chưa gán); null = chưa xếp ai. */
  expectedTeacherId: string | null;
  checkIn: { teacherId: string; checkedInAt: Date; checkedOutAt: Date | null } | null;
  thresholdMin: number;
  now: Date;
}

export interface Classification {
  state: CheckInState;
  flags: CheckInFlag[];
  /** Phút vào lớp so với giờ bắt đầu (âm = đến sớm); null khi chưa bấm. */
  minutesAfterStart: number | null;
  /** Phút ra sớm so với giờ kết thúc (âm = ra muộn); null khi chưa có giờ ra. */
  minutesBeforeEnd: number | null;
}

export function classifyCheckIn(input: ClassifyInput): Classification {
  const none = { minutesAfterStart: null, minutesBeforeEnd: null };
  if (input.cancelled) return { state: "cancelled", flags: [], ...none };

  const ci = input.checkIn;
  if (!ci) {
    return input.now.getTime() > input.endsAt.getTime()
      ? { state: "no_check_in", flags: ["no_check_in"], ...none }
      : { state: "waiting", flags: [], ...none };
  }

  const threshold = input.thresholdMin * 60_000;
  const afterStart = ci.checkedInAt.getTime() - input.startsAt.getTime();
  const flags: CheckInFlag[] = [afterStart > threshold ? "late" : "on_time"];
  let minutesBeforeEnd: number | null = null;
  if (ci.checkedOutAt) {
    const beforeEnd = input.endsAt.getTime() - ci.checkedOutAt.getTime();
    minutesBeforeEnd = Math.round(beforeEnd / 60_000);
    if (beforeEnd > threshold) flags.push("early_end");
  }
  if (input.expectedTeacherId !== null && ci.teacherId !== input.expectedTeacherId) flags.push("substitute");
  return { state: "checked_in", flags, minutesAfterStart: Math.round(afterStart / 60_000), minutesBeforeEnd };
}
