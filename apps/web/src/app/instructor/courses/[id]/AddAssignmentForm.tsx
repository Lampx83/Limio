"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import GenerativeTypePicker from "@/components/GenerativeTypePicker";
import { Sparkles } from "lucide-react";
import { plainToRichHtml } from "@/lib/richText";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});
import {
  GENERATIVE_PRESETS,
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
  showResearch = false,
}: {
  lessonId: string;
  embedded?: boolean;
  onCancel?: () => void;
  /** Role Researcher: mới thấy hai ô yêu cầu tự đánh giá / nhận xét. */
  showResearch?: boolean;
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
        setError(lmsErrorMessage(d.error ?? "ai_failed", res.status));
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
      return;
    }
    const preset = GENERATIVE_PRESETS[value];
    if (!description.trim() || description === lastPrefill.current) {
      const tplHtml = plainToRichHtml(preset.promptTemplate);
      setDescription(tplHtml);
      lastPrefill.current = tplHtml;
    }
    if (!title.trim()) setTitle(preset.label);
    // Hai ô này chỉ Researcher thấy — người khác không chỉnh được nên không tự bật ngầm.
    if (showResearch) {
      setRequireSelfRating(true);
      setRequireReflection(true);
    }
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
      setError(lmsErrorMessage(d.error ?? "create_failed", res.status));
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
      <details className="rounded-lg border border-token bg-[rgb(var(--surface))] p-2">
        <summary className="cursor-pointer text-xs font-medium text-muted">
          Gợi ý dạng bài làm (không bắt buộc)
        </summary>
        <div className="mt-2 space-y-3">
          <p className="text-xs text-faint">
            Dùng khi bạn muốn học viên tự làm ra sản phẩm (tóm tắt, sơ đồ,
            video…) thay vì chỉ trả lời câu hỏi.
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">Dạng bài làm</span>
            <button
              type="button"
              onClick={fetchSuggestions}
              disabled={aiBusy}
              title="AI đề xuất vài đề bài dựa trên nội dung bài học"
              className="btn btn-sm inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap bg-violet-200 text-violet-900 hover:bg-violet-300 active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {aiBusy ? "Đang gợi ý…" : "Gợi ý bằng AI"}
            </button>
          </div>
          {aiSuggestions && (
            <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-2">
              {aiSuggestions.length === 0 ? (
                <p className="text-xs text-muted">Chưa có gợi ý phù hợp.</p>
              ) : (
                <>
                  <p className="text-xs text-muted">
                    AI đề xuất — bấm vào một đề để dùng:
                  </p>
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="block w-full rounded-md border border-token bg-[rgb(var(--surface))] p-2 text-left transition-colors hover:border-violet-400"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
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
                  ))}
                </>
              )}
            </div>
          )}
          <GenerativeTypePicker
            value={pedagogicalIntent}
            onChange={applyPreset}
          />
          {pedagogicalIntent && (
            <p className="text-xs text-muted">
              Đề bài mẫu được điền sẵn, bạn sửa được.
              {showResearch && " Đồng thời bật tự đánh giá và nhận xét sau khi làm."}
            </p>
          )}
        </div>
      </details>
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
      {showResearch && (
        <fieldset className="grid grid-cols-1 gap-1 rounded-lg border border-token bg-[rgb(var(--surface))] p-2 text-xs sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireSelfRating}
              onChange={(e) => setRequireSelfRating(e.target.checked)}
            />
            Yêu cầu học viên tự đánh giá bài làm (1–5)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireReflection}
              onChange={(e) => setRequireReflection(e.target.checked)}
            />
            Yêu cầu học viên viết nhận xét sau khi làm (tối thiểu 20 ký tự)
          </label>
        </fieldset>
      )}
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
          <span className="text-xs text-danger-600">{error}</span>
        )}
      </div>
    </form>
  );
}
