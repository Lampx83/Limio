"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({
  feedbackId,
  initialStatus,
  initialNotes,
}: {
  feedbackId: number;
  initialStatus: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save(action: "approved" | "revised") {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, instructor_notes: notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại");
        return;
      }
      setStatus(action);
      setSavedAt(new Date().toLocaleTimeString("vi-VN"));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
        Human-in-the-loop
      </p>
      <p className="text-xs text-slate-500 mb-2">
        Trạng thái hiện tại:{" "}
        {status === "approved" ? (
          <span className="badge-green">Đã duyệt</span>
        ) : status === "revised" ? (
          <span className="badge-amber">Đã bổ sung ghi chú</span>
        ) : (
          <span className="badge-amber">Chờ duyệt</span>
        )}
        {savedAt && (
          <span className="text-emerald-600 ml-2">
            ✓ Đã lưu lúc {savedAt}
          </span>
        )}
      </p>
      <label className="label">Ghi chú giảng viên (sinh viên sẽ thấy)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="input min-h-[80px] text-sm"
        placeholder="Bổ sung góc nhìn sư phạm, sửa lỗi AI nếu có..."
      />
      {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          onClick={() => save("approved")}
          disabled={submitting}
          className="btn-primary"
        >
          ✓ Duyệt
        </button>
        <button
          onClick={() => save("revised")}
          disabled={submitting || notes.trim().length === 0}
          className="btn-secondary"
        >
          Lưu ghi chú & duyệt
        </button>
      </div>
    </div>
  );
}
