"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});
import {
  GENERATIVE_PRESETS,
  GENERATIVE_TYPE_OPTIONS,
  type GenerativeActivityType,
} from "@/lib/generativeActivity";

interface AiSuggestion {
  type: GenerativeActivityType;
  title: string;
  prompt: string;
  rationale: string;
  confidence: number;
}

export default function AddAssignmentForm({
  lessonId,
  embedded = false,
  onCancel,
}: {
  lessonId: string;
  embedded?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(embedded);

  function close() {
    if (embedded) onCancel?.();
    else setOpen(false);
  }

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [pedagogicalIntent, setPedagogicalIntent] =
    useState<GenerativeActivityType | "">("");
  const [requireSelfRating, setRequireSelfRating] = useState(false);
  const [requireReflection, setRequireReflection] = useState(false);
  const [countsTowardGrade, setCountsTowardGrade] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(
    null,
  );

  async function fetchSuggestions() {
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/ai/suggest-activities`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "ai_failed");
        setAiSuggestions(null);
      } else {
        const d = (await res.json()) as { suggestions: AiSuggestion[] };
        setAiSuggestions(d.suggestions ?? []);
      }
    } finally {
      setAiBusy(false);
    }
  }

  function applySuggestion(s: AiSuggestion) {
    applyPreset(s.type);
    setTitle(s.title);
    const promptHtml = plainToRichHtml(s.prompt);
    setDescription(promptHtml);
    lastPrefill.current = promptHtml;
    setAiSuggestions(null);
  }

  function reset() {
    setTitle("");
    setDescription("");
    setDueAt("");
    setMaxScore("100");
    setPedagogicalIntent("");
    setRequireSelfRating(false);
    setRequireReflection(false);
    setCountsTowardGrade(true);
    setError(null);
  }

  // Track the last auto-prefilled description so switching type replaces
  // the previous template — but never overwrites a manually edited description.
  const lastPrefill = useRef("");

  function applyPreset(value: GenerativeActivityType | "") {
    setPedagogicalIntent(value);
    if (!value) {
      setRequireSelfRating(false);
      setRequireReflection(false);
      setCountsTowardGrade(true);
      return;
    }
    const preset = GENERATIVE_PRESETS[value];
    if (!description.trim() || description === lastPrefill.current) {
      const tplHtml = plainToRichHtml(preset.promptTemplate);
      setDescription(tplHtml);
      lastPrefill.current = tplHtml;
    }
    if (!title.trim()) setTitle(preset.label);
    setRequireSelfRating(true);
    setRequireReflection(true);
    setCountsTowardGrade(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title,
      description,
      maxScore: Number(maxScore) || 100,
      requireSelfRating,
      requireReflection,
      countsTowardGrade,
    };
    if (dueAt) payload.dueAt = new Date(dueAt).toISOString();
    if (pedagogicalIntent) {
      payload.pedagogicalIntent = pedagogicalIntent;
      payload.responseFormat = GENERATIVE_PRESETS[pedagogicalIntent].responseFormat;
      payload.assessmentModes = ["self_assessed"];
    }
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/assignments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      reset();
      close();
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      >
        + Thêm assignment
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-faint">
          Cần ý tưởng? Gợi ý hoạt động học sâu dựa trên nội dung lesson.
        </span>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={aiBusy}
          className="btn-secondary btn-sm"
        >
          {aiBusy ? "..." : "✨ Gợi ý AI"}
        </button>
      </div>
      {aiSuggestions && (
        <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-soft p-2">
          {aiSuggestions.length === 0 ? (
            <p className="text-xs text-muted">Chưa có gợi ý phù hợp.</p>
          ) : (
            aiSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applySuggestion(s)}
                className="block w-full rounded-md border border-token bg-[rgb(var(--surface))] p-2 text-left transition-colors hover:border-brand-400"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
                  {GENERATIVE_PRESETS[s.type]?.label ?? s.type}
                  <span className="text-faint">
                    · {Math.round(s.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-0.5 text-sm font-medium text-default">
                  {s.title}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted">
                  {s.prompt}
                </div>
              </button>
            ))
          )}
        </div>
      )}
      <label className="block">
        <span className="text-xs text-faint">
          Loại hoạt động (tuỳ chọn — gợi ý cho hoạt động học sâu)
        </span>
        <select
          value={pedagogicalIntent}
          onChange={(e) =>
            applyPreset(e.target.value as GenerativeActivityType | "")
          }
          className="input mt-1"
        >
          <option value="">Bài tập thường (instructor chấm)</option>
          {GENERATIVE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} disabled={!o.available}>
              {o.label}
              {!o.available ? " (sắp có)" : ""}
            </option>
          ))}
        </select>
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Tiêu đề assignment"
        className="input"
      />
      <RichTextEditor
        value={description}
        onChange={setDescription}
        placeholder="Mô tả nhiệm vụ..."
      />
      <div className="flex flex-wrap gap-2">
        <label className="block flex-1">
          <span className="text-xs text-faint">Hạn nộp (optional)</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="input mt-1"
          />
        </label>
        <label className="block w-28">
          <span className="text-xs text-faint">Điểm tối đa</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="input mt-1"
          />
        </label>
      </div>
      <fieldset className="grid grid-cols-1 gap-1 rounded-lg border border-token bg-[rgb(var(--surface))] p-2 text-xs sm:grid-cols-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireSelfRating}
            onChange={(e) => setRequireSelfRating(e.target.checked)}
          />
          Yêu cầu tự đánh giá (1–5)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireReflection}
            onChange={(e) => setRequireReflection(e.target.checked)}
          />
          Yêu cầu reflection (≥20 ký tự)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={countsTowardGrade}
            onChange={(e) => setCountsTowardGrade(e.target.checked)}
          />
          Tính vào điểm khoá học
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            close();
          }}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
        {error && (
          <span className="text-xs text-danger-600">Lỗi: {error}</span>
        )}
      </div>
    </form>
  );
}
