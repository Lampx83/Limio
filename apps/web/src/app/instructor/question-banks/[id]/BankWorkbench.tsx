"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Status = "draft" | "published" | "archived";
type CognitiveLevel = "remember_understand" | "apply" | "analyze_plus";
type QuestionType =
  | "mcq"
  | "multi"
  | "true_false_notgiven"
  | "gap_fill"
  | "short_answer"
  | "essay"
  | "matching_heading";

type Item = {
  id: string;
  bankId: string;
  bankName: string;
  type: string;
  prompt: string;
  // ExamQuestion config payload — shape varies by type. Used by AnswerPanel
  // to render the correct answer per question. Server returns this for
  // instructor-only views (bank is private/course-shared, never learner-facing).
  config: Record<string, unknown> | null;
  points: number;
  difficulty: number;
  cognitiveLevel: CognitiveLevel;
  status: Status;
  skillIds: string[];
  updatedAt: string;
  stats: { pValueAvg: number; discriminationAvg: number; totalUses: number } | null;
  exposureCount: number;
  lastSampledAt: string | null;
};

type Skill = { id: string; code: string; name: string };

interface ActiveFilters {
  q: string;
  status: Status[];
  cognitiveLevel: CognitiveLevel[];
  difficulty: number[];
}

const STATUS_LABEL: Record<Status, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

const COGNITIVE_LABEL: Record<CognitiveLevel, string> = {
  remember_understand: "Nhớ & Hiểu",
  apply: "Vận dụng",
  analyze_plus: "Phân tích+",
};
const COGNITIVE_TONE: Record<CognitiveLevel, string> = {
  remember_understand: "bg-sky-100 text-sky-700",
  apply: "bg-violet-100 text-violet-700",
  analyze_plus: "bg-orange-100 text-orange-700",
};

const TYPE_LABEL: Record<string, string> = {
  mcq: "MCQ",
  multi: "Multi",
  true_false_notgiven: "T/F/NG",
  gap_fill: "Điền từ",
  short_answer: "Ngắn",
  essay: "Tự luận",
  matching_heading: "Ghép đầu đề",
};

const DIFFICULTY_COLOR = ["", "bg-emerald-400", "bg-emerald-400", "bg-yellow-400", "bg-red-400", "bg-red-400"];
const DIFFICULTY_COUNT = [0, 1, 2, 1, 1, 2];
function DifficultyDots({ level }: { level: number }) {
  const color = DIFFICULTY_COLOR[level] ?? "bg-slate-300";
  const count = DIFFICULTY_COUNT[level] ?? 0;
  return <>{Array.from({ length: count }).map((_, i) => <span key={i} className={`inline-block h-2 w-2 rounded-full ${color}`} />)}</>;
}

// Quality badge derived from BankQuestionStats
function qualityInfo(
  stats: Item["stats"],
): { ok: true } | { ok: false; warnings: string[] } | null {
  if (!stats || stats.pValueAvg === -1) return null;
  const warnings: string[] = [];
  if (stats.pValueAvg > 0.95) warnings.push("Quá dễ");
  if (stats.pValueAvg < 0.05) warnings.push("Quá khó");
  if (stats.discriminationAvg !== -2 && stats.discriminationAvg < 0.1)
    warnings.push("Ít phân loại");
  return warnings.length > 0 ? { ok: false, warnings } : { ok: true };
}

