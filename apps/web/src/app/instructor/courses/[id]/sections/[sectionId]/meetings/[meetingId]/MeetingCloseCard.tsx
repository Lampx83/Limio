"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";

export interface CloseCardState {
  startsAt: string;
  closedAt: string | null;
  cancelled: boolean;
  autoSend: boolean;
  summary: { sent: number; failed: number; skipped: number };
}

const ERRORS: Record<string, string> = {
  meeting_not_started: "Buổi chưa bắt đầu nên chưa kết thúc được.",
  meeting_cancelled: "Buổi này đã huỷ.",
  forbidden: "Bạn không có quyền kết thúc buổi này.",
};

/** Kết thúc buổi (C4.1) và theo dõi việc gửi tổng kết chung (C4.4). Nhận xét cá nhân ở trang riêng. */
export default function MeetingCloseCard({
  meetingId,
  sectionId,
  courseId,
  initial,
}: {
  meetingId: string;
  sectionId: string;
  courseId: string;
  initial: CloseCardState;
}) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (state.cancelled) return null;
  const started = Date.now() >= Date.parse(state.startsAt);

  const loadSummary = async () => {
    const r = await fetch(apiUrl(`/api/meetings/${meetingId}/summary`));
    if (r.ok) {
      const j = (await r.json()) as CloseCardState["summary"];
      setState((s) => ({ ...s, summary: j }));
    }
  };

  const pollSummary = () => [3000, 8000, 15000].forEach((ms) => setTimeout(loadSummary, ms));

  const close = async () => {
    if (!window.confirm(state.autoSend ? "Kết thúc buổi và gửi tổng kết cho cả lớp?" : "Kết thúc buổi? Lớp này đang tắt tự gửi tổng kết, thầy/cô gửi sau bằng nút riêng.")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(apiUrl(`/api/meetings/${meetingId}/close`), { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; dispatch?: string | null };
      if (!r.ok) {
        setError(ERRORS[j.error ?? ""] ?? `Có lỗi xảy ra${j.error ? ` (${j.error})` : ""}.`);
        return;
      }
      setState((s) => ({ ...s, closedAt: new Date().toISOString() }));
      setNotice(state.autoSend ? "Đã kết thúc buổi. Tổng kết đang được gửi cho cả lớp." : "Đã kết thúc buổi.");
      // Hàng đợi chạy nền: hỏi lại tình trạng vài lần cho tới khi email đi hết.
      pollSummary();
    } catch {
      setError("Chưa kết thúc được vì mạng không ổn định. Thử lại khi có mạng.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/meetings/${meetingId}/summary`), { method: "POST" });
      if (!r.ok) setError("Chưa gửi được. Thử lại sau.");
      else {
        setNotice("Đang gửi tổng kết. Chỉ những học viên chưa nhận mới được gửi.");
        pollSummary();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Kết thúc buổi">
      {!state.closedAt ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-h4">Kết thúc buổi</h2>
            <p className="text-meta text-muted">
              {started
                ? state.autoSend
                  ? "Bấm khi buổi học xong: hệ thống gửi tổng kết (học gì, từ vựng, bài tập về nhà, buổi sau) cho cả lớp, rồi thầy/cô viết nhận xét từng em."
                  : "Bấm khi buổi học xong để mở phần nhận xét. Lớp này đang tắt tự gửi tổng kết."
                : "Nút này dùng được từ lúc buổi học bắt đầu."}
            </p>
          </div>
          <button type="button" className="btn-primary" disabled={busy || !started} onClick={close}>
            Kết thúc buổi
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-h4">Buổi đã kết thúc</h2>
            <p className="text-meta text-muted">
              Kết thúc lúc {formatDateTime(state.closedAt)}. Tổng kết cả lớp: đã gửi {state.summary.sent}
              {state.summary.skipped > 0 ? `, bỏ qua ${state.summary.skipped} (đã tắt email)` : ""}
              {state.summary.failed > 0 ? `, lỗi ${state.summary.failed}` : ""}.
            </p>
          </div>
          {(!state.autoSend || state.summary.failed > 0 || state.summary.sent === 0) && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={resend}>
              {state.summary.failed > 0 ? "Gửi lại phần lỗi" : "Gửi tổng kết cả lớp"}
            </button>
          )}
          <Link
            href={`/instructor/courses/${courseId}/sections/${sectionId}/meetings/${meetingId}/notes`}
            className="btn-primary"
          >
            Nhận xét sau buổi
          </Link>
        </div>
      )}
      {error && <p className="banner-danger mt-3" role="alert">{error}</p>}
      {notice && <p className="banner-success mt-3" role="status">{notice}</p>}
    </section>
  );
}
