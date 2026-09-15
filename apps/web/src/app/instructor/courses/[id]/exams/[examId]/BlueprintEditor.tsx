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
  bankIds?: string[];
  cells: InitialCell[];
  totalCount: number;
}

type Bank = { id: string; name: string };

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
  // Số câu published (≤ count). Pool sample chỉ rút câu published nên đây mới
  // là số "khả dụng" thực sự. Khi 0 → cảnh báo instructor.
  publishedCount?: number;
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

/**
 * Topic-mode matrix row: 1 row = 1 chủ đề, 3 ô số câu cho M1/M2/M3.
 *
 * M-level → (cognitiveLevel × difficulty) mapping — đồng nhất với converter
 * convert-knm-to-template.js (M1=remember,diff2 · M2=understand,diff3 · M3=apply,diff4).
 */
type MLevel = "M1" | "M2" | "M3";
const M_LEVELS: MLevel[] = ["M1", "M2", "M3"];
const M_MAP: Record<MLevel, { cognitiveLevel: CognitiveLevel; difficulty: number; label: string }> = {
  M1: { cognitiveLevel: "remember_understand", difficulty: 2, label: "M1 — Nhận biết" },
  M2: { cognitiveLevel: "remember_understand", difficulty: 3, label: "M2 — Thông hiểu" },
  M3: { cognitiveLevel: "apply", difficulty: 4, label: "M3 — Vận dụng" },
};

interface TopicRow {
  id: string;
  topic: string;
  m1: number;
  m2: number;
  m3: number;
}

let topicRowCounter = 0;
const nextTopicRowId = () => `row-${++topicRowCounter}`;

/** Tìm M-level từ (cogLevel, difficulty) — dùng khi reverse-map initialBlueprint cells. */
function cellToMLevel(
  cog: CognitiveLevel | undefined,
  diff: number | undefined,
): MLevel | null {
  for (const m of M_LEVELS) {
    const def = M_MAP[m];
    if (def.cognitiveLevel === cog && def.difficulty === diff) return m;
  }
  return null;
}

