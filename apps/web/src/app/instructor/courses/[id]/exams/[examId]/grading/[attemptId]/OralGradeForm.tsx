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
  already_graded: "Đã chốt điểm rồi — sửa điểm trực tiếp bên dưới nếu cần chấm lại.",
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
      <div className="flex items-center justify-between rounded bg-slate-50 px-4 py-3">
        <span className="text-sm">
          Điểm đã chốt: <span className="font-semibold">{instructorScore} / 100</span>
          {instructorNotes && <span className="ml-3 text-faint">— {instructorNotes}</span>}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-default px-3 py-1 text-xs"
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
    <form
      onSubmit={submit}
      className="space-y-3 rounded border-2 border-blue-300 bg-blue-50 p-4"
    >
      {!graded && (
        <div>
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting}
            className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            {suggesting ? (
              "Đang phân tích hội thoại…"
            ) : (
              <>
                <Bot className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Chấm bằng AI
              </>
            )}
          </button>
        </div>
      )}
      {(summary || suggestedScore !== null) && (
        <div className="rounded border border-violet-300 bg-violet-50 p-3 text-xs text-violet-900">
          <p className="mb-1 font-medium">
            AI đề xuất{suggestedScore !== null ? `: ${suggestedScore}/100` : ""} — kiểm tra
            trước khi chốt:
          </p>
          {summary && <p className="whitespace-pre-wrap">{summary}</p>}
          {breakdown && breakdown.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4">
              {breakdown.map((b, i) => (
                <li key={i}>
                  <strong>{b.topic}:</strong> {b.note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium">Điểm (0 – 100)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="mt-1 w-24 rounded border border-default px-2 py-1 text-sm"
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-medium">Ghi chú cho sinh viên (tuỳ chọn)</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          placeholder="Vd: Trả lời tốt câu 1-2, câu 3 chưa nắm rõ khái niệm…"
        />
      </label>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {graded && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-default px-3 py-1 text-sm"
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
  );
}
