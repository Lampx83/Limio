"use client";

import { useState } from "react";
import type { MeetingCheckInView } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import { formatTime } from "@/lib/datetime";
import { CHECKIN_FLAG_CLASS, CHECKIN_FLAG_LABEL, checkInDetail } from "@/lib/checkInLabels";

const ERRORS: Record<string, string> = {
  check_in_not_open: "Chưa tới giờ bấm. Nút mở trước giờ bắt đầu 30 phút.",
  check_in_closed: "Buổi đã qua giờ kết thúc. Nếu quên bấm, nhờ quản trị trường bổ sung.",
  meeting_cancelled: "Buổi này đã huỷ.",
  forbidden: "Thầy/cô không có tên trong khoá này nên chưa bắt đầu buổi được.",
};

/**
 * "Bắt đầu buổi" (CENTER C5). Mục đích là đối chiếu lịch để xếp dạy bù khi có buổi lệch, không phải chấm công: không có
 * điểm số hay xếp hạng, chỉ ghi giờ vào, giờ ra và ai đã dạy.
 */
export default function TeacherCheckInCard({ initial }: { initial: MeetingCheckInView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (view.state === "cancelled") return null;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/meetings/${view.meetingId}/check-in`), { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as MeetingCheckInView & { error?: string };
      if (!r.ok) {
        setError(ERRORS[j.error ?? ""] ?? "Chưa bắt đầu được buổi, thử lại sau.");
        return;
      }
      setView(j);
    } catch {
      setError("Mạng không ổn định, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  const ci = view.checkIn;
  const detail = checkInDetail(view);
  return (
    <section className="card mt-4 p-4" aria-labelledby="checkin-heading">
      <h2 id="checkin-heading" className="text-h4">
        Bắt đầu buổi
      </h2>
      {ci ? (
        <div className="mt-2 space-y-2 text-sm">
          <p>
            <span className="font-medium">{ci.teacherName}</span> bắt đầu lúc {formatTime(ci.checkedInAt)}
            {ci.checkedOutAt ? `, kết thúc lúc ${formatTime(ci.checkedOutAt)}` : ""}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {view.flags.map((f) => (
              <span key={f} className={CHECKIN_FLAG_CLASS[f]}>
                {CHECKIN_FLAG_LABEL[f]}
              </span>
            ))}
            {view.flags.includes("substitute") && view.expectedTeacher && (
              <span className="text-muted">thay cho {view.expectedTeacher.name}</span>
            )}
          </div>
          {detail && <p className="text-muted">{detail}.</p>}
        </div>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          {view.expectedTeacher && <p className="text-muted">Giáo viên dự kiến: {view.expectedTeacher.name}.</p>}
          {view.canCheckIn ? (
            <button type="button" className="btn-primary" onClick={start} disabled={busy}>
              {busy ? "Đang ghi…" : "Bắt đầu buổi"}
            </button>
          ) : view.window.state === "not_open" ? (
            <p className="text-muted">Nút mở từ {formatTime(view.window.opensAt)}, trước giờ bắt đầu 30 phút.</p>
          ) : (
            <p className="text-muted">Chưa có ai bắt đầu buổi này. Nếu quên bấm, nhờ quản trị trường bổ sung.</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="banner-danger mt-3 text-sm">
          {error}
        </p>
      )}
      <p className="mt-3 text-caption text-muted">Ghi giờ vào, giờ ra và người dạy để đối chiếu với lịch và xếp dạy bù khi cần.</p>
    </section>
  );
}
