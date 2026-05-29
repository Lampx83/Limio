"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Search,
  X,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";
import SafeHtml from "@/components/SafeHtml";
import { formatDateTime } from "@/lib/datetime";

type AttemptRow = {
  id: string;
  user: { id: string; displayName: string | null; email: string };
  status: "in_progress" | "submitted" | "abandoned";
  startedAt: string;
  submittedAt: string | null;
  scorePct: number | null;
  passed: boolean | null;
  attemptIndex: number;
  responseCount: number;
  durationMs: number | null;
};

type ListResponse = {
  quiz: {
    id: string;
    title: string;
    passThresholdPct: number;
    totalQuestions: number;
    lessonTitle: string | null;
    moduleTitle: string | null;
  };
  stats: {
    totalAttempts: number;
    submittedCount: number;
    uniqueLearners: number;
    passRate: number | null;
    avgScorePct: number | null;
    avgDurationMs: number | null;
  };
  attempts: AttemptRow[];
};

type SortKey = "user" | "status" | "scorePct" | "attemptIndex" | "submittedAt";
type StatusFilter = "all" | "submitted" | "in_progress" | "abandoned";
type PassFilter = "all" | "passed" | "failed" | "ungraded";

const STATUS_LABEL: Record<AttemptRow["status"], string> = {
  in_progress: "Đang làm",
  submitted: "Đã nộp",
  abandoned: "Bỏ giữa chừng",
};

const STATUS_BADGE: Record<AttemptRow["status"], string> = {
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  abandoned: "bg-gray-100 text-gray-600 border-gray-200",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  return formatDateTime(s);
}

