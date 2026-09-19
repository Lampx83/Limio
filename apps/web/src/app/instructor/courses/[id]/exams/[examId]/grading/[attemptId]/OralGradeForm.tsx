"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface Breakdown {
  topic: string;
  note: string;
}

interface Props {
  examId: string;
  attemptId: string;
  aiSuggestedScore: number | null;
  aiSummary: string | null;
  aiRubricBreakdown: Breakdown[] | null;
  instructorScore: number | null;
  instructorNotes: string;
  /** true khi GV đã chốt điểm (status approved/overridden) — chấm lại thay vì chấm mới. */
  graded: boolean;
}

const GENERATE_ERROR: Record<string, string> = {
  openai_not_configured: "Chưa cấu hình OpenAI. Vào Admin → Tích hợp để thêm khoá.",
  attempt_not_ended: "Lượt thi chưa kết thúc.",
};

export default function OralGradeForm({
  examId,
  attemptId,
  aiSuggestedScore,
  aiSummary,
  aiRubricBreakdown,
  instructorScore,
  instructorNotes,
  graded,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(!graded);
  const [score, setScore] = useState<number>(instructorScore ?? aiSuggestedScore ?? 0);
  const [notes, setNotes] = useState(instructorNotes);
  const [suggestedScore, setSuggestedScore] = useState(aiSuggestedScore);
  const [summary, setSummary] = useState(aiSummary);
  const [breakdown, setBreakdown] = useState(aiRubricBreakdown);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setSuggesting(true);
    setError(null);
    const res = await fetch(
      apiUrl(`/api/exams/${examId}/oral-attempt/${attemptId}/evaluation/generate`),
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    setSuggesting(false);
    if (!res.ok) {
      const code = typeof data?.error === "string" ? data.error : "llm_failed";
      setError(GENERATE_ERROR[code] ?? `Gợi ý lỗi: ${code}`);
      return;
    }
    if (typeof data.aiSuggestedScore === "number") {
      setSuggestedScore(data.aiSuggestedScore);
      setScore(data.aiSuggestedScore);
    }
    if (typeof data.aiSummary === "string") {
      setSummary(data.aiSummary);
      if (!notes) setNotes(data.aiSummary);
    }
    router.refresh();
  }

  if (!open) {
    return (
      <div className="rounded border border-default bg-white p-4">
        <p className="text-sm">
          Điểm đã chốt: <span className="font-semibold">{instructorScore} / 100</span>
        </p>
        {instructorNotes && <p className="mt-1 text-sm text-faint">{instructorNotes}</p>}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded border border-default px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          Sửa điểm
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score < 0 || score > 100) {
      setError("Điểm phải trong khoảng 0 — 100.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-attempt/${attemptId}/evaluation`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, notes: notes || undefined }),
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
    <>
      <div className="rounded border border-default bg-white p-4">
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600">
          <Bot className="h-3.5 w-3.5" />
          AI đề xuất
        </p>
        {suggestedScore !== null && (
          <p className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            Đã lưu điểm AI tạm — học viên chưa xem được
          </p>
        )}
        {suggestedScore !== null && (
          <p className="mb-1.5 text-sm font-semibold">
            {suggestedScore} / 100 — kiểm tra trước khi chốt:
          </p>
        )}
        {summary && (
          <p className="whitespace-pre-wrap text-sm text-faint">{summary}</p>
        )}
        {breakdown && breakdown.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-faint">
            {breakdown.map((b, i) => (
              <li key={i}>
                <strong className="text-[rgb(var(--text))]">{b.topic}:</strong> {b.note}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting}
            className="inline-flex items-center gap-1.5 rounded border border-default px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Bot className="h-3.5 w-3.5" />
            {suggesting ? "Đang phân tích…" : graded ? "Chấm lại bằng AI" : "Chấm bằng AI"}
          </button>
          <p className="mt-1.5 text-xs text-faint">
            Chỉ sinh đề xuất mới, không tự đổi điểm đã chốt — bạn tự quyết có
            cập nhật lại theo đề xuất mới hay không.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="rounded border border-default bg-white p-4">
        <label className="block">
          <span className="block text-sm font-semibold">Điểm của bạn</span>
          <span className="mt-1 flex items-baseline gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-20 rounded border border-default px-2 py-1.5 text-center text-lg font-bold"
              required
            />
            <span className="text-sm text-faint">/ 100</span>
          </span>
        </label>
        <label className="mt-4 block">
          <span className="block text-sm font-semibold">Ghi chú cho sinh viên (tuỳ chọn)</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
            placeholder="Vd: Trả lời tốt câu 1-2, câu 3 chưa nắm rõ khái niệm…"
          />
        </label>
        {error && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          {graded && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-default px-3 py-1.5 text-sm"
            >
              Huỷ
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : graded ? "Lưu điểm mới" : "Chốt điểm"}
          </button>
        </div>
      </form>
    </>
  );
}
