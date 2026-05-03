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
    <div ref={ref} className="relative mt-1">
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span
            key={t.skillId}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800"
          >
            <span className="font-mono">{t.code}</span>
            <span className="opacity-60">·</span>
            <span>{t.name}</span>
            <button
              onClick={() => detach(t.skillId)}
              disabled={busy}
              className="ml-1 text-slate-500 hover:text-red-600 disabled:opacity-50"
              aria-label="Untag"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setPicking((v) => !v)}
          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          + Tag skill
        </button>
        <button
          onClick={aiSuggest}
          disabled={aiSuggesting}
          className="rounded-full border border-dashed border-violet-300 px-2 py-0.5 text-xs text-violet-700 hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
        >
          {aiSuggesting ? "🪄 ..." : "🪄 AI suggest"}
        </button>
      </div>

      {aiSuggestions.length > 0 && (
        <div className="mt-2 rounded border border-violet-200 bg-violet-50 p-2 text-xs dark:border-violet-800 dark:bg-violet-950/40">
          <p className="mb-1 font-medium text-violet-800 dark:text-violet-200">
            🪄 AI đề xuất ({aiSuggestions.length}):
          </p>
          <ul className="space-y-1">
            {aiSuggestions.map((s) => (
              <li
                key={s.skillId}
                className="flex items-start gap-2 rounded bg-white p-1.5 dark:bg-slate-900"
              >
                <button
                  onClick={() => {
                    void attach(s.skillId);
                    setAiSuggestions((prev) =>
                      prev.filter((x) => x.skillId !== s.skillId),
                    );
                  }}
                  disabled={busy}
                  className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
                >
                  +
                </button>
                <div className="flex-1">
                  <p>
                    <span className="font-mono">{s.skillCode}</span> · {s.skillName}
                    <span className="ml-1 text-[10px] text-slate-500">
                      ({Math.round(s.confidence * 100)}%)
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400">
                    {s.rationale}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setAiSuggestions((prev) =>
                      prev.filter((x) => x.skillId !== s.skillId),
                    )
                  }
                  className="text-[10px] text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picking && !createMode && (
        <div className="absolute z-10 mt-1 w-72 rounded border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm skill..."
            className="w-full rounded-t border-b border-slate-200 px-2 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-800"
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
                    className="block w-full px-2 py-1 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-mono text-xs">{s.code}</span>
                    <span className="ml-2">{s.name}</span>
                  </button>
                </li>
              ))}
          </ul>
          <button
            onClick={() => setCreateMode(true)}
            className="block w-full border-t border-slate-200 px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            + Tạo skill mới...
          </button>
        </div>
      )}

      {picking && createMode && (
        <form
          onSubmit={createSkill}
          className="absolute z-10 mt-1 w-72 space-y-2 rounded border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950"
        >
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            required
            pattern="[a-z][a-z0-9._-]*"
            placeholder="code (e.g. math.algebra.linear)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            placeholder="Tên hiển thị"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
          />
          <div className="flex gap-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              Tạo + tag
            </button>
            <button
              type="button"
              onClick={() => setCreateMode(false)}
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
            >
              Hủy
            </button>
          </div>
          {error && <p className="text-xs text-red-600">Lỗi: {error}</p>}
        </form>
      )}
      {error && !picking && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
