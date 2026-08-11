"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Chấm lại toàn bộ bài đã nộp của đề theo đáp án hiện tại. Chỉ chấm lại câu auto
 * (MCQ…); giữ nguyên điểm chấm tay của câu tự luận.
 */
export default function RegradeAllButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function run() {
    if (
      !window.confirm(
        "Chấm lại tất cả bài đã nộp theo đáp án hiện tại? Điểm câu trắc nghiệm sẽ được tính lại; câu tự luận giữ nguyên điểm chấm tay.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/exams/${examId}/regrade`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        attemptsProcessed?: number;
        attemptsChanged?: number;
        answersChanged?: number;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Có lỗi xảy ra." });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Đã chấm lại ${data.attemptsProcessed ?? 0} bài — ${data.attemptsChanged ?? 0} bài đổi điểm (${data.answersChanged ?? 0} câu).`,
      });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
      >
        {busy ? "Đang chấm lại…" : "↻ Chấm lại tất cả"}
      </button>
      {msg && (
        <p
          className={`text-xs ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