export default function QuizResultsClient({
  courseId,
  quizId,
}: {
  courseId: string;
  quizId: string;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [passFilter, setPassFilter] = useState<PassFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drawerAttemptId, setDrawerAttemptId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/instructor/courses/${courseId}/quizzes/${quizId}/results`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (!cancelled) {
          setData(j as ListResponse);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, quizId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    let out = data.attempts.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (passFilter === "passed" && a.passed !== true) return false;
      if (passFilter === "failed" && a.passed !== false) return false;
      if (passFilter === "ungraded" && a.passed !== null) return false;
      if (s) {
        const hay =
          (a.user.displayName ?? "").toLowerCase() +
          " " +
          a.user.email.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    out = out.sort((x, y) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "user":
          return (
            ((x.user.displayName ?? x.user.email).localeCompare(
              y.user.displayName ?? y.user.email,
            )) * dir
          );
        case "status":
          return x.status.localeCompare(y.status) * dir;
        case "scorePct":
          return ((x.scorePct ?? -1) - (y.scorePct ?? -1)) * dir;
        case "attemptIndex":
          return (x.attemptIndex - y.attemptIndex) * dir;
        case "submittedAt": {
          const tx = x.submittedAt ?? x.startedAt;
          const ty = y.submittedAt ?? y.startedAt;
          return (new Date(tx).getTime() - new Date(ty).getTime()) * dir;
        }
        default:
          return 0;
      }
    });
    return out;
  }, [data, search, statusFilter, passFilter, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-8 text-center text-muted">
        Đang tải dữ liệu…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
        Không tải được dữ liệu: {error ?? "unknown"}
      </div>
    );
  }

  return (
    <>
      <StatsCards
        stats={data.stats}
        passThresholdPct={data.quiz.passThresholdPct}
        totalQuestions={data.quiz.totalQuestions}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="input w-full pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="input"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="submitted">Đã nộp</option>
          <option value="in_progress">Đang làm</option>
          <option value="abandoned">Bỏ giữa chừng</option>
        </select>
        <select
          value={passFilter}
          onChange={(e) => setPassFilter(e.target.value as PassFilter)}
          className="input"
        >
          <option value="all">Mọi kết quả</option>
          <option value="passed">Đạt</option>
          <option value="failed">Chưa đạt</option>
          <option value="ungraded">Chưa có kết quả</option>
        </select>
        <span className="ml-auto text-sm text-muted">
          {filtered.length} / {data.attempts.length} lượt
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-token bg-[rgb(var(--surface))]">
        <table className="min-w-full divide-y divide-token text-sm">
          <thead className="bg-[rgb(var(--surface-muted))]">
            <tr>
              <Th k="user" label="Sinh viên" sortKey={sortKey} sortDir={sortDir} onSort={setSortKey} flipDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} />
              <Th k="status" label="Trạng thái" sortKey={sortKey} sortDir={sortDir} onSort={setSortKey} flipDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} />
              <Th k="scorePct" label="Điểm" sortKey={sortKey} sortDir={sortDir} onSort={setSortKey} flipDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} align="right" />
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
                Đạt
              </th>
              <Th k="attemptIndex" label="Lần" sortKey={sortKey} sortDir={sortDir} onSort={setSortKey} flipDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} align="center" />
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
                Thời gian làm
              </th>
              <Th k="submittedAt" label="Nộp lúc" sortKey={sortKey} sortDir={sortDir} onSort={setSortKey} flipDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  Không có lượt nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer hover:bg-brand-soft/50"
                  onClick={() => setDrawerAttemptId(a.id)}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-default">
                      {a.user.displayName ?? "—"}
                    </div>
                    <div className="text-xs text-muted">{a.user.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {a.scorePct == null ? "—" : `${a.scorePct.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2.5">
                    {a.passed === true ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Đạt
                      </span>
                    ) : a.passed === false ? (
                      <span className="inline-flex items-center gap-1 text-rose-600">
                        <XCircle className="h-4 w-4" />
                        Chưa
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {a.attemptIndex}
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(a.durationMs)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {formatDate(a.submittedAt ?? a.startedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AttemptDrawer
        attemptId={drawerAttemptId}
        courseId={courseId}
        quizId={quizId}
        onClose={() => setDrawerAttemptId(null)}
      />
    </>
  );
}

function Th({
  k,
  label,
  sortKey,
  sortDir,
  onSort,
  flipDir,
  align = "left",
}: {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  flipDir: () => void;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === k;
  return (
    <th
      className={`px-3 py-2 text-${align} text-xs font-medium uppercase tracking-wide text-faint`}
    >
      <button
        type="button"
        onClick={() => (active ? flipDir() : onSort(k))}
        className={`inline-flex items-center gap-1 hover:text-default ${active ? "text-default" : ""}`}
      >
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );
}

function StatsCards({
  stats,
  passThresholdPct,
  totalQuestions,
}: {
  stats: ListResponse["stats"];
  passThresholdPct: number;
  totalQuestions: number;
}) {
  const cards = [
    {
      label: "Lượt nộp / Tổng",
      value: `${stats.submittedCount} / ${stats.totalAttempts}`,
    },
    {
      label: "Sinh viên đã làm",
      value: String(stats.uniqueLearners),
    },
    {
      label: `Tỉ lệ đạt (≥${passThresholdPct}%)`,
      value:
        stats.passRate == null
          ? "—"
          : `${(stats.passRate * 100).toFixed(0)}%`,
    },
    {
      label: "Điểm TB",
      value:
        stats.avgScorePct == null
          ? "—"
          : `${stats.avgScorePct.toFixed(1)}%`,
    },
    {
      label: "Thời gian TB",
      value: formatDuration(stats.avgDurationMs),
    },
    {
      label: "Số câu trong quiz",
      value: String(totalQuestions),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
        >
          <div className="text-xs text-faint">{c.label}</div>
          <div className="mt-1 text-xl font-bold text-default">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Drawer: per-attempt detail
// ===========================================================================

type DetailItem = {
  questionId: string;
  prompt: string;
  type: string;
  explanation: string | null;
  points: number;
  yourResponse: unknown;
  isCorrect: boolean;
  confidence: number | null;
  correctOptionIds: string[];
  options: { id: string; label: string; isCorrect: boolean }[];
  misconceptionCode?: string;
  needsGrading: boolean;
  manualScore: number | null;
};

type DetailResponse = {
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    scorePct: number | null;
    passed: boolean | null;
    user: { id: string; displayName: string | null; email: string };
  };
  items: DetailItem[];
};

function AttemptDrawer({
  attemptId,
  courseId,
  quizId,
  onClose,
}: {
  attemptId: string | null;
  courseId: string;
  quizId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!attemptId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      apiUrl(
        `/api/instructor/courses/${courseId}/quizzes/${quizId}/results/${attemptId}`,
      ),
    )
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((j) => {
        if (!cancelled) {
          setData(j as DetailResponse);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, courseId, quizId]);

  // Close on ESC
  useEffect(() => {
    if (!attemptId) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [attemptId, onClose]);

  if (!attemptId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết lượt làm bài"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng drawer"
        className="flex-1 bg-black/40"
      />
      <aside className="w-full max-w-2xl overflow-y-auto bg-[rgb(var(--surface))] shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-token bg-[rgb(var(--surface))] px-4 py-3">
          <h2 className="text-lg font-semibold text-default">
            Chi tiết lượt làm
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-default"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && <div className="text-sm text-muted">Đang tải…</div>}
          {error && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {error}
            </div>
          )}
          {data && <AttemptDetail data={data} />}
        </div>
      </aside>
    </div>
  );
}

function AttemptDetail({ data }: { data: DetailResponse }) {
  const totalPoints = data.items.reduce((s, it) => s + it.points, 0);
  const earnedPoints = data.items.reduce((s, it) => {
    if (it.needsGrading) return s + (it.manualScore ?? 0);
    return s + (it.isCorrect ? it.points : 0);
  }, 0);
  return (
    <>
      {/* SV identity */}
      <section className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3">
        <div className="font-semibold text-default">
          {data.attempt.user.displayName ?? data.attempt.user.email}
        </div>
        <div className="text-xs text-muted">{data.attempt.user.email}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span>
            Điểm:{" "}
            <strong className="tabular-nums">
              {data.attempt.scorePct == null
                ? "—"
                : `${data.attempt.scorePct.toFixed(1)}%`}
            </strong>{" "}
            <span className="text-faint">
              ({earnedPoints}/{totalPoints})
            </span>
          </span>
          {data.attempt.passed === true && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đạt
            </span>
          )}
          {data.attempt.passed === false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
              <XCircle className="h-3.5 w-3.5" /> Chưa đạt
            </span>
          )}
          <span className="text-muted">
            Nộp: {formatDate(data.attempt.submittedAt)}
          </span>
        </div>
      </section>

      {/* Per-question list */}
      <ol className="space-y-3">
        {data.items.map((it, i) => (
          <QuestionItem key={it.questionId} item={it} order={i + 1} />
        ))}
      </ol>
    </>
  );
}

function QuestionItem({ item, order }: { item: DetailItem; order: number }) {
  const isMultiChoice = item.type === "mcq" || item.type === "multi";
  const responseIds = Array.isArray(item.yourResponse)
    ? (item.yourResponse as string[])
    : typeof item.yourResponse === "string"
      ? [item.yourResponse]
      : [];

  return (
    <li className="rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-default">
          Câu {order}.{" "}
          <span className="text-xs text-muted">({item.points} điểm)</span>
        </div>
        <div className="flex items-center gap-2">
          {item.needsGrading ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              Cần chấm tay
            </span>
          ) : item.isCorrect ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đúng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
              <XCircle className="h-3.5 w-3.5" /> Sai
            </span>
          )}
          {item.confidence != null && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              Tự tin {item.confidence}/5
            </span>
          )}
        </div>
      </div>

      <SafeHtml
        html={plainToRichHtml(item.prompt)}
        className="prose prose-sm max-w-none text-default dark:prose-invert"
      />

      {isMultiChoice && item.options.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {item.options.map((opt) => {
            const picked = responseIds.includes(opt.id);
            const correct = opt.isCorrect;
            const cls = correct
              ? "border-emerald-300 bg-emerald-50"
              : picked
                ? "border-rose-300 bg-rose-50"
                : "border-token";
            return (
              <li
                key={opt.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${cls}`}
              >
                <span className="text-xs font-medium text-faint">
                  {picked ? "▣" : "▢"}
                </span>
                <SafeHtml
                  html={plainToRichHtml(opt.label)}
                  className="prose prose-sm max-w-none flex-1 dark:prose-invert"
                />
                {correct && (
                  <span className="text-xs font-medium text-emerald-700">
                    Đáp án đúng
                  </span>
                )}
                {picked && !correct && (
                  <span className="text-xs font-medium text-rose-700">
                    SV chọn
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isMultiChoice && (
        <div className="mt-3 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-2.5">
          <div className="text-xs text-faint mb-1">SV trả lời:</div>
          <div className="text-sm whitespace-pre-wrap">
            {item.yourResponse == null
              ? "—"
              : typeof item.yourResponse === "string"
                ? item.yourResponse
                : JSON.stringify(item.yourResponse, null, 2)}
          </div>
        </div>
      )}

      {item.misconceptionCode && (
        <div className="mt-2 text-xs text-amber-700">
          Lỗi tư duy:{" "}
          <code className="rounded bg-amber-50 px-1.5 py-0.5">
            {item.misconceptionCode}
          </code>
        </div>
      )}

      {item.explanation && (
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer text-xs font-medium text-faint hover:text-default">
            Giải thích
          </summary>
          <div className="mt-1.5 whitespace-pre-wrap">{item.explanation}</div>
        </details>
      )}
    </li>
  );
}
