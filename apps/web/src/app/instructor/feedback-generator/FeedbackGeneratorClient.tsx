"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl("/api/ai/generate-feedback"), {
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
    const res = await fetch(apiUrl("/api/feedback-templates"), {
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
    <div className="space-y-5">
      <section className="card">
        <label className="label" htmlFor="fg-mc">
          Chọn misconception
        </label>
        <select
          id="fg-mc"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setDraft(null);
            setBody("");
            setSaved(false);
            setError(null);
          }}
          className="select mt-1.5"
        >
          <option value="">— chọn —</option>
          {misconceptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name} ({m.existingTemplates} template hiện có)
            </option>
          ))}
        </select>
        {selected && (
          <div className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Description
            </p>
            <p className="mt-1 text-muted">{selected.description}</p>
          </div>
        )}
      </section>

      {selected && (
        <section className="rounded-2xl border border-brand-200 bg-brand-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-brand-700">
              Generate feedback body
            </h2>
            <button
              onClick={generate}
              disabled={generating}
              className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {generating ? "Đang sinh..." : "AI Generate"}
            </button>
          </div>

          {draft && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Rationale
                </p>
                <p className="mt-1 text-xs italic text-muted">
                  {draft.rationale}
                </p>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="textarea"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={save}
                  disabled={!body.trim() || saved}
                  className={`btn-sm inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-colors disabled:opacity-50 ${
                    saved
                      ? "bg-success-50 text-success-700"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  {saved ? "✓ Đã lưu" : "Lưu làm template"}
                </button>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="btn-secondary btn-sm"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              Lỗi: {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
