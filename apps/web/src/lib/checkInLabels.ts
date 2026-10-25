import type { CheckInFlag, CheckInState } from "@feedbackme/core-lms";

/**
 * Nhãn hiển thị cho kết quả đối chiếu lịch dạy (CENTER C5.4, C5.9). Ngôn ngữ là "đối chiếu để xếp dạy bù", không phải
 * chấm công: không có từ "phạt", "vi phạm", "chấm công" ở bất kỳ nhãn nào.
 */
export const CHECKIN_FLAG_LABEL: Record<CheckInFlag, string> = {
  on_time: "Đúng giờ",
  late: "Trễ",
  early_end: "Kết thúc sớm",
  substitute: "Dạy thay",
  no_check_in: "Không check-in",
};

export const CHECKIN_FLAG_CLASS: Record<CheckInFlag, string> = {
  on_time: "chip-success",
  late: "chip-accent",
  early_end: "chip-accent",
  substitute: "chip-brand",
  no_check_in: "chip-danger",
};

export const CHECKIN_STATE_LABEL: Record<CheckInState, string> = {
  cancelled: "Đã huỷ",
  waiting: "Chưa bắt đầu",
  checked_in: "Đã bắt đầu",
  no_check_in: "Không check-in",
};

/** Dòng giải thích ngắn kèm số phút ("trễ 20 phút", "kết thúc sớm 16 phút"). */
export function checkInDetail(r: { flags: CheckInFlag[]; minutesAfterStart: number | null; minutesBeforeEnd: number | null }): string | null {
  const parts: string[] = [];
  if (r.flags.includes("late") && r.minutesAfterStart !== null) parts.push(`vào sau giờ bắt đầu ${r.minutesAfterStart} phút`);
  if (r.flags.includes("early_end") && r.minutesBeforeEnd !== null) parts.push(`kết thúc sớm ${r.minutesBeforeEnd} phút`);
  return parts.length ? parts.join("; ") : null;
}
