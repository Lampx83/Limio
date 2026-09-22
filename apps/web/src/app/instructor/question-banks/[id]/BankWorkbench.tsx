"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ImportMcqModal from "@/components/instructor/ImportMcqModal";
import TopicCombobox from "@/components/instructor/TopicCombobox";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { apiUrl } from "@/lib/apiUrl";

type Status = "draft" | "published" | "archived";
type CognitiveLevel = "remember_understand" | "apply" | "analyze_plus";
type QuestionType =
  | "mcq"
  | "multi"
  | "true_false_notgiven"
  | "gap_fill"
  | "short_answer"
  | "essay";
// Đợt 1 (thống nhất nhập câu hỏi Quiz/Bank/Exam): "matching_heading" (P1,
// chưa từng build) đã đổi tên "matching" ở DB/schema, nhưng editor cho các
// loại mới (matching/ordering/numerical/drag_drop_fill) chưa có ở đây — chờ
// Đợt 2+ (component nhập câu hỏi dùng chung). Loại chưa có UI vẫn hiện được
// qua fallback "raw config" bên dưới, không rơi vào type cũ đã chết.

type ReviewStatus = "pending" | "approved" | "needs_revision";

type Item = {
  id: string;
  bankId: string;
  bankName: string;
  code: string | null;
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
  // Metadata mở rộng (xem schema.prisma BankQuestion).
  learningOutcome: string | null;
  authorName: string | null;
  reviewStatus: ReviewStatus;
  reviewedAt: string | null;
  reviewedByName: string | null;
  editNote: string | null;
  skillIds: string[];
  createdAt: string;
  updatedAt: string;
  stats: { pValueAvg: number; discriminationAvg: number; totalUses: number } | null;
  exposureCount: number;
  lastSampledAt: string | null;
};

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "Chưa thẩm định",
  approved: "Đã duyệt",
  needs_revision: "Cần sửa",
};
const REVIEW_TONE: Record<ReviewStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-700",
  needs_revision: "bg-rose-100 text-rose-700",
};

type Skill = { id: string; code: string; name: string };

interface ActiveFilters {
  q: string;
  status: Status[];
  cognitiveLevel: CognitiveLevel[];
  difficulty: number[];
  topics: string[];
  reviewStatus: ReviewStatus[];
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
};

const DIFFICULTY_COLOR = ["", "bg-emerald-400", "bg-emerald-400", "bg-yellow-400", "bg-red-400", "bg-red-400"];
const DIFFICULTY_COUNT = [0, 1, 2, 1, 1, 2];
function DifficultyDots({ level }: { level: number }) {
  const color = DIFFICULTY_COLOR[level] ?? "bg-slate-300";
  const count = DIFFICULTY_COUNT[level] ?? 0;
  return <>{Array.from({ length: count }).map((_, i) => <span key={i} className={`inline-block h-2 w-2 rounded-full ${color}`} />)}</>;
}

/**
 * Extract correct-answer preview cho card. Trả compact string như "B" hoặc
 * "A, C" cho MCQ; "Đúng/Sai" cho true_false; null nếu không suy ra được.
 * Dùng config.options[i].id (lowercase a..f) mapped sang A..F.
 */
