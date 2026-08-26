/**
 * Một ca thi "đang mở" hay không — dùng chung cho MỌI đường vào thi.
 *
 * Có hai cách xác định, chọn bằng `timingMode`:
 *   scheduled — theo cửa sổ opensAt/closesAt (hành vi có từ đầu).
 *   manual    — GV bấm mở/đóng; `status` là nguồn sự thật duy nhất, không có
 *               hạn giờ. Dùng cho kiểm tra đầu giờ: mở ngay, đóng khi xong.
 *
 * Đặt riêng ra file này vì cả code-access.ts (vào bằng mã dự thi) lẫn
 * cohorts.ts (học viên đã ghi danh) đều phải trả lời cùng một câu hỏi. Trước
 * đây mỗi bên tự so ngày một kiểu — chính là mầm của lỗi "landing bảo mở
 * nhưng vào lại báo đóng".
 */

export type ExamSessionTimingModeValue = "scheduled" | "manual";
export type ExamSessionStatusValue = "draft" | "open" | "closed" | "archived";

export interface SessionWindowInput {
  opensAt: Date;
  /** Null hợp lệ khi timingMode = manual. */
  closesAt: Date | null;
  timingMode: ExamSessionTimingModeValue;
  status: ExamSessionStatusValue;
}

/** `not_yet` và `closed` tách nhau để UI báo đúng lý do cho học sinh. */
export type SessionOpenState = "open" | "not_yet" | "closed";

export function sessionOpenState(
  s: SessionWindowInput,
  now: Date,
): SessionOpenState {
  if (s.timingMode === "manual") {
    // Ca thủ công bỏ qua hoàn toàn opensAt/closesAt.
    if (s.status === "open") return "open";
    // draft = GV tạo nhưng chưa mở; closed/archived = đã đóng.
    return s.status === "draft" ? "not_yet" : "closed";
  }

  if (now < s.opensAt) return "not_yet";
  // closesAt null ở chế độ scheduled là dữ liệu hỏng; coi như đã đóng thay vì
  // mở vô hạn — chọn hướng an toàn khi dữ liệu không như kỳ vọng.
  if (s.closesAt === null) return "closed";
  if (now >= s.closesAt) return "closed";
  return "open";
}

export function isSessionOpen(s: SessionWindowInput, now: Date): boolean {
  return sessionOpenState(s, now) === "open";
}
