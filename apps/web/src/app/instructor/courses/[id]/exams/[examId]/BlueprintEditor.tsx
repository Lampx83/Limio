"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CognitiveLevel = "remember_understand" | "apply" | "analyze_plus";

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

interface BlueprintCell {
  cognitiveLevel: CognitiveLevel;
  difficulty: number;
  count: number;
}

interface InitialBlueprint {
  lessonIds: string[];
  cells: BlueprintCell[];
  totalCount: number;
}

interface CellAvailability {
  cognitiveLevel: CognitiveLevel;
  difficulty: number;
  count: number;
  available: number;
  deficit: number;
}

interface PreviewResult {
  totalRequested: number;
  totalAvailable: number;
  cells: CellAvailability[];
  deficits: CellAvailability[];
  emptyScope: boolean;
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

  // ── State ─────────────────────────────────────────────────────────────
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(
    () => new Set(initialBlueprint?.lessonIds ?? []),
  );

  // Grid: map of "cognitiveLevel::difficulty" → count
  const [grid, setGrid] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const cl of COGNITIVE_LEVELS) {
      for (let d = 1; d <= 5; d++) {
        map[cellKey(cl, d)] = 0;
      }
    }
    if (initialBlueprint) {
      for (const cell of initialBlueprint.cells) {
        map[cellKey(cell.cognitiveLevel as CognitiveLevel, cell.difficulty)] =
          cell.count;
      }
    }
    return map;
  });

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalCount = Object.values(grid).reduce((s, v) => s + (v || 0), 0);

  // ── Preview fetch (debounced) ─────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    if (selectedLessons.size === 0 || totalCount === 0) {
      setPreview(null);
      return;
    }
    const cells: BlueprintCell[] = [];
    for (const cl of COGNITIVE_LEVELS) {
      for (let d = 1; d <= 5; d++) {
        const count = grid[cellKey(cl, d)] ?? 0;
        if (count > 0) cells.push({ cognitiveLevel: cl, difficulty: d, count });
      }
    }
    setPreviewLoading(true);
    try {
      const r = await fetch(`/api/exams/${examId}/blueprint/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonIds: [...selectedLessons], cells }),
      });
      if (r.ok) setPreview(await r.json());
    } finally {
      setPreviewLoading(false);
    }
  }, [examId, selectedLessons, grid, totalCount]);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => void fetchPreview(), 400);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
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

  // ── Grid editing ──────────────────────────────────────────────────────
  const setCell = (cl: CognitiveLevel, d: number, raw: string) => {
    const val = Math.max(0, parseInt(raw, 10) || 0);
    setGrid((g) => ({ ...g, [cellKey(cl, d)]: val }));
  };

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (selectedLessons.size === 0) {
      setFlash({ ok: false, msg: "Chọn ít nhất 1 bài học." });
      return;
    }
    if (totalCount === 0) {
      setFlash({ ok: false, msg: "Nhập ít nhất 1 câu vào bảng." });
      return;
    }
    const cells: BlueprintCell[] = [];
    for (const cl of COGNITIVE_LEVELS) {
      for (let d = 1; d <= 5; d++) {
        const count = grid[cellKey(cl, d)] ?? 0;
        if (count > 0) cells.push({ cognitiveLevel: cl, difficulty: d, count });
      }
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/exams/${examId}/blueprint`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonIds: [...selectedLessons], cells }),
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
      const r = await fetch(`/api/exams/${examId}/blueprint/assemble`, {
        method: "POST",
      });
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

  // ── Deficit lookup ────────────────────────────────────────────────────
  const deficitMap = new Map(
    (preview?.cells ?? []).map((c) => [
      cellKey(c.cognitiveLevel, c.difficulty),
      c,
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Blueprint (Bảng đặc trưng đề thi)</h2>
          <p className="mt-0.5 text-xs text-faint">
            Chỉ định số câu theo mức tư duy × độ khó. Tổng: {" "}
            <strong>{totalCount}</strong> câu.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || totalCount === 0 || selectedLessons.size === 0}
            className="rounded border border-default px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu blueprint"}
          </button>
          <button
            onClick={handleAssemble}
            disabled={assembling || totalCount === 0 || selectedLessons.size === 0}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {assembling ? "Đang tạo..." : "Tạo pool từ blueprint"}
          </button>
        </div>
      </div>

      {flash && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            flash.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {flash.msg}
        </div>
      )}

      <div className="grid grid-cols-[220px_1fr] gap-6">
        {/* ── Lesson selector ── */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Bài học
            </span>
            <button
              onClick={() =>
                setSelectedLessons(
                  selectedLessons.size === allLessonIds.length
                    ? new Set()
                    : new Set(allLessonIds),
                )
              }
              className="text-xs text-blue-600 hover:underline"
            >
              {selectedLessons.size === allLessonIds.length ? "Bỏ tất cả" : "Chọn tất cả"}
            </button>
          </div>
          {lessonTree.map((mod) => {
            const enabled = mod.lessons.filter((l) => l.bankCount > 0);
            const allOn = enabled.length > 0 && enabled.every((l) => selectedLessons.has(l.id));
            return (
              <div key={mod.id} className="rounded border border-default bg-white p-2">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleModule(mod)}
                    className="h-3 w-3"
                  />
                  {mod.title}
                </label>
                <div className="mt-1 space-y-0.5 pl-4">
                  {mod.lessons.map((l) => (
                    <label
                      key={l.id}
                      className={`flex cursor-pointer items-center gap-1.5 text-xs ${
                        l.bankCount === 0 ? "cursor-not-allowed opacity-50" : "text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLessons.has(l.id)}
                        disabled={l.bankCount === 0}
                        onChange={() => toggleLesson(l.id)}
                        className="h-3 w-3"
                      />
                      <span className="flex-1 truncate">{l.title}</span>
                      <span className="shrink-0 text-faint">({l.bankCount})</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        {/* ── Grid ── */}
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
                        const avail = deficitMap.get(key);
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
                {/* Footer row: column totals */}
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

          {/* Preview summary */}
          {totalCount > 0 && (
            <div className="mt-3">
              {previewLoading ? (
                <p className="text-xs text-faint">Đang kiểm tra ngân hàng...</p>
              ) : preview ? (
                preview.emptyScope ? (
                  <p className="text-xs text-amber-700">
                    ⚠ Chưa có bank hoặc skill được tag. Kiểm tra ContentSkillMapping.
                  </p>
                ) : (
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-600">
                      Pool: <strong>{preview.totalAvailable}</strong> /{" "}
                      <strong>{preview.totalRequested}</strong> câu có sẵn
                    </span>
                    {preview.deficits.length > 0 ? (
                      <span className="text-amber-700">
                        ⚠ {preview.deficits.length} ô thiếu câu (xem ô màu vàng)
                      </span>
                    ) : (
                      <span className="text-emerald-700">✓ Đủ câu hỏi</span>
                    )}
                  </div>
                )
              ) : null}
            </div>
          )}

          <p className="mt-2 text-[11px] text-faint">
            Nhập số câu vào từng ô. Sau khi lưu, bấm{" "}
            <strong>Tạo pool từ blueprint</strong> để tạo section ngẫu nhiên trên tab Nội dung.
          </p>
        </div>
      </div>
    </div>
  );
}
