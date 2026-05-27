"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type CognitiveLevel = "remember_understand" | "apply" | "analyze_plus";
type Mode = "skill_matrix" | "topic_only";

interface LessonNode {
  id: string;
  title: string;
  bankCount: number;
}
interface ModuleNode {
  id: string;
  title: string;
  lessons: LessonNode[];
}

interface InitialCell {
  cognitiveLevel?: CognitiveLevel;
  difficulty?: number;
  topic?: string;
  count: number;
}

interface InitialBlueprint {
  mode: Mode;
  lessonIds: string[];
  cells: InitialCell[];
  totalCount: number;
}

interface AvailabilityCell {
  cognitiveLevel?: CognitiveLevel;
  difficulty?: number;
  topic?: string;
  count: number;
  available: number;
  deficit: number;
}

interface PreviewResult {
  totalRequested: number;
  totalAvailable: number;
  cells: AvailabilityCell[];
  deficits: AvailabilityCell[];
  emptyScope: boolean;
}

interface TopicEntry {
  topic: string;
  count: number;
}

const COGNITIVE_LEVELS: CognitiveLevel[] = [
  "remember_understand",
  "apply",
  "analyze_plus",
];
const COGNITIVE_LABEL: Record<CognitiveLevel, string> = {
  remember_understand: "Nhớ & Hiểu",
  apply: "Vận dụng",
  analyze_plus: "Phân tích+",
};
const COGNITIVE_TONE: Record<CognitiveLevel, string> = {
  remember_understand: "bg-sky-50 text-sky-700",
  apply: "bg-violet-50 text-violet-700",
  analyze_plus: "bg-orange-50 text-orange-700",
};
const DIFFICULTY_LABEL = ["", "Rất dễ", "Dễ", "Trung bình", "Khó", "Rất khó"];

function cellKey(cl: CognitiveLevel, d: number) {
  return `${cl}::${d}`;
}

interface TopicRow {
  id: string;
  topic: string;
  cognitiveLevel: CognitiveLevel | "";
  difficulty: number | "";
  count: number;
}

let topicRowCounter = 0;
const nextTopicRowId = () => `row-${++topicRowCounter}`;