export default function BlueprintEditor({
  examId,
  lessonTree,
  initialBlueprint,
  onDone,
}: {
  examId: string;
  lessonTree: ModuleNode[];
  initialBlueprint: InitialBlueprint | null;
  onDone?: () => void;
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

  // ── topic_only state — matrix Topic × M1/M2/M3 ────────────────────────
  const [topicRows, setTopicRows] = useState<TopicRow[]>(() => {
    if (initialBlueprint?.mode === "topic_only") {
      // Reverse-map: gộp nhiều cells cùng topic vào 1 row, mỗi cell tương ứng 1 M-level.
      const byTopic = new Map<string, TopicRow>();
      for (const c of initialBlueprint.cells) {
        if (!c.topic) continue;
        const m = cellToMLevel(c.cognitiveLevel, c.difficulty);
        if (!m) continue; // cells không khớp M-mapping bị bỏ qua (legacy)
        const row = byTopic.get(c.topic) ?? {
          id: nextTopicRowId(),
          topic: c.topic,
          m1: 0,
          m2: 0,
          m3: 0,
        };
        row[m.toLowerCase() as "m1" | "m2" | "m3"] = c.count;
        byTopic.set(c.topic, row);
      }
      return [...byTopic.values()];
    }
    return [];
  });

  // ── Ngân hàng câu hỏi — GV chọn 1 ngân hàng cụ thể để thiết kế ma trận,
  // thay vì auto-scope mọi ngân hàng GV có quyền trong khoá (hành vi cũ).
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState(() => initialBlueprint?.bankIds?.[0] ?? "");
  useEffect(() => {
    fetch("/api/question-banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { banks: Bank[] } | null) => {
        if (!j) return;
        setBanks(j.banks);
        setBankId((cur) => cur || (j.banks.length === 1 ? j.banks[0]!.id : ""));
      });
  }, []);

  const handleBankChange = (id: string) => {
    setBankId(id);
    // Đổi ngân hàng → chủ đề của ngân hàng cũ không còn ý nghĩa, reset lại.
    setTopicRows([]);
  };

  const [availableTopics, setAvailableTopics] = useState<TopicEntry[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // Load distinct topics in scope on mount + khi đổi mode/ngân hàng.
  useEffect(() => {
    if (mode !== "topic_only") return;
    let cancelled = false;
    setTopicsLoading(true);
    const url = bankId
      ? `/api/exams/${examId}/blueprint/topics?bankId=${bankId}`
      : `/api/exams/${examId}/blueprint/topics`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((j: { topics: TopicEntry[] }) => {
        if (!cancelled) setAvailableTopics(j.topics);
      })
      .finally(() => !cancelled && setTopicsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [examId, mode, bankId]);

  // Mặc định đưa hết chủ đề có sẵn vào ma trận — GV bớt đi thay vì phải tự
  // thêm từng chủ đề, đỡ 1 bước cho trường hợp phổ biến "rải đều mọi chủ đề".
  // Không ghi đè nếu đã có dòng (từ blueprint đã lưu, hoặc GV đã tự chỉnh).
  useEffect(() => {
    if (mode !== "topic_only" || availableTopics.length === 0) return;
    setTopicRows((rows) =>
      rows.length > 0
        ? rows
        : availableTopics.map((t) => ({
            id: nextTopicRowId(),
            topic: t.topic,
            m1: 0,
            m2: 0,
            m3: 0,
          })),
    );
  }, [mode, availableTopics]);

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
    return topicRows.reduce(
      (s, r) => s + (r.m1 || 0) + (r.m2 || 0) + (r.m3 || 0),
      0,
    );
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
    // topic_only: mỗi row → up to 3 cells (M1/M2/M3), bỏ ô = 0.
    const cells: Array<{
      topic: string;
      cognitiveLevel: CognitiveLevel;
      difficulty: number;
      count: number;
    }> = [];
    for (const r of topicRows) {
      const t = r.topic.trim();
      if (!t) continue;
      for (const m of M_LEVELS) {
        const count = r[m.toLowerCase() as "m1" | "m2" | "m3"];
        if (!count || count <= 0) continue;
        const def = M_MAP[m];
        cells.push({
          topic: t,
          cognitiveLevel: def.cognitiveLevel,
          difficulty: def.difficulty,
          count,
        });
      }
    }
    return cells;
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
          : { mode, cells, bankIds: bankId ? [bankId] : undefined };
      const r = await fetch(`/api/exams/${examId}/blueprint/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) setPreview(await r.json());
    } finally {
      setPreviewLoading(false);
    }
  }, [examId, mode, selectedLessons, totalCount, buildCells, bankId]);

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
    setTopicRows((rows) => {
      // Tránh duplicate topic — quick-add chip click 2 lần cùng chủ đề.
      if (topic && rows.some((r) => r.topic === topic)) return rows;
      return [
        ...rows,
        { id: nextTopicRowId(), topic, m1: 0, m2: 0, m3: 0 },
      ];
    });
  };
  const updateTopicRow = (id: string, patch: Partial<TopicRow>) => {
    setTopicRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeTopicRow = (id: string) => {
    setTopicRows((rows) => rows.filter((r) => r.id !== id));
  };
  const removeTopicRowByTopic = (topic: string) => {
    setTopicRows((rows) => rows.filter((r) => r.topic !== topic));
  };

  // Chủ đề đã có dòng trong ma trận — mặc định là TẤT CẢ (xem effect default
  // all ở trên); GV bấm chip để bỏ bớt, không phải để thêm.
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
          : { mode, cells, bankIds: bankId ? [bankId] : [] };
      const r = await fetch(`/api/exams/${examId}/blueprint`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        setFlash({ ok: false, msg: "Lưu thất bại." });
        return;
      }
      setFlash({ ok: true, msg: "Đã lưu ma trận đề." });
      setTimeout(() => setFlash(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ── Assemble ─────────────────────────────────────────────────────────
  // Tạo pool xong phải chốt luôn thành câu hỏi thật (giống RandomFromBankPanel.onChot)
  // — để lại pool "random_from_bank" chưa chốt thì học viên không thấy được câu nào
  // (màn thi chưa đọc resolutionMode kiểu sample-lúc-vào-thi).
  const handleAssemble = async () => {
    setAssembling(true);
    try {
      const r = await fetch(`/api/exams/${examId}/blueprint/assemble`, { method: "POST" });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setFlash({ ok: false, msg: j?.error ?? "Tạo pool thất bại." });
        return;
      }
      const { sectionId } = (await r.json()) as {
        sectionId: string;
        replaced: boolean;
        totalCount: number;
      };
      const r2 = await fetch(`/api/exams/${examId}/sections/${sectionId}/import-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r2.ok) {
        const j = (await r2.json().catch(() => null)) as { error?: string } | null;
        setFlash({ ok: false, msg: j?.error ?? "Chốt câu hỏi thất bại." });
        return;
      }
      const { imported } = (await r2.json()) as { imported: number };
      setFlash({ ok: true, msg: `Đã thêm ${imported} câu vào đề.` });
      window.dispatchEvent(new Event("fbm:exam-sections-changed"));
      onDone?.();
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
        "Đổi chế độ sẽ làm mất dữ liệu ma trận đề hiện tại (chưa lưu thì mất luôn, đã lưu thì sẽ bị ghi đè khi bấm Lưu). Tiếp tục?",
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

  /**
   * For topic mode matrix: tra availability per (topic, M-level).
   * Trả về AvailabilityCell tương ứng cell preview (đã có sẵn topic+cog+diff).
   */
  const topicCellAvailability = (
    topic: string,
    m: MLevel,
  ): AvailabilityCell | undefined => {
    if (!preview) return undefined;
    const def = M_MAP[m];
    return preview.cells.find(
      (c) =>
        c.topic === topic.trim() &&
        c.cognitiveLevel === def.cognitiveLevel &&
        c.difficulty === def.difficulty,
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Thiết kế đề theo ma trận đề thi</h2>
        <p className="mt-0.5 text-xs text-faint">
          Tổng: <strong className="text-slate-700">{totalCount}</strong> câu.
        </p>
      </div>

      {/* Ngân hàng câu hỏi — chọn trước, mọi thứ bên dưới (chủ đề, xem trước
          khả dụng, tạo pool) đều bám theo đúng ngân hàng này. */}
      {banks.length > 1 && (
        <label className="block max-w-md">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-faint">
            Ngân hàng câu hỏi
          </span>
          <select
            value={bankId}
            onChange={(e) => handleBankChange(e.target.value)}
            className="w-full rounded-lg border border-default bg-white px-4 py-2.5 text-sm font-medium"
          >
            <option value="">Tất cả ngân hàng</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Chế độ (radio) + hành động */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ModeRadio active={mode === "skill_matrix"} onClick={() => switchMode("skill_matrix")}>
            Bloom × Độ khó
          </ModeRadio>
          <ModeRadio active={mode === "topic_only"} onClick={() => switchMode("topic_only")}>
            Theo chủ đề
          </ModeRadio>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || totalCount === 0}
            className="rounded-md border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu ma trận đề"}
          </button>
          <button
            onClick={handleAssemble}
            disabled={assembling || totalCount === 0}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {assembling ? "Đang tạo…" : "Tạo pool từ ma trận đề"}
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
              <strong>Tạo pool từ ma trận đề</strong> để tạo section ngẫu nhiên.
            </p>
          </div>
        </div>
      ) : (
        // ════════════════════════════════════════════════════════════════
        // topic_only mode
        // ════════════════════════════════════════════════════════════════
        <div className="space-y-3">
          {/* Chủ đề — panel dropdown 2 cột, cùng kiểu với "Chọn nhanh theo tiêu chí" */}
          {availableTopics.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Chủ đề</span>
                <button
                  type="button"
                  onClick={() => {
                    if (usedTopicSet.size === availableTopics.length) {
                      setTopicRows([]);
                      return;
                    }
                    // Chỉ thêm dòng cho chủ đề còn thiếu — giữ nguyên số liệu
                    // đã nhập ở các dòng đang có, không ghi đè về 0.
                    setTopicRows((rows) => {
                      const existing = new Set(rows.map((r) => r.topic));
                      const additions = availableTopics
                        .filter((t) => !existing.has(t.topic))
                        .map((t) => ({ id: nextTopicRowId(), topic: t.topic, m1: 0, m2: 0, m3: 0 }));
                      return [...rows, ...additions];
                    });
                  }}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  {usedTopicSet.size === availableTopics.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              </div>
              <div className="mt-1.5 overflow-hidden rounded-lg border border-default">
                <div className="flex items-center justify-between border-b border-default bg-slate-50 px-3.5 py-2 text-xs text-faint">
                  <span>
                    {usedTopicSet.size}/{availableTopics.length} chủ đề đã chọn
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-2 p-2 sm:grid-cols-2">
                  {availableTopics.map((t) => {
                    const used = usedTopicSet.has(t.topic);
                    const pub = t.publishedCount ?? t.count;
                    const noPub = pub === 0;
                    return (
                      <label
                        key={t.topic}
                        className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-sm ${
                          noPub ? "text-amber-800" : "text-slate-800"
                        }`}
                        title={
                          noPub
                            ? `${t.count} câu nhưng 0 đã publish — sẽ không rút được khi tạo pool`
                            : `${pub}/${t.count} câu đã publish`
                        }
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={() =>
                            used ? removeTopicRowByTopic(t.topic) : addTopicRow(t.topic)
                          }
                          className="h-[18px] w-[18px] shrink-0 accent-brand-600"
                        />
                        {noPub && <span aria-hidden>⚠</span>}
                        {t.topic}
                        <span className="text-xs text-faint">
                          ({pub}
                          {pub !== t.count ? `/${t.count}` : ""})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {availableTopics.some((t) => (t.publishedCount ?? t.count) === 0) && (
                <p className="mt-2 text-[11px] text-amber-700">
                  ⚠ Chủ đề đánh dấu vàng có câu nhưng chưa publish. Pool chỉ rút câu đã publish —
                  hãy <strong>publish câu hỏi ở ngân hàng</strong> trước khi tạo pool.
                </p>
              )}
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

          {/* Topic × M-level matrix */}
          <div className="overflow-x-auto rounded border border-default">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border-b border-r border-default px-3 py-2 text-left font-medium text-slate-500">
                    Chủ đề
                  </th>
                  {M_LEVELS.map((m) => (
                    <th
                      key={m}
                      className="border-b border-default px-3 py-2 text-center font-medium text-slate-600"
                      title={M_MAP[m].label}
                    >
                      {m}
                      <div className="text-[10px] font-normal text-faint">
                        {M_MAP[m].label.split("—")[1]?.trim()}
                      </div>
                    </th>
                  ))}
                  <th className="border-b border-l border-default px-3 py-2 text-center font-medium text-slate-500">
                    Tổng
                  </th>
                  <th className="border-b border-default px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {topicRows.length === 0 && (
                  <tr>
                    <td colSpan={M_LEVELS.length + 3} className="px-3 py-6 text-center text-xs text-faint">
                      Chưa có dòng nào. Click chip chủ đề ở trên hoặc bấm{" "}
                      <strong>+ Thêm dòng</strong> ở dưới.
                    </td>
                  </tr>
                )}
                {topicRows.map((row) => {
                  const rowTotal = (row.m1 || 0) + (row.m2 || 0) + (row.m3 || 0);
                  return (
                    <tr key={row.id} className="border-b border-default last:border-b-0">
                      <td className="border-r border-default px-2 py-1">
                        <select
                          value={row.topic}
                          onChange={(e) => updateTopicRow(row.id, { topic: e.target.value })}
                          className="w-full rounded border border-default bg-white px-2 py-1 text-xs"
                        >
                          <option value="">— chọn chủ đề —</option>
                          {availableTopics.map((t) => (
                            <option key={t.topic} value={t.topic}>
                              {t.topic} ({t.publishedCount ?? t.count})
                            </option>
                          ))}
                          {row.topic && !availableTopics.some((t) => t.topic === row.topic) && (
                            <option value={row.topic}>{row.topic} (không còn)</option>
                          )}
                        </select>
                      </td>
                      {M_LEVELS.map((m) => {
                        const key = m.toLowerCase() as "m1" | "m2" | "m3";
                        const count = row[key] ?? 0;
                        const avail = topicCellAvailability(row.topic, m);
                        const hasDeficit = avail && avail.deficit > 0 && count > 0;
                        return (
                          <td
                            key={m}
                            className={`px-1 py-1 text-center [&+td]:border-l border-default ${hasDeficit ? "bg-amber-50" : ""}`}
                          >
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={count || ""}
                              placeholder="0"
                              onChange={(e) =>
                                updateTopicRow(row.id, {
                                  [key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                })
                              }
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
                                title={`Khả dụng: ${avail.available}/${count}`}
                              >
                                {avail.deficit > 0 ? `⚠ −${avail.deficit}` : `✓ ${avail.available}`}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-l border-default px-3 py-2 text-center font-medium text-slate-700">
                        {rowTotal || "–"}
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
                {/* Footer: column totals per M-level + grand total */}
                <tr className="bg-slate-50 font-medium">
                  <td className="border-r border-t border-default px-3 py-2 text-slate-500">
                    Tổng
                  </td>
                  {M_LEVELS.map((m) => {
                    const key = m.toLowerCase() as "m1" | "m2" | "m3";
                    const colTotal = topicRows.reduce((s, r) => s + (r[key] || 0), 0);
                    return (
                      <td
                        key={m}
                        className="border-t border-default px-3 py-2 text-center text-slate-700"
                      >
                        {colTotal || "–"}
                      </td>
                    );
                  })}
                  <td className="border-l border-t border-default px-3 py-2 text-center text-blue-700">
                    {totalCount}
                  </td>
                  <td className="border-t border-default" />
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
            Mỗi ô = số câu rút ngẫu nhiên cho (chủ đề × M-level). M1 = Nhận biết · M2 = Thông hiểu
            · M3 = Vận dụng. Scope: toàn bộ ngân hàng bạn có quyền trong khoá. Pool chỉ rút câu đã
            publish.
          </p>
        </div>
      )}
    </div>
  );
}

function ModeRadio({
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
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-brand-600 bg-brand-50 text-slate-900"
          : "border-default bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
          active ? "border-brand-600" : "border-slate-400"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
      </span>
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