export default function BankWorkbench({
  bankId,
  initialItems,
  initialCursor,
  suggestedSkills,
}: {
  bankId: string;
  initialItems: Item[];
  initialCursor: string | null;
  suggestedSkills: Skill[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [filters, setFilters] = useState<ActiveFilters>({
    q: "",
    status: [],
    cognitiveLevel: [],
    difficulty: [],
  });

  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(
    async (f: ActiveFilters, append = false, cur?: string) => {
      setLoading(true);
      setErr(null);
      const params = new URLSearchParams();
      f.status.forEach((s) => params.append("status", s));
      f.cognitiveLevel.forEach((c) => params.append("cognitiveLevel", c));
      f.difficulty.forEach((d) => params.append("difficulty", String(d)));
      if (f.q.trim()) params.set("q", f.q.trim());
      if (cur) params.set("cursor", cur);
      try {
        const r = await fetch(
          `/api/question-banks/${bankId}/questions?${params}`,
        );
        if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
        const j = (await r.json()) as { items: Item[]; nextCursor: string | null };
        setItems((prev) => append ? [...prev, ...j.items] : j.items);
        setCursor(j.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [bankId],
  );

  // Re-fetch whenever filters change (debounce text search).
  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      void fetchItems(filters);
    }, filters.q ? 350 : 0);
    return () => { if (qTimer.current) clearTimeout(qTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const flashOk = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3000);
  };

  const refreshAndKeepSelection = async () => {
    await fetchItems(filters);
  };

  const toggleFilter = <K extends keyof ActiveFilters>(
    key: K,
    val: (ActiveFilters[K] extends (infer T)[] ? T : never),
  ) => {
    setFilters((prev) => {
      const arr = prev[key] as unknown[];
      const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
      return { ...prev, [key]: next };
    });
    setSelectedId(null);
  };

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="mt-6 flex h-[calc(100vh-200px)] min-h-[500px] gap-0 overflow-hidden rounded-lg border border-default">
      {/* ── Left: Filter panel ──────────────────────────────────────────── */}
      <aside className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-default bg-slate-50 p-3">
        <div>
          <input
            type="search"
            placeholder="Tìm câu hỏi..."
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="w-full rounded border border-default bg-white px-2 py-1.5 text-xs"
          />
        </div>

        <FilterGroup title="Trạng thái">
          {(["draft", "published", "archived"] as Status[]).map((s) => (
            <FilterCheck
              key={s}
              label={STATUS_LABEL[s]}
              checked={filters.status.includes(s)}
              onChange={() => toggleFilter("status", s)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Mức tư duy">
          {(["remember_understand", "apply", "analyze_plus"] as CognitiveLevel[]).map((c) => (
            <FilterCheck
              key={c}
              label={COGNITIVE_LABEL[c]}
              checked={filters.cognitiveLevel.includes(c)}
              onChange={() => toggleFilter("cognitiveLevel", c)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Độ khó">
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => toggleFilter("difficulty", d)}
                className={`rounded border px-2 py-0.5 text-xs ${
                  filters.difficulty.includes(d)
                    ? "border-blue-400 bg-blue-100 text-blue-800"
                    : "border-default bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </FilterGroup>

        {(filters.status.length > 0 ||
          filters.cognitiveLevel.length > 0 ||
          filters.difficulty.length > 0 ||
          filters.q) && (
          <button
            onClick={() =>
              setFilters({ q: "", status: [], cognitiveLevel: [], difficulty: [] })
            }
            className="text-left text-xs text-blue-600 hover:underline"
          >
            Bỏ bộ lọc
          </button>
        )}
      </aside>

      {/* ── Middle: Item list ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-default bg-white px-4 py-2">
          <span className="text-xs text-faint">
            {loading ? "Đang tải..." : `${items.length} câu hỏi`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { setImporting((s) => !s); setAdding(false); }}
              className="rounded border border-default bg-white px-3 py-1 text-xs hover:bg-slate-50"
            >
              {importing ? "Đóng" : "Import CSV"}
            </button>
            <button
              onClick={() => { setAdding((s) => !s); setImporting(false); }}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
            >
              {adding ? "Đóng" : "+ Thêm"}
            </button>
          </div>
        </div>

        {/* Overlay panels */}
        {(importing || adding) && (
          <div className="shrink-0 overflow-y-auto border-b border-default bg-white px-4 py-3">
            {importing && (
              <ImportCsvPanel
                bankId={bankId}
                onDone={async () => {
                  setImporting(false);
                  await refreshAndKeepSelection();
                  flashOk("Đã import");
                }}
              />
            )}
            {adding && (
              <QuestionForm
                bankId={bankId}
                suggestedSkills={suggestedSkills}
                onDone={async () => {
                  setAdding(false);
                  await refreshAndKeepSelection();
                  flashOk("Đã tạo câu hỏi");
                }}
              />
            )}
          </div>
        )}

        {/* Notifications */}
        {err && (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            ⚠ {err}
          </div>
        )}
        {flash && (
          <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            {flash}
          </div>
        )}

        {/* List */}
        <ul
          data-testid="question-list"
          className="flex-1 overflow-y-auto divide-y divide-default"
        >
          {items.length === 0 && !loading && (
            <li className="flex items-center justify-center p-10 text-sm text-faint">
              Không có câu hỏi phù hợp.
            </li>
          )}
          {items.map((q) => {
            const qi = qualityInfo(q.stats);
            const isSelected = q.id === selectedId;
            return (
              <li
                key={q.id}
                data-testid={`question-row-${q.id}`}
                onClick={() => setSelectedId(isSelected ? null : q.id)}
                className={`cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 ${isSelected ? "bg-blue-50 hover:bg-blue-50" : "bg-white"}`}
              >
                <div className="flex items-start gap-2">
                  {/* Quality dot */}
                  <div className="mt-0.5 shrink-0">
                    {qi === null ? (
                      <span className="block h-2 w-2 rounded-full bg-slate-200" title="Chưa có dữ liệu" />
                    ) : qi.ok ? (
                      <span className="block h-2 w-2 rounded-full bg-emerald-400" title="Chất lượng tốt" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-amber-400" title={qi.warnings.join(", ")} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_TONE[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${COGNITIVE_TONE[q.cognitiveLevel]}`}>
                        {COGNITIVE_LABEL[q.cognitiveLevel]}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">
                        {TYPE_LABEL[q.type] ?? q.type}
                      </span>
                      <span className="text-[10px] text-faint">
                        <span className="inline-flex items-center gap-0.5"><DifficultyDots level={q.difficulty} /></span> · {q.points}đ
                      </span>
                      {qi && !qi.ok && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          ⚠ {qi.warnings.join(" · ")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-800">{q.prompt}</p>
                    <p className="mt-0.5 text-[10px] text-faint">
                      {q.skillIds.length} skill
                      {q.stats && q.stats.totalUses > 0
                        ? ` · đã dùng ${q.stats.totalUses} lần`
                        : ""}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {cursor && (
          <div className="shrink-0 border-t border-default bg-white px-4 py-2 text-center">
            <button
              onClick={() => void fetchItems(filters, true, cursor)}
              disabled={loading}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              Tải thêm
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Detail panel ──────────────────────────────────────────── */}
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-default bg-white">
        {selectedItem ? (
          <DetailPanel
            key={selectedItem.id}
            q={selectedItem}
            suggestedSkills={suggestedSkills}
            onClose={() => setSelectedId(null)}
            onUpdated={async (updated) => {
              await refreshAndKeepSelection();
              if (updated) flashOk("Đã lưu");
            }}
            onDeleted={async () => {
              // Optimistic: drop selection + remove from local list before
              // refetching so the UI feels immediate.
              setSelectedId(null);
              setItems((curr) => curr.filter((x) => x.id !== selectedItem.id));
              flashOk("Đã xoá câu hỏi");
              await refreshAndKeepSelection();
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-faint">
            <span className="text-2xl">←</span>
            <p>Chọn một câu hỏi để xem chi tiết và chỉnh sửa.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

// ─── Filter helpers ────────────────────────────────────────────────────────

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilterCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3 w-3" />
      {label}
    </label>
  );
}

// ─── Detail panel ──────────────────────────────────────────────────────────

function DetailPanel({
  q,
  suggestedSkills,
  onClose,
  onUpdated,
  onDeleted,
}: {
  q: Item;
  suggestedSkills: Skill[];
  onClose: () => void;
  onUpdated: (updated: boolean) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"edit" | "quality">("edit");

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-default px-4 py-2">
        <div className="flex gap-1">
          {(["edit", "quality"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                tab === t ? "bg-blue-100 text-blue-700" : "text-faint hover:bg-slate-100"
              }`}
            >
              {t === "edit" ? "Sửa" : "Chất lượng"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <DeleteQuestionButton questionId={q.id} promptHint={q.prompt} onDeleted={onDeleted} />
          <button
            onClick={onClose}
            className="text-faint hover:text-slate-700"
            aria-label="Đóng"
            title="Đóng"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "edit" ? (
          <EditTab q={q} suggestedSkills={suggestedSkills} onUpdated={onUpdated} />
        ) : (
          <QualityTab q={q} />
        )}
      </div>
    </>
  );
}

function EditTab({
  q,
  suggestedSkills,
  onUpdated,
}: {
  q: Item;
  suggestedSkills: Skill[];
  onUpdated: (updated: boolean) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(q.prompt);
  const [difficulty, setDifficulty] = useState(q.difficulty);
  const [points, setPoints] = useState(q.points);
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>(q.cognitiveLevel);
  const [skillIds, setSkillIds] = useState(q.skillIds);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/bank-questions/${q.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, difficulty, points, cognitiveLevel }),
      });
      if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
      await onUpdated(true);
    } finally {
      setBusy(false);
    }
  };

  const callStatus = async (path: string) => {
    setStatusBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/bank-questions/${q.id}/${path}`, { method: "POST" });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await onUpdated(true);
    } finally {
      setStatusBusy(false);
    }
  };

  const toggleSkill = async (skillId: string) => {
    const isOn = skillIds.includes(skillId);
    const r = await fetch(`/api/bank-questions/${q.id}/tags`, {
      method: isOn ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
    if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
    setSkillIds((p) => (isOn ? p.filter((id) => id !== skillId) : [...p, skillId]));
  };

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[q.status]}`}>
          {STATUS_LABEL[q.status]}
        </span>
        <div className="flex gap-2">
          {q.status === "draft" && (
            <button
              onClick={() => callStatus("publish")}
              disabled={statusBusy || skillIds.length === 0}
              title={skillIds.length === 0 ? "Cần ≥1 skill" : ""}
              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publish
            </button>
          )}
          {q.status === "published" && (
            <button
              onClick={() => callStatus("archive")}
              disabled={statusBusy}
              className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
            >
              Lưu trữ
            </button>
          )}
        </div>
      </div>

      {/* Prompt */}
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Nội dung</span>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-2 py-1.5 text-xs"
        />
      </label>

      {/* Answer editor — editable for MCQ/multi/T-F-NG; read-only preview
          fallback for other types (gap_fill, short_answer, essay,
          matching_heading) where the config shape is more complex.
          onChange persists via PATCH /api/bank-questions/[id] with `config`. */}
      <AnswerEditor
        type={q.type}
        config={q.config}
        questionId={q.id}
        onSaved={() => void onUpdated(true)}
      />

      {/* Cognitive level */}
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Mức tư duy</span>
        <select
          value={cognitiveLevel}
          onChange={(e) => setCognitiveLevel(e.target.value as CognitiveLevel)}
          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
        >
          {(["remember_understand", "apply", "analyze_plus"] as CognitiveLevel[]).map((c) => (
            <option key={c} value={c}>{COGNITIVE_LABEL[c]}</option>
          ))}
        </select>
      </label>

      {/* Difficulty + Points */}
      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="block text-xs font-medium text-slate-600">Độ khó (1–5)</span>
          <input
            type="number" min={1} max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex-1 block">
          <span className="block text-xs font-medium text-slate-600">Điểm</span>
          <input
            type="number" min={1} max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
          />
        </label>
      </div>

      {/* Skill tags */}
      {suggestedSkills.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-600">Skills</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {suggestedSkills.map((s) => {
              const on = skillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => void toggleSkill(s.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    on
                      ? "border-blue-300 bg-blue-100 text-blue-800"
                      : "border-default bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {on ? "✓ " : "+ "}{s.name}
                </button>
              );
            })}
          </div>
          {skillIds.length === 0 && (
            <p className="mt-1 text-[10px] text-amber-600">
              ⚠ Cần ≥1 skill để publish.
            </p>
          )}
        </div>
      )}

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          ⚠ {err}
        </div>
      )}

      <button
        onClick={onSave}
        disabled={busy || !prompt.trim()}
        className="w-full rounded bg-brand-600 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </div>
  );
}

function QualityTab({ q }: { q: Item }) {
  const qi = qualityInfo(q.stats);
  return (
    <div className="space-y-4">
      {/* Badge */}
      {qi === null ? (
        <div className="rounded border border-default bg-slate-50 px-3 py-4 text-center">
          <p className="text-sm font-medium text-slate-500">Chưa có dữ liệu</p>
          <p className="mt-1 text-xs text-faint">
            Câu hỏi cần được dùng trong ít nhất 1 kỳ thi để có chỉ số chất lượng.
          </p>
        </div>
      ) : qi.ok ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
          <p className="text-sm font-medium text-emerald-700">✓ Chất lượng tốt</p>
        </div>
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-sm font-medium text-amber-700">⚠ Cần xem lại</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-600">
            {qi.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Stats table */}
      {q.stats && q.stats.pValueAvg !== -1 && (
        <table className="w-full text-xs">
          <tbody className="divide-y divide-default">
            <StatRow
              label="Chỉ số dễ (p)"
              value={q.stats.pValueAvg.toFixed(2)}
              hint="0.3–0.8 = lý tưởng"
            />
            {q.stats.discriminationAvg !== -2 && (
              <StatRow
                label="Độ phân loại (D)"
                value={q.stats.discriminationAvg.toFixed(2)}
                hint="≥ 0.3 = tốt"
              />
            )}
            <StatRow label="Số lần dùng (kỳ thi)" value={String(q.stats.totalUses)} />
          </tbody>
        </table>
      )}

      {/* Exposure section */}
      <div>
        <div className="mb-1.5 text-xs font-medium text-slate-600">Mức độ sử dụng (random pool)</div>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-default">
            <StatRow
              label="Lần được rút (exposure)"
              value={
                <span className={q.exposureCount > 50 ? "text-red-700 font-semibold" : q.exposureCount > 20 ? "text-amber-700" : "text-slate-800"}>
                  {q.exposureCount}
                  {q.exposureCount > 50 && " ⚠"}
                </span>
              }
              hint={q.exposureCount > 50 ? "Quá cao — cân nhắc thêm câu mới" : q.exposureCount > 20 ? "Trung bình cao" : undefined}
            />
            {q.lastSampledAt && (
              <StatRow
                label="Lần cuối được rút"
                value={new Date(q.lastSampledAt).toLocaleDateString("vi-VN")}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-2 font-medium text-slate-600">
        {label}
        {hint && <span className="ml-1 text-faint">({hint})</span>}
      </td>
      <td className="py-1.5 text-right font-mono">{value}</td>
    </tr>
  );
}

// ─── QuestionForm (add new) ───────────────────────────────────────────────

function QuestionForm({
  bankId,
  suggestedSkills,
  onDone,
}: {
  bankId: string;
  suggestedSkills: Skill[];
  onDone: () => Promise<void>;
}) {
  const [type, setType] = useState<QuestionType>("mcq");
  const [prompt, setPrompt] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [points, setPoints] = useState(1);
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>("apply");
  const [options, setOptions] = useState<{ label: string; correct: boolean }[]>([
    { label: "", correct: true },
    { label: "", correct: false },
    { label: "", correct: false },
    { label: "", correct: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const config: Record<string, unknown> =
        type === "mcq" || type === "multi"
          ? {
              options: options
                .map((o, i) => ({
                  id: String.fromCharCode(97 + i),
                  label: o.label.trim(),
                  isCorrect: o.correct,
                }))
                .filter((o) => o.label.length > 0),
            }
          : type === "true_false_notgiven"
          ? { correct: "true" }
          : type === "short_answer"
          ? { acceptedAnswers: [], matchMode: "exact" }
          : type === "essay"
          ? { rubric: "" }
          : {};
      const r = await fetch(`/api/question-banks/${bankId}/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, prompt, config, difficulty, points, cognitiveLevel }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} data-testid="add-question-form" className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Loại</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className="mt-1 rounded border border-default px-2 py-1.5 text-xs"
          >
            <option value="mcq">MCQ (1 đáp án)</option>
            <option value="multi">Multi (nhiều đáp án)</option>
            <option value="true_false_notgiven">True/False/Not Given</option>
            <option value="gap_fill">Điền từ</option>
            <option value="short_answer">Câu trả lời ngắn</option>
            <option value="essay">Tự luận</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Mức tư duy</span>
          <select
            value={cognitiveLevel}
            onChange={(e) => setCognitiveLevel(e.target.value as CognitiveLevel)}
            className="mt-1 rounded border border-default px-2 py-1.5 text-xs"
          >
            {(["remember_understand", "apply", "analyze_plus"] as CognitiveLevel[]).map((c) => (
              <option key={c} value={c}>{COGNITIVE_LABEL[c]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Độ khó (1–5)</span>
          <input
            type="number" min={1} max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="mt-1 w-16 rounded border border-default px-2 py-1.5 text-xs"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Điểm</span>
          <input
            type="number" min={1} max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="mt-1 w-16 rounded border border-default px-2 py-1.5 text-xs"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Nội dung câu hỏi</span>
        <textarea
          required rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={10000}
          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
        />
      </label>

      {(type === "mcq" || type === "multi") && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600">Đáp án</div>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === "mcq" ? "radio" : "checkbox"}
                checked={o.correct}
                onChange={(e) => {
                  if (type === "mcq") {
                    setOptions((prev) => prev.map((p, j) => ({ ...p, correct: j === i })));
                  } else {
                    setOptions((prev) =>
                      prev.map((p, j) =>
                        j === i ? { ...p, correct: e.target.checked } : p,
                      ),
                    );
                  }
                }}
              />
              <input
                type="text"
                value={o.label}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)),
                  )
                }
                placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
                className="flex-1 rounded border border-default px-2 py-1 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-faint">Sau khi tạo, gán ≥1 skill để publish.</p>
        <button
          type="submit"
          disabled={busy || !prompt.trim()}
          className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "..." : "Tạo (draft)"}
        </button>
      </div>
    </form>
  );
}

// ─── ImportCsvPanel ───────────────────────────────────────────────────────

function ImportCsvPanel({
  bankId,
  onDone,
}: {
  bankId: string;
  onDone: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<{ created: number; failed: number } | null>(null);

  const onImport = async () => {
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setErr("CSV trống hoặc thiếu cột bắt buộc (type, prompt).");
        return;
      }
      let created = 0;
      let failed = 0;
      for (const row of rows) {
        const r = await fetch(`/api/question-banks/${bankId}/questions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(row),
        });
        if (r.ok) created++;
        else failed++;
      }
      setReport({ created, failed });
      if (created > 0) await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-faint">
        Dán CSV. Header tối thiểu: <code>type,prompt</code>. Hỗ trợ thêm:{" "}
        <code>difficulty,points,optionA,optionB,optionC,optionD,correct</code>
      </p>
      <pre className="overflow-x-auto rounded bg-white p-2 text-[10px] text-slate-700">
{`type,prompt,difficulty,points,optionA,optionB,optionC,optionD,correct
mcq,1+1=?,1,1,2,3,4,5,A`}
      </pre>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Dán CSV vào đây..."
        className="w-full rounded border border-default bg-white px-2 py-1.5 font-mono text-xs"
      />
      {err && <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-800">⚠ {err}</div>}
      {report && (
        <div className="text-xs text-emerald-700">
          Tạo thành công {report.created} / lỗi {report.failed}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={onImport}
          disabled={busy || !text.trim()}
          className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "..." : "Import"}
        </button>
      </div>
    </div>
  );
}

// ─── CSV parser (unchanged logic) ─────────────────────────────────────────

function parseCsv(raw: string): Array<{
  type: string;
  prompt: string;
  config: Record<string, unknown>;
  difficulty?: number;
  points?: number;
}> {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0]!.split(",").map((s) => s.trim());
  const idx = (k: string) => head.indexOf(k);
  const iType = idx("type");
  const iPrompt = idx("prompt");
  if (iType < 0 || iPrompt < 0) return [];
  const iDiff = idx("difficulty");
  const iPoints = idx("points");
  const iCorrect = idx("correct");
  const optIdx = ["A", "B", "C", "D"].map((l) => idx(`option${l}`));

  const out: ReturnType<typeof parseCsv> = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r]!.split(",").map((s) => s.trim());
    const type = cells[iType];
    const prompt = cells[iPrompt];
    if (!type || !prompt) continue;
    const config: Record<string, unknown> = {};
    if (type === "mcq" || type === "multi") {
      const options: { id: string; label: string; isCorrect: boolean }[] = [];
      const correctSet = (cells[iCorrect] ?? "")
        .split("|")
        .map((s) => s.trim().toUpperCase());
      for (let i = 0; i < 4; i++) {
        const colIdx = optIdx[i] ?? -1;
        if (colIdx < 0) continue;
        const label = cells[colIdx];
        if (!label) continue;
        const letter = String.fromCharCode(65 + i);
        options.push({
          id: letter.toLowerCase(),
          label,
          isCorrect: correctSet.includes(letter),
        });
      }
      config.options = options;
    }
    out.push({
      type,
      prompt,
      config,
      ...(iDiff >= 0 && cells[iDiff] ? { difficulty: Number(cells[iDiff]) } : {}),
      ...(iPoints >= 0 && cells[iPoints] ? { points: Number(cells[iPoints]) } : {}),
    });
  }
  return out;
}

// ─── Answer preview (read-only) ─────────────────────────────────────────────
//
// Renders the correct answer per question type from BankQuestion.config.
// Bank workbench is instructor-only — fine to reveal answer keys here.
// Different ExamQuestionType has different config shapes:
//   - mcq / multi:           config.options[] each { id, label, isCorrect }
//   - true_false_notgiven:   config.correct = "true" | "false" | "not_given"
//   - gap_fill:              config.blanks[] each { acceptable: string[] }
//   - short_answer:          config.acceptable: string[]
//   - matching_heading:      config.headings + config.paragraphs (P1)
//   - essay:                 no objective answer — show "chấm tay"
function AnswerPreview({
  type,
  config,
}: {
  type: string;
  config: Record<string, unknown> | null;
}) {
  const cfg = (config ?? {}) as Record<string, unknown>;

  // MCQ / multi → list of options with check icon on correct ones.
  if (type === "mcq" || type === "multi") {
    const options = (cfg.options as Array<{ id?: string; label?: string; isCorrect?: boolean }> | undefined) ?? [];
    if (options.length === 0) {
      return <AnswerEmpty hint="Chưa có option" />;
    }
    return (
      <AnswerBox label="Đáp án">
        <ul className="space-y-1">
          {options.map((o, i) => (
            <li
              key={o.id ?? i}
              className={`flex items-start gap-1.5 rounded px-2 py-1 text-xs ${
                o.isCorrect ? "bg-emerald-50 text-emerald-900" : "text-slate-600"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  o.isCorrect ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {o.isCorrect ? "✓" : String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{o.label ?? "(không có nhãn)"}</span>
            </li>
          ))}
        </ul>
      </AnswerBox>
    );
  }

  // True/False/Not Given → highlight the correct value.
  if (type === "true_false_notgiven") {
    const correct = typeof cfg.correct === "string" ? cfg.correct : null;
    const LABEL: Record<string, string> = {
      true: "Đúng",
      false: "Sai",
      not_given: "Không đề cập",
    };
    if (!correct) return <AnswerEmpty hint="Chưa chọn đáp án đúng" />;
    return (
      <AnswerBox label="Đáp án đúng">
        <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
            ✓
          </span>
          {LABEL[correct] ?? correct}
        </span>
      </AnswerBox>
    );
  }

  // Gap fill → list of blanks with their acceptable answers.
  if (type === "gap_fill") {
    const blanks =
      (cfg.blanks as Array<{ acceptable?: string[] }> | undefined) ?? [];
    if (blanks.length === 0) return <AnswerEmpty hint="Chưa có ô trống" />;
    return (
      <AnswerBox label="Đáp án các ô trống">
        <ol className="space-y-1">
          {blanks.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                {i + 1}
              </span>
              <div className="flex flex-wrap gap-1">
                {(b.acceptable ?? []).length === 0 ? (
                  <span className="text-faint italic">(trống)</span>
                ) : (
                  (b.acceptable ?? []).map((a, j) => (
                    <span
                      key={j}
                      className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800"
                    >
                      {a}
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ol>
      </AnswerBox>
    );
  }

  // Short answer → list of acceptable strings.
  if (type === "short_answer") {
    const acceptable = (cfg.acceptable as string[] | undefined) ?? [];
    if (acceptable.length === 0) return <AnswerEmpty hint="Chưa có đáp án" />;
    return (
      <AnswerBox label="Đáp án chấp nhận">
        <div className="flex flex-wrap gap-1">
          {acceptable.map((a, i) => (
            <span
              key={i}
              className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800"
            >
              {a}
            </span>
          ))}
        </div>
      </AnswerBox>
    );
  }

  // Essay → no objective answer.
  if (type === "essay") {
    return (
      <AnswerBox label="Đáp án">
        <span className="text-xs italic text-amber-700">
          Loại tự luận — giảng viên chấm tay theo rubric.
        </span>
      </AnswerBox>
    );
  }

  // Matching headings (P1) — show pairs if config present.
  if (type === "matching_heading") {
    const pairs = (cfg.pairs as Array<{ heading?: string; paragraph?: string }> | undefined) ?? [];
    if (pairs.length === 0) return <AnswerEmpty hint="Chưa ghép cặp" />;
    return (
      <AnswerBox label="Cặp ghép đúng">
        <ul className="space-y-1 text-xs">
          {pairs.map((p, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
                {p.heading ?? "?"}
              </span>
              <span className="text-faint">→</span>
              <span className="text-slate-700">{p.paragraph ?? "?"}</span>
            </li>
          ))}
        </ul>
      </AnswerBox>
    );
  }

  // Unknown type — show raw config as fallback.
  return (
    <AnswerBox label="Đáp án (raw)">
      <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
        {JSON.stringify(config, null, 2)}
      </pre>
    </AnswerBox>
  );
}

function AnswerBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        {label}
      </div>
      {children}
    </div>
  );
}

function AnswerEmpty({ hint }: { hint: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
      ⚠ {hint}
    </div>
  );
}

// ─── Answer editor ──────────────────────────────────────────────────────────
//
// Editable version of AnswerPreview for the types we can express with a
// simple form (mcq/multi/true_false_notgiven). Other types fall back to the
// read-only preview — editing gap_fill / matching_heading / etc. needs a
// dedicated builder; deferred to a future PR.
//
// Save policy: explicit "Lưu đáp án" button (separate from the main "Lưu
// thay đổi" so instructor can apply prompt edits + answer edits independently).
// Calls PATCH /api/bank-questions/[id] with `{ config }`. Server snapshots a
// new BankQuestionVersion if status=published.

function AnswerEditor({
  type,
  config,
  questionId,
  onSaved,
}: {
  type: string;
  config: Record<string, unknown> | null;
  questionId: string;
  onSaved: () => void;
}) {
  if (type === "mcq" || type === "multi") {
    return (
      <McqAnswerEditor
        type={type as "mcq" | "multi"}
        config={config}
        questionId={questionId}
        onSaved={onSaved}
      />
    );
  }
  if (type === "true_false_notgiven") {
    return (
      <TfngAnswerEditor config={config} questionId={questionId} onSaved={onSaved} />
    );
  }
  // Fallback for types without a dedicated editor — keep the existing
  // read-only preview so instructor at least sees the answer.
  return (
    <div className="space-y-2">
      <AnswerPreview type={type} config={config} />
      <p className="text-[10px] text-faint">
        Loại này chưa hỗ trợ sửa đáp án inline trong bank. Xoá + tạo lại nếu
        cần đổi đáp án.
      </p>
    </div>
  );
}

function McqAnswerEditor({
  type,
  config,
  questionId,
  onSaved,
}: {
  type: "mcq" | "multi";
  config: Record<string, unknown> | null;
  questionId: string;
  onSaved: () => void;
}) {
  const initial = ((config?.options as Array<{
    id?: string;
    label?: string;
    isCorrect?: boolean;
  }>) ?? []).map((o, i) => ({
    id: o.id ?? `opt-${i}-${Math.random().toString(36).slice(2, 8)}`,
    label: o.label ?? "",
    isCorrect: !!o.isCorrect,
  }));
  const [options, setOptions] = useState(
    initial.length > 0
      ? initial
      : [
          { id: cryptoIdLocal(), label: "", isCorrect: true },
          { id: cryptoIdLocal(), label: "", isCorrect: false },
        ],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const correctCount = options.filter((o) => o.isCorrect).length;
  const dirty = !sameOptions(initial, options);
  const validMcq = type === "mcq" ? correctCount === 1 : correctCount >= 1;
  const validLabels = options.every((o) => o.label.trim() !== "");

  function toggleCorrect(idx: number) {
    setOptions((curr) =>
      curr.map((o, i) => {
        if (type === "mcq") return { ...o, isCorrect: i === idx };
        return i === idx ? { ...o, isCorrect: !o.isCorrect } : o;
      }),
    );
  }
  function setLabel(idx: number, v: string) {
    setOptions((curr) => curr.map((o, i) => (i === idx ? { ...o, label: v } : o)));
  }
  function addOption() {
    setOptions((curr) => [...curr, { id: cryptoIdLocal(), label: "", isCorrect: false }]);
  }
  function removeOption(idx: number) {
    setOptions((curr) => curr.filter((_, i) => i !== idx));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const newConfig = {
        ...(config ?? {}),
        options: options.map((o) => ({
          id: o.id,
          label: o.label.trim(),
          isCorrect: o.isCorrect,
        })),
      };
      const r = await fetch(`/api/bank-questions/${questionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: newConfig }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Đáp án ({type === "mcq" ? "1 đúng" : "≥1 đúng"})
        </div>
        {dirty && (
          <span className="text-[10px] text-amber-700">Chưa lưu</span>
        )}
      </div>
      <ul className="space-y-1">
        {options.map((o, i) => (
          <li
            key={o.id}
            className={`flex items-center gap-1.5 rounded px-2 py-1 ${
              o.isCorrect ? "bg-emerald-100" : "bg-white"
            }`}
          >
            <input
              type={type === "mcq" ? "radio" : "checkbox"}
              name={`correct-${questionId}`}
              checked={o.isCorrect}
              onChange={() => toggleCorrect(i)}
              className="h-3.5 w-3.5 accent-emerald-600"
              aria-label={o.isCorrect ? "Đáp án đúng" : "Đáp án sai"}
            />
            <input
              type="text"
              value={o.label}
              onChange={(e) => setLabel(i, e.target.value)}
              placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
              className="flex-1 rounded border border-default bg-white px-1.5 py-0.5 text-xs"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                aria-label="Xoá option"
                className="text-xs text-faint hover:text-danger-600"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addOption}
          className="text-[11px] text-blue-600 hover:underline"
        >
          + Thêm phương án
        </button>
        <div className="flex items-center gap-2">
          {!validMcq && (
            <span className="text-[10px] text-amber-700">
              {type === "mcq" ? "Cần đúng 1 đáp án đúng" : "Cần ≥1 đáp án đúng"}
            </span>
          )}
          {!validLabels && (
            <span className="text-[10px] text-amber-700">Còn nhãn trống</span>
          )}
          <button
            type="button"
            disabled={busy || !dirty || !validMcq || !validLabels}
            onClick={save}
            className="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Đang lưu..." : "Lưu đáp án"}
          </button>
        </div>
      </div>
      {err && (
        <div className="mt-1.5 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
          ⚠ {err}
        </div>
      )}
    </div>
  );
}

function TfngAnswerEditor({
  config,
  questionId,
  onSaved,
}: {
  config: Record<string, unknown> | null;
  questionId: string;
  onSaved: () => void;
}) {
  const initial = typeof config?.correct === "string" ? (config.correct as string) : "true";
  const [correct, setCorrect] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = correct !== initial;
  const LABEL: Record<string, string> = {
    true: "Đúng",
    false: "Sai",
    not_given: "Không đề cập",
  };

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/bank-questions/${questionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: { ...(config ?? {}), correct } }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Đáp án đúng
        </div>
        {dirty && <span className="text-[10px] text-amber-700">Chưa lưu</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["true", "false", "not_given"] as const).map((v) => (
          <label
            key={v}
            className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs ${
              correct === v
                ? "border-emerald-500 bg-emerald-100 font-semibold text-emerald-800"
                : "border-default bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={`tfng-${questionId}`}
              checked={correct === v}
              onChange={() => setCorrect(v)}
              className="h-3 w-3 accent-emerald-600"
            />
            {LABEL[v]}
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Đang lưu..." : "Lưu đáp án"}
        </button>
      </div>
      {err && (
        <div className="mt-1.5 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
          ⚠ {err}
        </div>
      )}
    </div>
  );
}

function sameOptions(
  a: Array<{ id: string; label: string; isCorrect: boolean }>,
  b: Array<{ id: string; label: string; isCorrect: boolean }>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.id !== y.id || x.label !== y.label || x.isCorrect !== y.isCorrect) return false;
  }
  return true;
}

function cryptoIdLocal(): string {
  // Stable enough for client-side option keys; server normalises on save.
  return `opt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Delete question button ─────────────────────────────────────────────────
//
// Trash icon in DetailPanel header. 2-step confirm: warn before delete; if
// server returns 409 bank_question_in_use, ask for force confirm and retry
// with ?force=true. Same pattern as DeleteBankButton in BankListClient.

function DeleteQuestionButton({
  questionId,
  promptHint,
  onDeleted,
}: {
  questionId: string;
  promptHint: string;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    const preview = promptHint.length > 60 ? promptHint.slice(0, 60) + "…" : promptHint;
    if (
      !confirm(
        `Xoá câu hỏi này khỏi ngân hàng?\n\n"${preview}"\n\nMọi version + skill tag + stats trong bank sẽ bị xoá theo. Không thể khôi phục.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      let r = await fetch(`/api/bank-questions/${questionId}`, { method: "DELETE" });
      if (r.status === 409) {
        const body = (await r.json().catch(() => null)) as
          | { error?: string; details?: { usedCount?: number } }
          | null;
        const used = body?.details?.usedCount ?? "một số";
        const ok = confirm(
          `Câu hỏi này đã được copy vào ${used} đề thi. Xoá sẽ mất link giữa đề và bank (đề vẫn giữ bản sao câu hỏi). Vẫn xoá?`,
        );
        if (!ok) {
          setBusy(false);
          return;
        }
        r = await fetch(`/api/bank-questions/${questionId}?force=true`, {
          method: "DELETE",
        });
      }
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        alert(`Xoá thất bại: ${body?.error ?? r.statusText}`);
        setBusy(false);
        return;
      }
      await onDeleted();
    } catch {
      alert("Lỗi mạng — thử lại");
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-label="Xoá câu hỏi"
      title="Xoá câu hỏi khỏi ngân hàng"
      className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      🗑
    </button>
  );
}
