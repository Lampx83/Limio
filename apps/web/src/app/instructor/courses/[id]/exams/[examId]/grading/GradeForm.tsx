"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface Props {
  answerId: string;
  maxScore: number;
  initialScore: number | null;
  initialComment: string;
  /** Open editing UI by default — used for pending items. */
  defaultOpen?: boolean;
  /** True when the answer already has a manualScore (regrade flow). */
  graded: boolean;
}

export default function GradeForm({
  answerId,
  maxScore,
  initialScore,
  initialComment,
  defaultOpen,
  graded,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [score, setScore] = useState<number>(initialScore ?? 0);
  const [comment, setComment] = useState(initialComment);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setSuggesting(true);
    setSuggestion(null);
    setError(null);
    const res = await fetch(apiUrl(`/api/exam-answers/${answerId}/suggest-grade`), {
      method: "POST",
    });
    setSuggesting(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof data?.error === "string" ? data.error : "llm_failed";
      setError(
        code === "openai_not_configured"
          ? "Chưa cấu hình OpenAI. Vào Admin → Tích hợp để thêm khóa."
          : `Gợi ý lỗi: ${code}`,
      );
      return;
    }
    if (typeof data.suggestedScore === "number") {
      setScore(data.suggestedScore);
    }
    if (typeof data.reasoning === "string") {
      setSuggestion(data.reasoning);
      // Pre-fill comment if instructor hasn't typed anything.
      if (!comment) setComment(data.reasoning);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
        <span className="text-sm">
          Điểm:{" "}
          <span className="font-semibold">
            {initialScore ?? "—"} / {maxScore}
          </span>
          {initialComment && (
            <span className="ml-3 text-faint">— {initialComment}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-default px-3 py-1 text-xs"
        >
          {graded ? "Sửa điểm" : "Chấm"}
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score < 0 || score > maxScore) {
      setError(`Điểm phải trong khoảng 0 — ${maxScore}.`);
      return;
    }
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      manualScore: score,
      comment: comment || undefined,
    };
    if (graded && reason) body.reason = reason;
    const res = await fetch(apiUrl(`/api/exam-answers/${answerId}/grade`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "save_failed");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded border-2 border-blue-300 bg-blue-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium">Điểm (0 – {maxScore})</span>
          <input
            type="number"
            min={0}
            max={maxScore}
            step={0.5}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="mt-1 w-24 rounded border border-default px-2 py-1 text-sm"
            required
          />
        </label>
        <span className="text-xs text-faint">{((score / maxScore) * 100).toFixed(0)}%</span>
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting}
          className="rounded border border-violet-300 bg-violet-50 px-3 py-1 text-xs text-violet-800 hover:bg-violet-100 disabled:opacity-50"
        >
          {suggesting ? "Đang phân tích…" : <><Bot className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Gợi ý chấm</>}
        </button>
      </div>
      {suggestion && (
        <div className="rounded border border-violet-300 bg-violet-50 p-2 text-xs text-violet-900">
          <p className="mb-1 font-medium">AI gợi ý — kiểm tra trước khi lưu:</p>
          <p className="whitespace-pre-wrap">{suggestion}</p>
        </div>
      )}
      <label className="block">
        <span className="block text-xs font-medium">Phản hồi cho học viên (tuỳ chọn)</span>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          placeholder="Vd: Lập luận tốt, ý chính rõ, nhưng cần ví dụ cụ thể hơn…"
        />
      </label>
      {graded && (
        <label className="block">
          <span className="block text-xs font-medium">Lý do chỉnh sửa điểm</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
            placeholder="Vd: Đọc lại lần 2, phát hiện thêm ý"
          />
        </label>
      )}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-default px-3 py-1 text-sm"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-amber-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : graded ? "Lưu điểm mới" : "Chấm điểm"}
        </button>
      </div>
    </form>
  );
}
