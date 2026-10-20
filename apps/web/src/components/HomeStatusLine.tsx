"use client";

import { OPEN_NOTIFICATIONS_EVENT } from "./NotificationBell";

/**
 * Dòng trạng thái nhỏ ở trang chủ giảng viên, dưới các lối tắt: tóm tắt việc đang chờ; bấm vào mở chuông thông báo
 * (nơi có danh sách chi tiết). Không có việc nào thì là một lời nhắn nhẹ nhàng, không phải một ô trống.
 */
export default function HomeStatusLine({ grading, sessions, staleLearners }: { grading: number; sessions: number; staleLearners: number }) {
  const parts: string[] = [];
  if (sessions > 0) parts.push(`${sessions} ca thi sắp diễn ra`);
  if (grading > 0) parts.push(`${grading} bài chờ chấm`);
  if (staleLearners > 0) parts.push(`${staleLearners} học viên im ắng`);

  if (parts.length === 0) {
    return <p className="text-sm text-muted">Hôm nay thầy/cô không có việc nào đang chờ. Tận hưởng nhé.</p>;
  }
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT))}
      className="group inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--text))]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
      <span className="truncate">Đang chờ thầy/cô: {parts.join(" · ")}</span>
      <span className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
    </button>
  );
}