export default function BlueprintEditor({
  examId,
  lessonTree,
  initialBlueprint,
}: {
  examId: string;
  lessonTree: ModuleNode[];
  initialBlueprint: InitialBlueprint | null;
}) {
  const allLessonIds = lessonTree.flatMap((m) => m.lessons.map((l) => l.id));

  // ── Mode ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>(initialBlueprint?.mode ?? "skill_matrix");

  // ── skill_matrix state ─────────────────────────────────────────────────
  // Lesson picker is temporarily hidden — scope = all lessons in course.
  // Re-enable the sidebar UI to let instructor narrow the scope.
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(
    () => new Set(allLessonIds),
  );

  // Keep selection in sync if lessonTree changes (e.g. lesson added/removed).
  useEffect(() => {
    setSelectedLessons(new Set(allLessonIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLessonIds.join(",")]);

  const [grid, setGrid] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const cl of COGNITIVE_LEVELS) {
      for (let d = 1; d <= 5; d++) map[cellKey(cl, d)] = 0;
    }
    if (initialBlueprint?.mode !== "topic_only" && initialBlueprint) {
      for (const cell of initialBlueprint.cells) {
        if (cell.cognitiveLevel && cell.difficulty) {
          map[cellKey(cell.cognitiveLevel, cell.difficulty)] = cell.count;
        }
      }
    }
    return map;
  });

  // ── topic_only state ───────────────────────────────────────────────────
  const [topicRows, setTopicRows] = useState<TopicRow[]>(() => {
    if (initialBlueprint?.mode === "topic_only") {
      return initialBlueprint.cells
        .filter((c) => c.topic)
        .map((c) => ({
          id: nextTopicRowId(),
          topic: c.topic!,
          cognitiveLevel: c.cognitiveLevel ?? "",
          difficulty: c.difficulty ?? "",
          count: c.count,
        }));
    }
    return [];
  });

  const [availableTopics, setAvailableTopics] = useState<TopicEntry[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // Load distinct topics in scope on mount + when switching to topic mode.
  useEffect(() => {
    if (mode !== "topic_only") return;
    let cancelled = false;
    setTopicsLoading(true);
    fetch(`/api/exams/${examId}/blueprint/topics`)
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((j: { topics: TopicEntry[] }) => {
        if (!cancelled) setAvailableTopics(j.topics);
      })
      .finally(() => !cancelled && setTopicsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [examId, mode]);

  // ── Preview / save / assemble shared state ─────────────────────────────
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived totals
  const totalCount = useMemo(() => {
    if (mode === "skill_matrix") {
      return Object.values(grid).reduce((s, v) => s + (v || 0), 0);
    }
    return topicRows.reduce((s, r) => s + (r.count || 0), 0);
  }, [mode, grid, topicRows]);

  // Build cells payload from current state (used by preview + save).
  const buildCells = useCallback(() => {
    if (mode === "skill_matrix") {
      const cells: { cognitiveLevel: CognitiveLevel; difficulty: number; count: number }[] = [];
      for (const cl of COGNITIVE_LEVELS) {
        for (let d = 1; d <= 5; d++) {
          const count = grid[cellKey(cl, d)] ?? 0;
          if (count > 0) cells.push({ cognitiveLevel: cl, difficulty: d, count });
        }
      }
      return cells;
    }
    return topicRows
      .filter((r) => r.topic.trim() !== "" && r.count > 0)
      .map((r) => ({
        topic: r.topic.trim(),
        ...(r.cognitiveLevel ? { cognitiveLevel: r.cognitiveLevel } : {}),
        ...(typeof r.difficulty === "number" ? { difficulty: r.difficulty } : {}),
        count: r.count,
      }));
  }, [mode, grid, topicRows]);

  // ── Preview fetch (debounced) ─────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    const cells = buildCells();
    if (totalCount === 0 || cells.length === 0) {
      setPreview(null);
      return;
    }
    if (mode === "skill_matrix" && selectedLessons.size === 0) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const body =
        mode === "skill_matrix"
          ? { mode, lessonIds: [...selectedLessons], cells }
          : { mode, cells };
      const r = await fetch(`/api/exams/${examId}/blueprint/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) setPreview(await r.json());
    } finally {
      setPreviewLoading(false);
    }
  }, [examId, mode, selectedLessons, totalCount, buildCells]);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => void fetchPreview(), 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [fetchPreview]);

  // ── Lesson selection ──────────────────────────────────────────────────
  const toggleLesson = (id: string) => {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleModule = (mod: ModuleNode) => {
    const enabledIds = mod.lessons.filter((l) => l.bankCount > 0).map((l) => l.id);
    const allOn = enabledIds.every((id) => selectedLessons.has(id));
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      for (const id of enabledIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  // ── Grid editing (skill_matrix) ───────────────────────────────────────
  const setCell = (cl: CognitiveLevel, d: number, raw: string) => {
    const val = Math.max(0, parseInt(raw, 10) || 0);
    setGrid((g) => ({ ...g, [cellKey(cl, d)]: val }));
  };

  // ── Topic row editing ─────────────────────────────────────────────────
  const addTopicRow = (topic = "") => {
    setTopicRows((rows) => [
      ...rows,
      { id: nextTopicRowId(), topic, cognitiveLevel: "", difficulty: "", count: 0 },
    ]);
  };
  const updateTopicRow = (id: string, patch: Partial<TopicRow>) => {
    setTopicRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeTopicRow = (id: string) => {
    setTopicRows((rows) => rows.filter((r) => r.id !== id));
  };

  // Topics already used in rows (to grey out the "+ Quick-add" chip).
  const usedTopicSet = new Set(topicRows.map((r) => r.topic.trim()).filter(Boolean));

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (mode === "skill_matrix" && selectedLessons.size === 0) {
      setFlash({ ok: false, msg: "Chọn ít nhất 1 bài học." });
      return;
    }
    const cells = buildCells();
    if (cells.length === 0 || totalCount === 0) {
      setFlash({ ok: false, msg: "Nhập ít nhất 1 dòng có số câu > 0." });
      return;
    }
    setSaving(true);
    try {
      const body =
        mode === "skill_matrix"
          ? { mode, lessonIds: [...selectedLessons], cells }
          : { mode, cells };
      const r = await fetch(`/api/exams/${examId}/blueprint`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        setFlash({ ok: false, msg: "Lưu thất bại." });
        return;
      }
      setFlash({ ok: true, msg: "Đã lưu blueprint." });
      setTimeout(() => setFlash(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ── Assemble ─────────────────────────────────────────────────────────
  const handleAssemble = async () => {
    setAssembling(true);
    try {
      const r = await fetch(`/api/exams/${examId}/blueprint/assemble`, { method: "POST" });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setFlash({ ok: false, msg: j?.error ?? "Tạo pool thất bại." });
        return;
      }
      const { replaced, totalCount: tc } = (await r.json()) as {
        replaced: boolean;
        totalCount: number;
      };
      setFlash({
        ok: true,
        msg: `${replaced ? "Đã cập nhật" : "Đã tạo"} pool ngẫu nhiên · ${tc} câu hỏi.`,
      });
      setTimeout(() => setFlash(null), 5000);
    } finally {
      setAssembling(false);
    }
  };

  // ── Switch mode (warn if losing data) ────────────────────────────────
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    const hasData =
      (mode === "skill_matrix" && Object.values(grid).some((v) => v > 0)) ||
      (mode === "topic_only" && topicRows.length > 0);
    if (hasData) {
      const ok = window.confirm(
        "Đổi chế độ sẽ làm mất dữ liệu blueprint hiện tại (chưa lưu thì mất luôn, đã lưu thì sẽ bị ghi đè khi bấm Lưu). Tiếp tục?",
      );
      if (!ok) return;
    }
    setMode(next);
    setPreview(null);
    if (next === "skill_matrix") {
      // Reset topic rows when leaving topic mode.
      setTopicRows([]);
    } else {
      // Reset grid when leaving skill_matrix.
      const empty: Record<string, number> = {};
      for (const cl of COGNITIVE_LEVELS) {
        for (let d = 1; d <= 5; d++) empty[cellKey(cl, d)] = 0;
      }
      setGrid(empty);
    }
  };

  // ── Deficit lookups ───────────────────────────────────────────────────
  const skillDeficitMap = new Map(
    (preview?.cells ?? [])
      .filter((c) => c.cognitiveLevel && c.difficulty)
      .map((c) => [cellKey(c.cognitiveLevel!, c.difficulty!), c]),
  );

  // For topic mode: match by (topic, cognitiveLevel?, difficulty?).
  const topicRowAvailability = (row: TopicRow): AvailabilityCell | undefined => {
    if (!preview) return undefined;
    const rowCl = row.cognitiveLevel === "" ? undefined : row.cognitiveLevel;
    const rowDiff = row.difficulty === "" ? undefined : row.difficulty;
    return preview.cells.find(
      (c) =>
        c.topic === row.topic.trim() &&
        c.cognitiveLevel === rowCl &&
        c.difficulty === rowDiff,
    );
  };

  return (
    <div className="space-y-5">
      {/* Header row: title + mode tabs + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Blueprint (Bảng đặc trưng đề thi)</h2>
          <p className="mt-0.5 text-xs text-faint">
            Tổng: <strong className="text-slate-700">{totalCount}</strong> câu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-default bg-slate-50 p-0.5">
            <ModeTab active={mode === "skill_matrix"} onClick={() => switchMode("skill_matrix")}>
              BLT × Độ khó
            </ModeTab>
            <ModeTab active={mode === "topic_only"} onClick={() => switchMode("topic_only")}>
              Theo chủ đề
            </ModeTab>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || totalCount === 0}
            className="rounded-md border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu blueprint"}
          </button>
          <button
            onClick={handleAssemble}
            disabled={assembling || totalCount === 0}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {assembling ? "Đang tạo…" : "Tạo pool từ blueprint"}
          </button>
        </div>
      </div>

      {flash && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            flash.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {mode === "skill_matrix" ? (
        // ════════════════════════════════════════════════════════════════
        // skill_matrix mode (Bloom × Difficulty)
        // Lesson picker tạm ẩn — scope = tất cả bài học trong khoá.
        // ════════════════════════════════════════════════════════════════
        <div>
          <div>
            <div className="overflow-x-auto rounded border border-default">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border-b border-r border-default px-3 py-2 text-left font-medium text-slate-500">
                      Mức tư duy
                    </th>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <th
                        key={d}
                        className="border-b border-default px-3 py-2 text-center font-medium text-slate-500"
                      >
                        {DIFFICULTY_LABEL[d]}
                        <span className="ml-1 text-[10px] text-faint">({d})</span>
                      </th>
                    ))}
                    <th className="border-b border-l border-default px-3 py-2 text-center font-medium text-slate-500">
                      Tổng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COGNITIVE_LEVELS.map((cl) => {
                    const rowTotal = [1, 2, 3, 4, 5].reduce(
                      (s, d) => s + (grid[cellKey(cl, d)] ?? 0),
                      0,
                    );
                    return (
                      <tr key={cl} className="border-b border-default last:border-b-0">
                        <td
                          className={`border-r border-default px-3 py-2 font-medium ${COGNITIVE_TONE[cl]}`}
                        >
                          {COGNITIVE_LABEL[cl]}
                        </td>
                        {[1, 2, 3, 4, 5].map((d) => {
                          const key = cellKey(cl, d);
                          const count = grid[key] ?? 0;
                          const avail = skillDeficitMap.get(key);
                          const hasDeficit = avail !== undefined && avail.deficit > 0;
                          return (
                            <td
                              key={d}
                              className={`border-default px-1 py-1 text-center [&+td]:border-l ${
                                hasDeficit ? "bg-amber-50" : ""
                              }`}
                            >
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={count || ""}
                                placeholder="0"
                                onChange={(e) => setCell(cl, d, e.target.value)}
                                className={`w-14 rounded border px-1.5 py-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                  hasDeficit
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-default bg-white"
                                }`}
                              />
                              {avail && count > 0 && (
                                <div
                                  className={`mt-0.5 text-[10px] ${
                                    avail.deficit > 0 ? "text-amber-600" : "text-emerald-600"
                                  }`}
                                >
                                  {avail.deficit > 0
                                    ? `⚠ thiếu ${avail.deficit}`
                                    : `✓ ${avail.available}`}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-l border-default px-3 py-2 text-center font-medium">
                          {rowTotal || "–"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-medium">
                    <td className="border-r border-t border-default px-3 py-2 text-slate-500">
                      Tổng
                    </td>
                    {[1, 2, 3, 4, 5].map((d) => {
                      const colTotal = COGNITIVE_LEVELS.reduce(
                        (s, cl) => s + (grid[cellKey(cl, d)] ?? 0),
                        0,
                      );
                      return (
                        <td key={d} className="border-t border-default px-3 py-2 text-center">
                          {colTotal || "–"}
                        </td>
                      );
                    })}
                    <td className="border-l border-t border-default px-3 py-2 text-center text-blue-700">
                      {totalCount}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <PreviewSummary preview={preview} previewLoading={previewLoading} totalCount={totalCount} />
            <p className="mt-2 text-[11px] text-faint">
              Nhập số câu vào từng ô. Sau khi lưu, bấm{" "}
              <strong>Tạo pool từ blueprint</strong> để tạo section ngẫu nhiên.
            </p>
          </div>
        </div>
      ) : (
        // ════════════════════════════════════════════════════════════════
        // topic_only mode
        // ════════════════════════════════════════════════════════════════
        <div className="space-y-3">
          {/* Quick-add chips from existing topics */}
          {availableTopics.length > 0 && (
            <div className="rounded-lg border border-default bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Chủ đề có sẵn ({availableTopics.length})
                </span>
                <span className="text-xs text-faint">
                  Click để thêm vào blueprint
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTopics.map((t) => {
                  const used = usedTopicSet.has(t.topic);
                  return (
                    <button
                      key={t.topic}
                      disabled={used}
                      onClick={() => addTopicRow(t.topic)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${
                        used
                          ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
                          : "border-default bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                      }`}
                      title={used ? "Đã thêm" : `Có ${t.count} câu hỏi`}
                    >
                      {used ? "✓ " : "+ "}
                      {t.topic}
                      <span className="text-[10px] text-faint">({t.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {topicsLoading && availableTopics.length === 0 && (
            <p className="text-xs text-faint">Đang tải danh sách chủ đề…</p>
          )}
          {!topicsLoading && availableTopics.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ Chưa có câu hỏi nào trong các ngân hàng của khoá này được gán chủ đề. Hãy gán chủ đề
              ở Ngân hàng câu hỏi trước.
            </p>
          )}

          {/* Topic rows table */}
          <div className="overflow-x-auto rounded border border-default">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border-b border-default px-3 py-2 text-left font-medium text-slate-500">
                    Chủ đề
                  </th>
                  <th className="border-b border-default px-3 py-2 text-left font-medium text-slate-500">
                    Mức tư duy <span className="text-faint">(tuỳ chọn)</span>
                  </th>
                  <th className="border-b border-default px-3 py-2 text-left font-medium text-slate-500">
                    Độ khó <span className="text-faint">(tuỳ chọn)</span>
                  </th>
                  <th className="border-b border-default px-3 py-2 text-center font-medium text-slate-500">
                    Số câu
                  </th>
                  <th className="border-b border-default px-3 py-2 text-left font-medium text-slate-500">
                    Khả dụng
                  </th>
                  <th className="border-b border-default px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {topicRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-xs text-faint">
                      Chưa có dòng nào. Click chip chủ đề ở trên hoặc bấm{" "}
                      <strong>+ Thêm dòng</strong> ở dưới.
                    </td>
                  </tr>
                )}
                {topicRows.map((row) => {
                  const avail = topicRowAvailability(row);
                  const hasDeficit = avail && avail.deficit > 0 && row.count > 0;
                  return (
                    <tr key={row.id} className="border-b border-default last:border-b-0">
                      <td className={`px-2 py-1 ${hasDeficit ? "bg-amber-50" : ""}`}>
                        <select
                          value={row.topic}
                          onChange={(e) => updateTopicRow(row.id, { topic: e.target.value })}
                          className="w-full rounded border border-default bg-white px-2 py-1 text-xs"
                        >
                          <option value="">— chọn chủ đề —</option>
                          {availableTopics.map((t) => (
                            <option key={t.topic} value={t.topic}>
                              {t.topic} ({t.count})
                            </option>
                          ))}
                          {row.topic && !availableTopics.some((t) => t.topic === row.topic) && (
                            <option value={row.topic}>{row.topic} (không còn)</option>
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={row.cognitiveLevel}
                          onChange={(e) =>
                            updateTopicRow(row.id, {
                              cognitiveLevel: e.target.value as CognitiveLevel | "",
                            })
                          }
                          className="w-full rounded border border-default bg-white px-2 py-1 text-xs"
                        >
                          <option value="">Bất kỳ</option>
                          {COGNITIVE_LEVELS.map((cl) => (
                            <option key={cl} value={cl}>
                              {COGNITIVE_LABEL[cl]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={row.difficulty === "" ? "" : String(row.difficulty)}
                          onChange={(e) =>
                            updateTopicRow(row.id, {
                              difficulty: e.target.value === "" ? "" : parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full rounded border border-default bg-white px-2 py-1 text-xs"
                        >
                          <option value="">Bất kỳ</option>
                          {[1, 2, 3, 4, 5].map((d) => (
                            <option key={d} value={d}>
                              {d} — {DIFFICULTY_LABEL[d]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={row.count || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateTopicRow(row.id, {
                              count: Math.max(0, parseInt(e.target.value, 10) || 0),
                            })
                          }
                          className={`w-16 rounded border px-1.5 py-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                            hasDeficit
                              ? "border-amber-300 bg-amber-50"
                              : "border-default bg-white"
                          }`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        {avail && row.count > 0 ? (
                          avail.deficit > 0 ? (
                            <span className="text-amber-700">
                              ⚠ {avail.available}/{row.count} · thiếu {avail.deficit}
                            </span>
                          ) : (
                            <span className="text-emerald-700">✓ {avail.available} có sẵn</span>
                          )
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => removeTopicRow(row.id)}
                          className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Xoá dòng"
                          aria-label="Xoá dòng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-medium">
                  <td colSpan={3} className="px-3 py-2 text-slate-500">
                    Tổng
                  </td>
                  <td className="px-3 py-2 text-center text-blue-700">{totalCount}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>

          <button
            onClick={() => addTopicRow()}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-default px-3 py-1.5 text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm dòng
          </button>

          <PreviewSummary preview={preview} previewLoading={previewLoading} totalCount={totalCount} />

          <p className="text-[11px] text-faint">
            Mỗi dòng = 1 ràng buộc. Chỉ điền số câu → rút ngẫu nhiên trong chủ đề đó. Thêm BLT/độ
            khó để siết phạm vi. Scope: toàn bộ ngân hàng bạn có quyền trong khoá.
          </p>
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function PreviewSummary({
  preview,
  previewLoading,
  totalCount,
}: {
  preview: PreviewResult | null;
  previewLoading: boolean;
  totalCount: number;
}) {
  if (totalCount === 0) return null;
  return (
    <div className="mt-3">
      {previewLoading ? (
        <p className="text-xs text-faint">Đang kiểm tra ngân hàng…</p>
      ) : preview ? (
        preview.emptyScope ? (
          <p className="text-xs text-amber-700">
            ⚠ Chưa có ngân hàng/scope phù hợp.
          </p>
        ) : (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-600">
              Pool: <strong>{preview.totalAvailable}</strong> /{" "}
              <strong>{preview.totalRequested}</strong> câu có sẵn
            </span>
            {preview.deficits.length > 0 ? (
              <span className="text-amber-700">
                ⚠ {preview.deficits.length} dòng thiếu câu
              </span>
            ) : (
              <span className="text-emerald-700">✓ Đủ câu hỏi</span>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}
