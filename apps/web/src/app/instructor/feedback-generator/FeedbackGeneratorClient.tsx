"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Misconception {
  id: string;
  code: string;
  name: string;
  description: string;
  existingTemplates: number;
}

export default function FeedbackGeneratorClient({
  misconceptions,
}: {
  misconceptions: Misconception[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<{ body: string; rationale: string } | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selected = misconceptions.find((m) => m.id === selectedId);

  async function generate() {
    if (!selectedId) return;
    setGenerating(true);
    setError(null);
    setDraft(null);
    setSaved(false);
    const res = await fetch("/api/ai/generate-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ misconceptionId: selectedId }),
    });
    setGenerating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "ai_failed");
      return;
    }
    const d = await res.json();
    setDraft(d.draft);
    setBody(d.draft.body);
  }

  async function save() {
    if (!body.trim() || !selectedId) return;
    setError(null);
    const res = await fetch("/api/feedback-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "per_misconception",
        misconceptionId: selectedId,
        body: body.trim(),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "save_failed");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      <section>
        <label className="text-sm font-medium">Chọn misconception</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setDraft(null);
            setBody("");
            setSaved(false);
            setError(null);
          }}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">— chọn —</option>
          {misconceptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name} ({m.existingTemplates} template hiện có)
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium">Description:</span>{" "}
            {selected.description}
          </p>
        )}
      </section>

      {selected && (
        <section className="rounded-lg border border-slate-300 p-4 dark:border-slate-700">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Generate feedback body</h2>
            <button
              onClick={generate}
              disabled={generating}
              className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-violet-700"
            >
              {generating ? "🪄 Đang sinh..." : "🪄 AI Generate"}
            </button>
          </div>

          {draft && (
            <div className="mt-3 space-y-2">
              <p className="text-xs italic text-violet-700 dark:text-violet-300">
                Rationale: {draft.rationale}
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={!body.trim() || saved}
                  className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  {saved ? "✓ Đã lưu" : "Lưu làm template"}
                </button>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-slate-700"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-600">Lỗi: {error}</p>}
        </section>
      )}
    </div>
  );
}
