"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Tag {
  skillId: string;
  code: string;
  name: string;
}

interface Skill {
  id: string;
  code: string;
  name: string;
}

export default function SkillTagsEditor({
  lessonId,
  tags,
}: {
  lessonId: string;
  tags: Tag[];
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [busy, setBusy] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{
      skillId: string;
      skillCode: string;
      skillName: string;
      confidence: number;
      rationale: string;
    }>
  >([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!picking) return;
    const ctrl = new AbortController();
    fetch(`/api/skills?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((d) => setSkills(d.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [picking, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPicking(false);
        setCreateMode(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function attach(skillId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/lessons/${lessonId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
    setBusy(false);
    if (res.ok) {
      setPicking(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "tag_failed");
    }
  }

  async function detach(skillId: string) {
    setBusy(true);
    const res = await fetch(`/api/lessons/${lessonId}/skills/${skillId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function aiSuggest() {
    setAiSuggesting(true);
    setAiSuggestions([]);
    setError(null);
    const res = await fetch("/api/ai/suggest-skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    setAiSuggesting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "ai_failed");
      return;
    }
    const d = await res.json();
    setAiSuggestions(
      (d.suggestions ?? []).filter(
        (s: { skillId: string }) => !tags.some((t) => t.skillId === s.skillId),
      ),
    );
  }

  async function createSkill(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode, name: newName }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
      setBusy(false);
      return;
    }
    const { skillId } = await res.json();
    setNewCode("");
    setNewName("");
    setCreateMode(false);
    await attach(skillId);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <span
            key={t.skillId}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm text-brand-700"
          >
            <span className="font-mono">{t.code}</span>
            <span className="opacity-60">·</span>
            <span>{t.name}</span>
            <button
              onClick={() => detach(t.skillId)}
              disabled={busy}
              className="ml-1 text-base leading-none text-brand-500 transition-colors hover:text-danger-600 disabled:opacity-50"
              aria-label="Untag"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setPicking((v) => !v)}
          className="rounded-full border border-dashed border-token bg-[rgb(var(--surface))] px-3 py-1 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
        >
          + Tag skill
        </button>
        <button
          onClick={aiSuggest}
          disabled={aiSuggesting}
          className="rounded-full border border-dashed border-brand-300 bg-brand-soft px-3 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
        >
          {aiSuggesting ? "🪄 ..." : "🪄 AI suggest"}
        </button>
      </div>

      {aiSuggestions.length > 0 && (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-soft p-3 text-xs">
          <p className="mb-2 font-semibold text-brand-700">
            🪄 AI đề xuất ({aiSuggestions.length}):
          </p>
          <ul className="space-y-1.5">
            {aiSuggestions.map((s) => (
              <li
                key={s.skillId}
                className="flex items-start gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-2"
              >
                <button
                  onClick={() => {
                    void attach(s.skillId);
                    setAiSuggestions((prev) =>
                      prev.filter((x) => x.skillId !== s.skillId),
                    );
                  }}
                  disabled={busy}
                  className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  +
                </button>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-mono">{s.skillCode}</span> · {s.skillName}
                    <span className="ml-1 text-faint">
                      ({Math.round(s.confidence * 100)}%)
                    </span>
                  </p>
                  <p className="mt-0.5 text-faint">{s.rationale}</p>
                </div>
                <button
                  onClick={() =>
                    setAiSuggestions((prev) =>
                      prev.filter((x) => x.skillId !== s.skillId),
                    )
                  }
                  className="text-faint transition-colors hover:text-[rgb(var(--text))]"
                  aria-label="Bỏ qua"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picking && !createMode && (
        <div className="absolute z-10 mt-1 w-72 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] shadow-card-hover animate-fade-in-up">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm skill..."
            className="w-full border-b border-token bg-transparent px-3 py-2 text-sm focus:outline-none"
          />
          <ul className="max-h-48 overflow-y-auto">
            {skills
              .filter((s) => !tags.some((t) => t.skillId === s.id))
              .slice(0, 20)
              .map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => attach(s.id)}
                    disabled={busy}
                    className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600 disabled:opacity-50"
                  >
                    <span className="font-mono text-xs text-faint">{s.code}</span>
                    <span className="ml-2">{s.name}</span>
                  </button>
                </li>
              ))}
          </ul>
          <button
            onClick={() => setCreateMode(true)}
            className="block w-full border-t border-token px-3 py-2 text-left text-xs font-medium text-brand-600 transition-colors hover:bg-brand-soft"
          >
            + Tạo skill mới...
          </button>
        </div>
      )}

      {picking && createMode && (
        <form
          onSubmit={createSkill}
          className="absolute z-10 mt-1 w-72 space-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card-hover"
        >
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            required
            pattern="[a-z][a-z0-9._-]*"
            placeholder="code (e.g. math.algebra.linear)"
            className="input"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            placeholder="Tên hiển thị"
            className="input"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              Tạo + tag
            </button>
            <button
              type="button"
              onClick={() => setCreateMode(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
          </div>
          {error && <p className="text-xs text-danger-600">Lỗi: {error}</p>}
        </form>
      )}
      {error && !picking && (
        <p className="mt-1 text-xs text-danger-600">{error}</p>
      )}
    </div>
  );
}