function correctAnswerPreview(
  type: string,
  config: Record<string, unknown> | null,
): string | null {
  if (!config) return null;
  if (type === "mcq" || type === "multi") {
    const opts = (config as { options?: Array<{ id?: string; isCorrect?: boolean }> })
      .options;
    if (!Array.isArray(opts)) return null;
    const letters = opts
      .filter((o) => o.isCorrect)
      .map((o) => (typeof o.id === "string" ? o.id.toUpperCase() : ""))
      .filter(Boolean);
    return letters.length > 0 ? letters.join(", ") : null;
  }
  if (type === "true_false_notgiven") {
    const v =
      (config as { correct?: unknown; correctValue?: unknown }).correct ??
      (config as { correctValue?: unknown }).correctValue;
    if (v === "true" || v === true) return "Đúng";
    if (v === "false" || v === false) return "Sai";
    if (v === "not_given" || v === "notgiven") return "N/G";
    return null;
  }
  return null;
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
  initialCodePrefix,
  initialItems,
  initialCursor,
  suggestedSkills,
}: {
  bankId: string;
  initialCodePrefix: string | null;
  initialItems: Item[];
  initialCursor: string | null;
  suggestedSkills: Skill[];
}) {
  const [codePrefix, setCodePrefix] = useState<string | null>(initialCodePrefix);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mcqImportOpen, setMcqImportOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── Bulk selection ─────────────────────────────────────────────────────
  // Set lưu id câu đã tick. Reset khi đổi filter.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // ── Panel resize ───────────────────────────────────────────────────────
  // Wide mode: panel ~80% width, ẩn list để focus vào edit.
  const [panelWide, setPanelWide] = useState(false);
  // Drag-resize: panel width in px. Default 384 (w-96). Persisted localStorage.
  const RESIZE_KEY = "fbm-bank-panel-px";
  const [panelPx, setPanelPx] = useState<number>(384);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESIZE_KEY);
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 320 && n <= 1400) setPanelPx(n);
      }
    } catch {}
  }, []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelPx };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const containerW = containerRef.current.getBoundingClientRect().width;
      const delta = dragRef.current.startX - ev.clientX; // kéo trái → panel rộng hơn
      const next = Math.min(
        Math.max(320, dragRef.current.startWidth + delta),
        Math.max(360, containerW - 320), // chừa ≥320px cho list
      );
      setPanelPx(next);
    };
    const onUp = () => {
      try {
        if (dragRef.current) localStorage.setItem(RESIZE_KEY, String(panelPx));
      } catch {}
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  // Persist khi panelPx settle.
  useEffect(() => {
    try {
      localStorage.setItem(RESIZE_KEY, String(panelPx));
    } catch {}
  }, [panelPx]);

  // ── Count metadata ─────────────────────────────────────────────────────
  // totalMatching = số câu khớp filter (server count). totalInBank = tổng bank.
  const [totalMatching, setTotalMatching] = useState<number | null>(null);
  const [totalInBank, setTotalInBank] = useState<number | null>(null);

  const [filters, setFilters] = useState<ActiveFilters>({
    q: "",
    status: [],
    cognitiveLevel: [],
    difficulty: [],
    topics: [],
    reviewStatus: [],
  });
  // Danh sách topic distinct trong bank, load 1 lần để populate filter.
  // Refetch sau khi import vì có thể có topic mới.
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTopics = useCallback(async () => {
    try {
      const r = await fetch(`/api/question-banks/${bankId}/topics`);
      if (!r.ok) return;
      const j = (await r.json()) as { topics: string[] };
      setAvailableTopics(j.topics);
    } catch {
      // non-blocking
    }
  }, [bankId]);

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  const fetchItems = useCallback(
    async (f: ActiveFilters, append = false, cur?: string) => {
      setLoading(true);
      setErr(null);
      const params = new URLSearchParams();
      f.status.forEach((s) => params.append("status", s));
      f.cognitiveLevel.forEach((c) => params.append("cognitiveLevel", c));
      f.difficulty.forEach((d) => params.append("difficulty", String(d)));
      f.topics.forEach((t) => params.append("topic", t));
      f.reviewStatus.forEach((rs) => params.append("reviewStatus", rs));
      if (f.q.trim()) params.set("q", f.q.trim());
      if (cur) params.set("cursor", cur);
      try {
        const r = await fetch(
          `/api/question-banks/${bankId}/questions?${params}`,
        );
        if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
        const j = (await r.json()) as {
          items: Item[];
          nextCursor: string | null;
          totalMatching?: number;
          totalInBank?: number | null;
        };
        setItems((prev) => append ? [...prev, ...j.items] : j.items);
        setCursor(j.nextCursor);
        if (typeof j.totalMatching === "number") setTotalMatching(j.totalMatching);
        if (j.totalInBank !== undefined) setTotalInBank(j.totalInBank);
        if (!append) {
          // Đổi filter / refetch full → reset bulk selection để không lẫn ID
          // không còn nằm trong filter.
          setSelectedIds(new Set());
        }
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

  const hasActiveFilter =
    filters.status.length > 0 ||
    filters.cognitiveLevel.length > 0 ||
    filters.difficulty.length > 0 ||
    filters.topics.length > 0 ||
    filters.reviewStatus.length > 0 ||
    filters.q.trim().length > 0;

  // ── Bulk select helpers ───────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const it of items) next.add(it.id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const visibleAllSelected =
    items.length > 0 && items.every((it) => selectedIds.has(it.id));

  // Áp bulk action lên `selectedIds` HOẶC toàn bộ câu khớp filter (server tự
  // fetch ID). `applyToAllMatching=true` chỉ dùng cho action "Áp tất cả đang lọc".
  const bulkAction = async (
    action: "publish" | "archive" | "draft",
    applyToAllMatching = false,
  ) => {
    const count = applyToAllMatching ? (totalMatching ?? 0) : selectedIds.size;
    const verb =
      action === "publish" ? "publish" : action === "archive" ? "lưu trữ" : "chuyển về nháp";
    // Publish/lưu trữ/về nháp hàng loạt tác động tới đề đang dùng câu này và không
    // có nút hoàn tác: luôn hỏi lại kèm số câu để bấm nhầm bộ lọc còn kịp dừng.
    if (
      !window.confirm(
        `${applyToAllMatching ? "Áp dụng cho TẤT CẢ câu đang lọc" : "Áp dụng cho các câu đã chọn"}: ` +
          `${verb} ${count} câu?` +
          (action === "publish"
            ? "\n\nCâu thiếu hoặc sai đáp án sẽ được bỏ qua và báo lý do."
            : ""),
      )
    )
      return;
    setBulkBusy(true);
    try {
      const body = applyToAllMatching
        ? {
            action,
            applyToFilter: {
              status: filters.status.length > 0 ? filters.status : undefined,
              cognitiveLevel:
                filters.cognitiveLevel.length > 0 ? filters.cognitiveLevel : undefined,
              reviewStatus:
                filters.reviewStatus.length > 0 ? filters.reviewStatus : undefined,
              difficulty: filters.difficulty.length > 0 ? filters.difficulty : undefined,
              topics: filters.topics.length > 0 ? filters.topics : undefined,
              q: filters.q.trim() || undefined,
            },
          }
        : { action, ids: [...selectedIds] };
      const r = await fetch(
        `/api/question-banks/${bankId}/questions/bulk-status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) {
        setErr(`Bulk thất bại (HTTP ${r.status})`);
        return;
      }
      const j = (await r.json()) as {
        ok: string[];
        skipped: { id: string; reason: string }[];
      };
      const actionVerb =
        action === "publish" ? "publish" : action === "archive" ? "lưu trữ" : "chuyển nháp";
      const msg =
        j.skipped.length > 0
          ? `Đã ${actionVerb} ${j.ok.length} câu · bỏ qua ${j.skipped.length} câu (${j.skipped[0]?.reason ?? "không hợp lệ"}…)`
          : `Đã ${actionVerb} ${j.ok.length} câu`;
      flashOk(msg);
      clearSelection();
      await refreshAndKeepSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="mt-3 flex h-[calc(100vh-160px)] min-h-[520px] gap-0 overflow-hidden rounded-xl border border-default bg-white shadow-sm"
    >
      {/* ── Main: Item list + horizontal filter header ──────────────────── */}
      <div
        className={`flex flex-col overflow-hidden ${panelWide && selectedItem ? "hidden lg:hidden" : "flex-1"}`}
      >
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-default bg-white px-5 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {loading ? (
              <span className="text-faint">Đang tải…</span>
            ) : (
              <span className="tabular-nums">
                {hasActiveFilter && totalMatching !== null ? (
                  <>
                    <span className="font-semibold text-slate-900">{totalMatching}</span>
                    <span className="text-faint"> / {totalInBank ?? "?"}</span> câu khớp
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900">
                      {totalInBank ?? items.length}
                    </span>{" "}
                    câu trong ngân hàng
                  </>
                )}
              </span>
            )}
            {hasActiveFilter && (
              <button
                onClick={() =>
                  setFilters({ q: "", status: [], cognitiveLevel: [], difficulty: [], topics: [], reviewStatus: [] })
                }
                className="text-xs text-blue-600 hover:underline"
              >
                Bỏ lọc
              </button>
            )}
            {hasActiveFilter && totalMatching !== null && totalMatching > 0 && (
              <button
                onClick={() => void bulkAction("publish", true)}
                disabled={bulkBusy}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                title={`Publish toàn bộ ${totalMatching} câu khớp bộ lọc (câu thiếu hoặc sai đáp án sẽ được bỏ qua)`}
              >
                ▶ Publish {totalMatching} câu đang lọc
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CodePrefixEditor
              bankId={bankId}
              value={codePrefix}
              onChange={setCodePrefix}
            />
            <button
              onClick={() => setMcqImportOpen(true)}
              title="Import nhiều câu hỏi từ file Excel (.xlsx)"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
            >
              <span aria-hidden>⬆</span> Import Excel
            </button>
            <button
              onClick={() => { setImporting((s) => !s); setAdding(false); }}
              title="Import từ CSV (định dạng cũ)"
              className="rounded-md border border-default bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              {importing ? "Đóng" : "CSV"}
            </button>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
            <button
              onClick={() => { setAdding((s) => !s); setImporting(false); }}
              className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {adding ? "Đóng" : (<><span aria-hidden>+</span> Thêm câu hỏi</>)}
            </button>
          </div>
        </div>

        {/* Filter header (horizontal) */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-default bg-slate-50/60 px-5 py-3">
          <input
            type="search"
            placeholder="Tìm câu hỏi…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="w-56 rounded-md border border-default bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
          />

          <FilterChipGroup label="Trạng thái">
            {(["draft", "published", "archived"] as Status[]).map((s) => (
              <FilterChip
                key={s}
                label={STATUS_LABEL[s]}
                active={filters.status.includes(s)}
                onClick={() => toggleFilter("status", s)}
              />
            ))}
          </FilterChipGroup>

          <FilterChipGroup label="Thẩm định">
            {(["pending", "approved", "needs_revision"] as ReviewStatus[]).map((r) => (
              <FilterChip
                key={r}
                label={REVIEW_LABEL[r]}
                active={filters.reviewStatus.includes(r)}
                onClick={() => toggleFilter("reviewStatus", r)}
              />
            ))}
          </FilterChipGroup>

          <FilterChipGroup label="Tư duy">
            {(["remember_understand", "apply", "analyze_plus"] as CognitiveLevel[]).map((c) => (
              <FilterChip
                key={c}
                label={COGNITIVE_LABEL[c]}
                active={filters.cognitiveLevel.includes(c)}
                onClick={() => toggleFilter("cognitiveLevel", c)}
              />
            ))}
          </FilterChipGroup>

          <FilterChipGroup label="Độ khó">
            {[1, 2, 3, 4, 5].map((d) => (
              <FilterChip
                key={d}
                label={String(d)}
                active={filters.difficulty.includes(d)}
                onClick={() => toggleFilter("difficulty", d)}
                compact
              />
            ))}
          </FilterChipGroup>

          <FilterChipGroup label="Chủ đề">
            {availableTopics.length === 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-500"
                title="Chọn 1 câu hỏi ở danh sách, mở panel chi tiết bên phải để gán chủ đề"
              >
                <span aria-hidden>+</span> Thêm chủ đề cho câu hỏi
              </span>
            ) : availableTopics.length <= 4 ? (
              // Ít topic → render inline chip cho nhanh
              <div className="flex flex-wrap gap-1">
                {availableTopics.map((t) => (
                  <FilterChip
                    key={t}
                    label={t}
                    active={filters.topics.includes(t)}
                    onClick={() => toggleFilter("topics", t)}
                    rounded
                  />
                ))}
              </div>
            ) : (
              // ≥5 topic → popover dropdown để tránh tràn 3-4 dòng filter row
              <TopicMultiselect
                topics={availableTopics}
                selected={filters.topics}
                onToggle={(t) => toggleFilter("topics", t)}
                onClear={() => setFilters((f) => ({ ...f, topics: [] }))}
              />
            )}
          </FilterChipGroup>

        </div>
        <ImportMcqModal
          open={mcqImportOpen}
          onClose={() => setMcqImportOpen(false)}
          onCommitted={() => {
            void refreshAndKeepSelection();
            // Import có thể tạo topic mới → refresh filter chips.
            void fetchTopics();
          }}
          previewEndpoint={`/api/question-banks/${bankId}/questions/mcq-import-preview`}
          commitEndpoint={`/api/question-banks/${bankId}/questions/mcq-import-commit`}
          destinationLabel="ngân hàng câu hỏi"
        />

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
                availableTopics={availableTopics}
                onDone={async () => {
                  setAdding(false);
                  await refreshAndKeepSelection();
                  // Topic mới (nếu user tạo) → refresh filter list.
                  void fetchTopics();
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

        {/* List header — master checkbox để chọn nhanh tất cả câu đang hiển thị */}
        {items.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-default bg-slate-50/60 px-4 py-1.5 text-xs text-slate-600">
            <input
              ref={(el) => {
                // indeterminate state: 1 phần được chọn → checkbox lai
                if (el) {
                  const someSelected = items.some((it) => selectedIds.has(it.id));
                  el.indeterminate = someSelected && !visibleAllSelected;
                }
              }}
              type="checkbox"
              checked={visibleAllSelected}
              onChange={() =>
                visibleAllSelected ? clearSelection() : selectAllVisible()
              }
              title={
                visibleAllSelected
                  ? "Bỏ chọn tất cả"
                  : `Chọn tất cả ${items.length} câu đang hiện`
              }
              className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-1 focus:ring-brand-400"
            />
            <button
              onClick={() =>
                visibleAllSelected ? clearSelection() : selectAllVisible()
              }
              className="font-medium hover:text-slate-900 hover:underline"
            >
              {visibleAllSelected
                ? `Bỏ chọn (${selectedIds.size})`
                : selectedIds.size > 0
                ? `Đã chọn ${selectedIds.size} · chọn hết ${items.length} đang hiện`
                : `Chọn tất cả ${items.length}`}
            </button>
            {totalMatching !== null && totalMatching > items.length && (
              <span className="text-faint">
                · còn {totalMatching - items.length} câu chưa tải
              </span>
            )}
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
            const isChecked = selectedIds.has(q.id);
            const correctPreview = correctAnswerPreview(q.type, q.config);
            return (
              <li
                key={q.id}
                data-testid={`question-row-${q.id}`}
                onClick={() => setSelectedId(isSelected ? null : q.id)}
                className={`cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 ${isSelected ? "bg-blue-50 hover:bg-blue-50" : isChecked ? "bg-emerald-50/40" : "bg-white"}`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Checkbox bulk select */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 flex shrink-0 cursor-pointer items-center"
                    title="Chọn để bulk action"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(q.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-1 focus:ring-brand-400"
                    />
                  </label>

                  {/* Quality dot */}
                  <div className="mt-1.5 shrink-0">
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
                      {q.code && (
                        <span
                          className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700"
                          title="Mã câu hỏi"
                        >
                          {q.code}
                        </span>
                      )}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_TONE[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${REVIEW_TONE[q.reviewStatus]}`}
                        title={
                          q.reviewedAt
                            ? `${REVIEW_LABEL[q.reviewStatus]} bởi ${q.reviewedByName ?? "?"} · ${formatDate(q.reviewedAt)}`
                            : REVIEW_LABEL[q.reviewStatus]
                        }
                      >
                        {REVIEW_LABEL[q.reviewStatus]}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${COGNITIVE_TONE[q.cognitiveLevel]}`}>
                        {COGNITIVE_LABEL[q.cognitiveLevel]}
                      </span>
                      <span
                        className="inline-flex items-center gap-0.5 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
                        title={`Độ khó ${q.difficulty}/5 · ${q.points} điểm · ${TYPE_LABEL[q.type] ?? q.type}`}
                      >
                        <DifficultyDots level={q.difficulty} />
                        <span className="ml-1 uppercase">{TYPE_LABEL[q.type] ?? q.type}</span>
                      </span>
                      {correctPreview && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                          title="Đáp án đúng"
                        >
                          ✓ {correctPreview}
                        </span>
                      )}
                      {qi && !qi.ok && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          ⚠ {qi.warnings.join(" · ")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-800">{q.prompt}</p>
                    {(q.authorName || q.skillIds.length > 0 || (q.stats && q.stats.totalUses > 0)) && (
                      <p className="mt-0.5 text-[10px] text-faint">
                        {q.authorName && `✍ ${q.authorName}`}
                        {q.authorName && (q.skillIds.length > 0 || (q.stats && q.stats.totalUses > 0)) && " · "}
                        {q.skillIds.length > 0 && `${q.skillIds.length} skill`}
                        {q.skillIds.length > 0 && q.stats && q.stats.totalUses > 0 && " · "}
                        {q.stats && q.stats.totalUses > 0 && `đã dùng ${q.stats.totalUses} lần`}
                      </p>
                    )}
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

        {/* Bulk action floating bar — chỉ hiện khi có ≥1 câu được tick */}
        {selectedIds.size > 0 && (
          <div className="shrink-0 border-t-2 border-brand-200 bg-brand-50 px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-brand-800 tabular-nums">
                  {selectedIds.size}
                </span>
                <span className="text-slate-700">câu đã chọn</span>
                <button
                  onClick={clearSelection}
                  className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
                >
                  bỏ chọn
                </button>
                {!visibleAllSelected && items.length > 0 && (
                  <button
                    onClick={selectAllVisible}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    chọn hết {items.length} đang hiện
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => void bulkAction("publish")}
                  disabled={bulkBusy}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Publish
                </button>
                <button
                  onClick={() => void bulkAction("draft")}
                  disabled={bulkBusy}
                  className="rounded-md border border-default bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Về nháp
                </button>
                <button
                  onClick={() => void bulkAction("archive")}
                  disabled={bulkBusy}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Lưu trữ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Resize handle ───────────────────────────────────────────────── */}
      {selectedItem && !panelWide && (
        <div
          onMouseDown={onResizeStart}
          onDoubleClick={() => setPanelPx(384)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để đổi rộng panel chi tiết · double-click để reset"
          title="Kéo để đổi rộng · double-click để reset"
          className="group hidden w-1 shrink-0 cursor-col-resize bg-default transition-colors hover:bg-brand-400 lg:flex"
        >
          {/* visual grip — 3 dots ở giữa khi hover */}
          <span className="m-auto h-8 w-0.5 rounded-full bg-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      )}

      {/* ── Right: Detail panel ──────────────────────────────────────────── */}
      <aside
        style={
          // Trên desktop dùng width drag-able; mobile / wide-mode override bằng class.
          panelWide || !selectedItem ? undefined : { width: `${panelPx}px` }
        }
        className={`flex shrink-0 flex-col overflow-hidden border-l border-default bg-white ${
          panelWide && selectedItem
            ? "w-full lg:w-[80%]"
            : selectedItem
            ? ""
            : "w-96"
        }`}
      >
        {selectedItem ? (
          <DetailPanel
            key={selectedItem.id}
            q={selectedItem}
            suggestedSkills={suggestedSkills}
            availableTopics={availableTopics}
            wide={panelWide}
            onToggleWide={() => setPanelWide((v) => !v)}
            onClose={() => {
              setSelectedId(null);
              setPanelWide(false);
            }}
            onUpdated={async (updated) => {
              await refreshAndKeepSelection();
              // Edit topic có thể tạo topic mới → refresh filter.
              if (updated) void fetchTopics();
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

function FilterChipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  compact,
  rounded,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  rounded?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`border text-xs transition ${
        compact ? "px-2 py-0.5" : "px-2.5 py-0.5"
      } ${rounded ? "rounded-full" : "rounded-md"} ${
        active
          ? "border-brand-400 bg-brand-50 font-medium text-brand-800"
          : "border-default bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Topic filter dropdown — dùng khi bank có ≥5 topic để khỏi tràn nhiều dòng.
 * Click-outside để đóng. Chip count hiển thị khi có topic active.
 */
function TopicMultiselect({
  topics,
  selected,
  onToggle,
  onClear,
}: {
  topics: string[];
  selected: string[];
  onToggle: (topic: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const filtered = q
    ? topics.filter((t) => t.toLowerCase().includes(q.toLowerCase()))
    : topics;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${
          selected.length > 0
            ? "border-brand-400 bg-brand-50 font-medium text-brand-800"
            : "border-default bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        {selected.length > 0 ? (
          <>
            <span className="font-semibold tabular-nums">{selected.length}</span> chủ đề
          </>
        ) : (
          <>Chọn chủ đề ({topics.length})</>
        )}
        <span aria-hidden className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-default bg-white shadow-lg">
          <div className="border-b border-default p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Lọc chủ đề…"
              className="w-full rounded-md border border-default px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-faint">Không khớp</p>
            ) : (
              filtered.map((t) => {
                const checked = selected.includes(t);
                return (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(t)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-1 focus:ring-brand-400"
                    />
                    <span className="flex-1 truncate text-slate-700">{t}</span>
                  </label>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-default p-1.5 text-right">
              <button
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline editor cho QuestionBank.codePrefix. Bật/sửa prefix → câu hỏi mới tự
 * sinh code dạng `{prefix}-{NNNN}`. Để trống = tắt auto-sinh.
 */
function CodePrefixEditor({
  bankId,
  value,
  onChange,
}: {
  bankId: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => setDraft(value ?? ""), [value]);

  const save = async () => {
    setBusy(true);
    try {
      const next = draft.trim() || null;
      const r = await fetch(`/api/question-banks/${bankId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codePrefix: next }),
      });
      if (r.ok) {
        const j = (await r.json()) as { codePrefix: string | null };
        onChange(j.codePrefix);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Tiền tố mã câu hỏi auto-sinh"
        className="inline-flex items-center gap-1 rounded-md border border-default bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        <span className="font-mono text-slate-500">#</span>
        {value ? (
          <span className="font-mono font-semibold text-slate-800">{value}</span>
        ) : (
          <span className="text-faint">tự sinh mã…</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-default bg-white p-3 shadow-lg">
          <p className="text-xs font-medium text-slate-700">Tiền tố mã câu hỏi</p>
          <p className="mt-1 text-[11px] text-faint">
            Câu hỏi mới sẽ tự nhận mã dạng <code className="font-mono">{draft || "PREFIX"}-0001</code>.
            Để trống → không auto-sinh.
          </p>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase().slice(0, 20))}
            placeholder="VD: KNM"
            className="mt-2 w-full rounded border border-default px-2 py-1.5 font-mono text-xs uppercase"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-xs text-faint hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail panel ──────────────────────────────────────────────────────────

function DetailPanel({
  q,
  suggestedSkills,
  onClose,
  onUpdated,
  onDeleted,
  availableTopics,
  wide,
  onToggleWide,
}: {
  q: Item;
  suggestedSkills: Skill[];
  onClose: () => void;
  onUpdated: (updated: boolean) => Promise<void>;
  onDeleted: () => Promise<void>;
  availableTopics: string[];
  wide: boolean;
  onToggleWide: () => void;
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
          <button
            onClick={onToggleWide}
            className="hidden rounded p-1 text-faint transition hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
            title={wide ? "Thu hẹp panel" : "Mở rộng panel (ẩn danh sách)"}
            aria-label={wide ? "Thu hẹp" : "Mở rộng"}
          >
            {wide ? "⇥" : "⇤"}
          </button>
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
          <EditTab
            q={q}
            suggestedSkills={suggestedSkills}
            availableTopics={availableTopics}
            onUpdated={onUpdated}
          />
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
  availableTopics,
  onUpdated,
}: {
  q: Item;
  suggestedSkills: Skill[];
  availableTopics: string[];
  onUpdated: (updated: boolean) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(q.prompt);
  const [topic, setTopic] = useState(
    typeof q.config?.topic === "string" ? (q.config.topic as string) : "",
  );
  const [difficulty, setDifficulty] = useState(q.difficulty);
  const [points, setPoints] = useState(q.points);
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>(q.cognitiveLevel);
  const [skillIds, setSkillIds] = useState(q.skillIds);
  // Metadata mở rộng (xem CLAUDE.md / schema BankQuestion).
  const [code, setCode] = useState(q.code ?? "");
  const [learningOutcome, setLearningOutcome] = useState(q.learningOutcome ?? "");
  const [authorName, setAuthorName] = useState(q.authorName ?? "");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(q.reviewStatus);
  const [editNote, setEditNote] = useState(q.editNote ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Merge topic vào config (giữ nguyên các field khác như options, correct).
      // Trống topic → xoá field khỏi config (instructor có thể clear topic).
      const newConfig = { ...(q.config ?? {}) } as Record<string, unknown>;
      if (topic.trim()) newConfig.topic = topic.trim();
      else delete newConfig.topic;
      const r = await fetch(`/api/bank-questions/${q.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          difficulty,
          points,
          cognitiveLevel,
          config: newConfig,
          // Metadata — null/empty được normalize ở server (xem updateBankQuestion).
          code: code.trim() || null,
          learningOutcome: learningOutcome.trim() || null,
          authorName: authorName.trim() || null,
          reviewStatus,
          editNote: editNote.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
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
              disabled={statusBusy}
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

      {/* Topic combobox — chọn topic có sẵn hoặc gõ tạo mới. Lưu vào
          config.topic khi bấm "Lưu thay đổi". */}
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">
          Chủ đề
          <span className="ml-1 font-normal text-faint">(tuỳ chọn)</span>
        </span>
        <div className="mt-1">
          <TopicCombobox
            value={topic}
            onChange={setTopic}
            availableTopics={availableTopics}
            placeholder="Chọn chủ đề có sẵn hoặc gõ tạo mới..."
          />
        </div>
      </label>

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
          matching, ordering, numerical, drag_drop_fill) where the config shape is more complex.
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

      {/* ── Siêu dữ liệu (metadata) — Mã / CĐR / Tác giả / Thẩm định / Ghi chú ── */}
      <details className="rounded-md border border-default bg-slate-50/40 px-3 py-2" open>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
          Siêu dữ liệu
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="block text-xs font-medium text-slate-600">Mã câu hỏi</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="vd KNM-0001 (tự sinh nếu bank có prefix)"
                className="mt-1 w-full rounded border border-default px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="block flex-1">
              <span className="block text-xs font-medium text-slate-600">Tác giả</span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Tên người soạn"
                className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              CĐR (Chuẩn đầu ra)
            </span>
            <textarea
              value={learningOutcome}
              onChange={(e) => setLearningOutcome(e.target.value)}
              rows={2}
              placeholder='vd "Sinh viên giải thích được khái niệm vòng tròn ảnh hưởng"'
              className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Trạng thái thẩm định</span>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
              className="mt-1 w-full rounded border border-default bg-white px-2 py-1.5 text-xs"
            >
              <option value="pending">Chưa thẩm định</option>
              <option value="approved">Đã duyệt</option>
              <option value="needs_revision">Cần sửa</option>
            </select>
            {q.reviewedAt && q.reviewedByName && q.reviewStatus !== "pending" && (
              <p className="mt-1 text-[10px] text-faint">
                {REVIEW_LABEL[q.reviewStatus]} bởi <strong>{q.reviewedByName}</strong> ·{" "}
                {formatDateTime(q.reviewedAt)}
              </p>
            )}
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Ghi chú sửa</span>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={2}
              placeholder="vd Sửa typo đáp án B, 2026-05-20"
              className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
            />
          </label>
          <div className="text-[10px] text-faint">
            Tạo: {formatDateTime(q.createdAt)}
            {" · "}
            Cập nhật: {formatDateTime(q.updatedAt)}
            {q.stats && q.stats.totalUses > 0 && (
              <> · Lần sử dụng: <strong>{q.stats.totalUses}</strong></>
            )}
          </div>
        </div>
      </details>

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
            <p className="mt-1 text-[10px] text-faint">
              Tag skill là tuỳ chọn — cần nếu muốn câu hỏi tham gia adaptive
              path / blueprint theo skill.
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
      {/* Chuỗi theo đợt — đặt TRƯỚC số bình quân vì đây mới là thứ để quyết
          định. Số bình quân bên dưới gộp mọi phiên bản nên chỉ để tham khảo. */}
      <TrialHistoryBlock questionId={q.id} />

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
                value={formatDate(q.lastSampledAt)}
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
  availableTopics,
  onDone,
}: {
  bankId: string;
  suggestedSkills: Skill[];
  availableTopics: string[];
  onDone: () => Promise<void>;
}) {
  const [type, setType] = useState<QuestionType>("mcq");
  const [prompt, setPrompt] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [points, setPoints] = useState(1);
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>("apply");
  const [options, setOptions] = useState<{ label: string; correct: boolean }[]>([
    { label: "", correct: true },
    { label: "", correct: false },
    { label: "", correct: false },
    { label: "", correct: false },
  ]);
  const [tfng, setTfng] = useState<"true" | "false" | "notgiven">("true");
  // Mỗi dòng một đáp án chấp nhận (short_answer) / một chỗ trống (gap_fill, các
  // đáp án chấp nhận của chỗ đó cách nhau bằng dấu |).
  const [answerLines, setAnswerLines] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const lines = answerLines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
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
          ? { correct: tfng }
          : type === "short_answer"
          ? { acceptedAnswers: lines, matchMode: "case_insensitive" }
          : type === "gap_fill"
          ? {
              blanks: lines.map((l, i) => ({
                id: `b${i + 1}`,
                acceptedAnswers: l.split("|").map((a) => a.trim()).filter(Boolean),
                matchMode: "case_insensitive",
              })),
            }
          : {};
      // Topic stored vào config.topic — đồng nhất với MCQ import flow.
      if (topic.trim()) config.topic = topic.trim();
      const r = await fetch(`/api/question-banks/${bankId}/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, prompt, config, difficulty, points, cognitiveLevel }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as {
          error?: string;
          details?: { config?: string[] };
        } | null;
        // Lý do cụ thể từ server (vd thiếu đáp án đúng) hữu ích hơn mã lỗi thô.
        setErr(
          j?.details?.config?.[0]
            ? `Cấu hình đáp án chưa hợp lệ: ${j.details.config[0]}`
            : (j?.error ?? `HTTP ${r.status}`),
        );
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
        <span className="block text-xs font-medium text-slate-600">
          Chủ đề
          <span className="ml-1 font-normal text-faint">(tuỳ chọn)</span>
        </span>
        <div className="mt-1">
          <TopicCombobox
            value={topic}
            onChange={setTopic}
            availableTopics={availableTopics}
            placeholder="Chọn chủ đề có sẵn hoặc gõ tạo mới..."
          />
        </div>
      </label>

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

      {type === "true_false_notgiven" && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600">Đáp án đúng</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {([
              ["true", "Đúng"],
              ["false", "Sai"],
              ["notgiven", "Không đề cập"],
            ] as const).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="new-tfng"
                  checked={tfng === v}
                  onChange={() => setTfng(v)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {(type === "short_answer" || type === "gap_fill") && (
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            {type === "short_answer"
              ? "Các đáp án được chấp nhận (mỗi dòng một đáp án)"
              : "Các chỗ trống (mỗi dòng một chỗ trống, theo thứ tự)"}
          </span>
          <textarea
            required
            rows={3}
            value={answerLines}
            onChange={(e) => setAnswerLines(e.target.value)}
            placeholder={type === "short_answer" ? "Hà Nội\nHa Noi" : "Hà Nội | Ha Noi\n1010"}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-xs"
          />
          {type === "gap_fill" && (
            <span className="mt-0.5 block text-[10px] text-faint">
              Chỗ trống nhận nhiều đáp án thì cách nhau bằng dấu |. Không phân biệt hoa thường.
            </span>
          )}
        </label>
      )}

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-faint">Tag skill là tuỳ chọn (cần cho adaptive path).</p>
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
//   - true_false_notgiven:   config.correct = "true" | "false" | "notgiven"
//   - gap_fill:              config.blanks[] each { acceptable: string[] }
//   - short_answer:          config.acceptable: string[]
//   - matching/ordering/numerical/drag_drop_fill (Đợt 1): xem schemas.ts — chưa có editor ở đây, rơi vào raw fallback
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
      notgiven: "Không đề cập",
      not_given: "Không đề cập", // dữ liệu cũ
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

  // matching/ordering/numerical/drag_drop_fill (Đợt 1) chưa có editor riêng —
  // rơi vào fallback "raw config" bên dưới cho tới Đợt 2+.
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
// read-only preview — editing gap_fill / matching / ordering / etc. needs a
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
  // Dữ liệu cũ có thể lưu "not_given"; schema/trình làm bài chỉ hiểu "notgiven".
  const rawCorrect = typeof config?.correct === "string" ? (config.correct as string) : "true";
  const initial = rawCorrect === "not_given" ? "notgiven" : rawCorrect;
  const [correct, setCorrect] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = correct !== initial;
  const LABEL: Record<string, string> = {
    true: "Đúng",
    false: "Sai",
    notgiven: "Không đề cập",
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
        {(["true", "false", "notgiven"] as const).map((v) => (
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

/**
 * Chuỗi thử nghiệm của một câu hỏi, gộp theo PHIÊN BẢN câu chữ.
 *
 * Khác khối "Chỉ số dễ (p)" bên dưới: khối đó đọc BankQuestionStats, vốn là
 * trung bình có trọng số gộp mọi phiên bản — một câu tệ rồi sửa tốt sẽ hiện ra
 * con số ở giữa, không mô tả phiên bản nào từng tồn tại.
 */
function TrialHistoryBlock({ questionId }: { questionId: string }) {
  const [data, setData] = useState<{
    history: {
      points: Array<{
        examTitle: string;
        examPurpose: string;
        versionNumber: number;
        attemptCount: number;
        pValue: number;
        discrimination: number;
      }>;
      currentVersionNumber: number | null;
      currentRollup: {
        totalAttempts: number;
        pValue: number | null;
        discrimination: number | null;
        trials: number;
      } | null;
    };
    readiness: { ready: boolean; blockers: string[] };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(apiUrl(`/api/bank-questions/${questionId}/trial-history`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setData(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [questionId]);

  if (loading) return null;
  if (!data || data.history.points.length === 0) return null;

  const r = data.history.currentRollup;
  return (
    <div className="rounded border border-default bg-white p-3">
      <p className="mb-2 text-xs font-semibold">
        Lịch sử thử nghiệm
        {data.history.currentVersionNumber !== null && (
          <span className="ml-1 font-normal text-faint">
            · phiên bản hiện tại v{data.history.currentVersionNumber}
          </span>
        )}
      </p>

      <ul className="space-y-1">
        {data.history.points.map((p, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate">
              <span className="font-mono text-faint">v{p.versionNumber}</span>{" "}
              {p.examTitle}
              {p.examPurpose === "field_test" && (
                <span className="ml-1 text-faint">(thử nghiệm)</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-faint">
              n {p.attemptCount}
              {p.pValue >= 0 ? ` · p ${p.pValue.toFixed(2)}` : ""}
              {p.discrimination > -2 ? ` · D ${p.discrimination.toFixed(2)}` : ""}
            </span>
          </li>
        ))}
      </ul>

      {r && (
        <p className="mt-2 border-t border-default pt-2 text-xs">
          <strong>Gộp phiên bản hiện tại:</strong>{" "}
          <span className="tabular-nums">
            n {r.totalAttempts}
            {r.pValue !== null ? ` · p ${r.pValue.toFixed(2)}` : ""}
            {r.discrimination !== null ? ` · D ${r.discrimination.toFixed(2)}` : ""}
          </span>
        </p>
      )}

      {data.readiness.ready ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          ✓ Đủ bằng chứng để kết nạp vào kho
        </p>
      ) : (
        <ul className="mt-2 list-disc pl-4 text-xs text-amber-700">
          {data.readiness.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
