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

/**
 * Ân hạn sau `closesAt` cho bài đang làm dở (giây). Bài bắt đầu sát giờ đóng
 * vẫn có chút thời gian nộp thay vì bị cắt tức thì.
 */
export const EXAM_CLOSE_GRACE_SEC = 60;

/**
 * Thời hạn làm bài không được vượt quá giờ đóng ca (+ ân hạn).
 *
 * Trước đây durationSec được chốt đủ thời lượng bất kể giờ vào, nên thí sinh
 * vào lúc `closesAt - 1 phút` vẫn làm trọn 60 phút — vừa bất công với bạn cùng
 * ca, vừa làm chính sách `after_close` (lộ đáp án khi ca đóng) lộ đáp án khi
 * người đó còn đang làm. Ca thủ công (closesAt = null) không có hạn.
 */
export function capDurationToWindow(
  durationSec: number,
  closesAt: Date | null,
  now: Date,
): number {
  if (closesAt === null) return durationSec;
  const untilCloseSec = Math.floor((closesAt.getTime() - now.getTime()) / 1000);
  return Math.min(durationSec, Math.max(0, untilCloseSec) + EXAM_CLOSE_GRACE_SEC);
}
