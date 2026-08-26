"use client";

import { Fragment, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { AlertTriangle, BarChart2, Check } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

type Item = {
  id: string;
  orderInExam: number;
  prompt: string;
  type: string;
  points: number;
  attemptCount: number;
  correctCount: number;
  pValue: number;
  discrimination: number;
  distractorStats: Record<string, { chosenBy: number; isCorrect: boolean }> | null;
  computedAt: string | null;
  flags: string[];
};

type Reliability = {
  n: number;
  mean: number;
  sd: number;
  alpha: number;
  computedAt: string;
};

type DistBin = { bin: number; label: string; count: number };

const FLAG_LABEL: Record<string, string> = {
  too_hard: "Quá khó (p < 0.2)",
  too_easy: "Quá dễ (p > 0.95)",
  low_discrimination: "Phân biệt yếu (disc < 0.1)",
};
const FLAG_TONE: Record<string, string> = {
  too_hard: "bg-red-100 text-red-800",
  too_easy: "bg-amber-100 text-amber-800",
  low_discrimination: "bg-orange-100 text-orange-800",
};

/**
 * `sessionId` = chỉ tính trên bài làm của MỘT đợt thi. Không truyền thì đọc
 * số đã chốt sẵn, gộp mọi đợt của gói đề.
 */
export default function AnalyticsPanel({
  examId,
  sessionId,
}: {
  examId: string;
  sessionId?: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [reliability, setReliability] = useState<Reliability | null | undefined>(undefined);
  const [distribution, setDistribution] = useState<DistBin[] | null | undefined>(undefined);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const r = await fetch(
      apiUrl(
        `/api/exams/${examId}/analytics${sessionId ? `?sessionId=${sessionId}` : ""}`,
      ),
    );
    if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
    const j = (await r.json()) as { items: Item[]; reliability: Reliability | null; distribution: DistBin[] | null };
    setItems(j.items);
    setReliability(j.reliability ?? null);
    setDistribution(j.distribution ?? null);
  };

  useEffect(() => { void load(); }, [examId]);

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/analytics/run`, { method: "POST" });
      if (!r.ok) { setErr("Tính toán thất bại."); return; }
      const j = (await r.json()) as { questionsScanned: number; statsWritten: number; durationMs: number };
      setRunResult(`Đã tính ${j.statsWritten}/${j.questionsScanned} câu · ${j.durationMs}ms`);
      await load();
    } finally {
      setRunning(false);
    }
  };

  const visible = items
    ? showOnlyFlagged ? items.filter((i) => i.flags.length > 0) : items
    : null;
  const flaggedCount = items?.filter((i) => i.flags.length > 0).length ?? 0;
  const latestComputedAt = items?.find((i) => i.computedAt)?.computedAt ?? null;

  return (
    <section data-testid="analytics-panel" className="mt-6 space-y-4">

      {/* ── Reliability header ── */}
      <div className="rounded border border-default bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold"><BarChart2 className="h-5 w-5 shrink-0" /> Phân tích đề thi</h2>
            <p className="mt-0.5 text-xs text-faint">
              {latestComputedAt
                ? `Cập nhật lúc ${formatDateTime(latestComputedAt)}`
                : "Chưa có dữ liệu (cần ≥ 5 lượt thi đã nộp)."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {runResult && (
              <span className="text-xs text-emerald-700">{runResult}</span>
            )}
            <a
              href={`/api/exams/${examId}/results`}
              download
              className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              ↓ Xuất CSV
            </a>
            <button
              onClick={handleRun}
              disabled={running}
              className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
            >
              {running ? "Đang tính..." : "⟳ Tính lại ngay"}
            </button>
          </div>
        </div>

        {reliability !== undefined && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ReliabilityStat
              label="Số lượt thi"
              value={reliability ? String(reliability.n) : "—"}
              hint="graded/submitted"
            />
            <ReliabilityStat
              label="Điểm TB"
              value={reliability ? `${reliability.mean}%` : "—"}
              hint="mean total score"
            />
            <ReliabilityStat
              label="Độ lệch chuẩn"
              value={reliability ? `${reliability.sd}%` : "—"}
              hint="SD of scores"
            />
            <ReliabilityStat
              label="Cronbach α"
              value={
                reliability && reliability.alpha >= 0
                  ? reliability.alpha.toFixed(2)
                  : "—"
              }
              tone={
                reliability && reliability.alpha >= 0
                  ? reliability.alpha >= 0.7
                    ? "text-emerald-700"
                    : reliability.alpha >= 0.5
                    ? "text-amber-700"
                    : "text-red-700"
                  : "text-faint"
              }
              hint="≥ 0.7 tốt"
            />
          </div>
        )}
        {reliability && reliability.alpha >= 0 && (
          <p className="mt-2 text-[11px] text-faint">
            {reliability.alpha >= 0.8
              ? "Độ tin cậy cao — đề đo lường nhất quán."
              : reliability.alpha >= 0.7
              ? "Độ tin cậy đạt yêu cầu."
              : reliability.alpha >= 0.5
              ? "Độ tin cậy trung bình — xem xét cải thiện câu có D thấp."
              : "Độ tin cậy thấp — nhiều câu không đồng nhất với tổng điểm."}
          </p>
        )}
      </div>

      {/* ── Charts: Distribution + Scatter ── */}
      {(distribution || (items && items.some((i) => i.pValue >= 0))) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {distribution && (
            <div className="rounded border border-default bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold">Phân phối điểm thi</h3>
              <HistogramChart bins={distribution} />
            </div>
          )}
          {items && items.some((i) => i.pValue >= 0 && i.discrimination >= -1) && (
            <div className="rounded border border-default bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold">Bản đồ câu hỏi (p × D)</h3>
              <ScatterChart items={items} />
            </div>
          )}
        </div>
      )}

      {/* ── Item table ── */}
      <div className="rounded border border-default bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Phân tích từng câu</h3>
          {flaggedCount > 0 && (
            <button
              onClick={() => setShowOnlyFlagged((s) => !s)}
              className={`rounded border px-2.5 py-1 text-xs ${
                showOnlyFlagged
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-default bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {showOnlyFlagged
                ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Đang lọc cờ ({flaggedCount})</span>
                : <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {flaggedCount} câu cần rà</span>}
            </button>
          )}
        </div>

        {err && (
          <div className="mb-3 flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {err}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-default text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="w-8 px-2 py-2">#</th>
                <th className="px-2 py-2">Câu hỏi</th>
                <th className="w-16 px-2 py-2 text-right">Lượt</th>
                <th className="w-20 px-2 py-2 text-right">p-value</th>
                <th className="w-20 px-2 py-2 text-right">Disc</th>
                <th className="w-40 px-2 py-2">Cờ</th>
              </tr>
            </thead>
            <tbody>
              {visible === null && (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-faint">
                    Đang tải...
                  </td>
                </tr>
              )}
              {visible && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-sm text-faint">
                    {showOnlyFlagged
                      ? "Không có câu nào bị cờ."
                      : "Chưa có analytics — cần ≥ 5 lượt thi đã nộp, sau đó bấm \"Tính lại ngay\"."}
                  </td>
                </tr>
              )}
              {visible?.map((it) => (
                <Fragment key={it.id}>
                  <tr
                    data-testid={`analytics-row-${it.id}`}
                    onClick={() =>
                      it.distractorStats
                        ? setExpandedId(expandedId === it.id ? null : it.id)
                        : undefined
                    }
                    className={`border-b border-default ${it.distractorStats ? "cursor-pointer hover:bg-slate-50" : ""} ${
                      it.flags.length > 0 ? "bg-amber-50/40" : ""
                    } ${expandedId === it.id ? "bg-blue-50/30" : ""}`}
                  >
                    <td className="px-2 py-2 font-mono text-xs text-faint">
                      {it.orderInExam + 1}
                    </td>
                    <td className="px-2 py-2">
                      <div className="line-clamp-2 text-sm">{it.prompt}</div>
                      <div className="mt-0.5 text-[10px] uppercase text-faint">
                        {it.type} · {it.points}đ
                        {it.distractorStats && (
                          <span className="ml-2 normal-case text-blue-500">
                            {expandedId === it.id ? "▲ Ẩn" : "▼ Xem phân tích lựa chọn"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {it.attemptCount > 0 ? (
                        <>
                          <div>{it.attemptCount}</div>
                          <div className="text-[10px] text-faint">{it.correctCount} đúng</div>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <PValueBadge v={it.pValue} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <DiscBadge v={it.discrimination} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {it.flags.map((f) => (
                          <span
                            key={f}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              FLAG_TONE[f] ?? "bg-slate-100"
                            }`}
                          >
                            {FLAG_LABEL[f] ?? f}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expandedId === it.id && it.distractorStats && (
                    <tr className="border-b border-default bg-slate-50">
                      <td />
                      <td colSpan={5} className="px-4 py-3">
                        <DistractorChart
                          stats={it.distractorStats}
                          totalAttempts={it.attemptCount}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ReliabilityStat({
  label,
  value,
  hint,
  tone = "text-slate-800",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded border border-default bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${tone}`}>{value}</div>
      {hint && <div className="text-[10px] text-faint">{hint}</div>}
    </div>
  );
}

function PValueBadge({ v }: { v: number }) {
  if (v < 0) return <span className="text-faint">—</span>;
  const tone =
    v < 0.2 ? "text-red-700" : v > 0.95 ? "text-amber-700" : "text-emerald-700";
  return <span className={`font-mono text-xs ${tone}`}>{v.toFixed(2)}</span>;
}

function DiscBadge({ v }: { v: number }) {
  if (v < -1) return <span className="text-faint">—</span>;
  const tone =
    v < 0.1 ? "text-red-700" : v > 0.3 ? "text-emerald-700" : "text-slate-600";
  return <span className={`font-mono text-xs ${tone}`}>{v.toFixed(2)}</span>;
}

function DistractorChart({
  stats,
  totalAttempts,
}: {
  stats: Record<string, { chosenBy: number; isCorrect: boolean }>;
  totalAttempts: number;
}) {
  const options = Object.entries(stats).sort(([a], [b]) => a.localeCompare(b));
  const maxChosen = Math.max(...options.map(([, v]) => v.chosenBy), 1);

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-slate-600">
        Phân tích lựa chọn (distractor analysis)
      </div>
      <div className="space-y-1.5">
        {options.map(([optId, data]) => {
          const pct =
            totalAttempts > 0 ? (data.chosenBy / totalAttempts) * 100 : 0;
          const barWidth = maxChosen > 0 ? (data.chosenBy / maxChosen) * 100 : 0;
          return (
            <div key={optId} className="flex items-center gap-2">
              <div
                className={`w-6 shrink-0 text-center text-xs font-bold ${
                  data.isCorrect ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {optId.toUpperCase()}
                {data.isCorrect && <Check className="ml-0.5 inline h-3 w-3 text-emerald-700" />}
              </div>
              <div className="relative h-5 flex-1 rounded bg-slate-200">
                <div
                  className={`absolute left-0 top-0 h-full rounded transition-all ${
                    data.isCorrect ? "bg-emerald-400" : "bg-slate-400"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-right text-xs text-faint">
                {data.chosenBy} SV ({pct.toFixed(0)}%)
              </div>
              {!data.isCorrect && pct > 40 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-amber-700"><AlertTriangle className="h-3 w-3" /> nhiễu mạnh</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-faint">
        Nhiễu hiệu quả: 5–40% SV chọn. Quá nhiều SV chọn mồi nhử →
        câu hỏi gây nhầm lẫn hợp lệ, hoặc đáp án đúng chưa rõ ràng.
      </p>
    </div>
  );
}

// ─── Histogram ────────────────────────────────────────────────────────────────

function HistogramChart({ bins }: { bins: DistBin[] }) {
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  return (
    <div>
      <div className="relative flex gap-0.5" style={{ height: 100 }}>
        {bins.map((b) => {
          const heightPct = (b.count / maxCount) * 100;
          return (
            <div
              key={b.bin}
              className="group relative flex flex-1 flex-col justify-end"
              style={{ height: "100%" }}
            >
              <div
                className="w-full rounded-t bg-blue-400 transition-all group-hover:bg-blue-500"
                style={{ height: `${heightPct}%`, minHeight: heightPct > 0 ? 2 : 0 }}
              />
              {b.count > 0 && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {b.count} SV
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {bins.map((b) => (
          <div key={b.bin} className="flex-1 text-center text-[9px] leading-tight text-faint">
            {b.bin * 10}
          </div>
        ))}
        <div className="w-0 overflow-visible text-[9px] leading-tight text-faint">100</div>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-faint">Điểm (%)</div>
    </div>
  );
}

// ─── p × D Scatter ────────────────────────────────────────────────────────────

const SVG_W = 260;
const SVG_H = 180;
const PAD = { top: 10, right: 10, bottom: 30, left: 36 };
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;

// p: 0–1 → x; D: -0.5–1 → y (higher D = top)
function toX(p: number) { return PAD.left + p * PLOT_W; }
function toY(d: number) {
  const dMin = -0.5, dMax = 1.0;
  return PAD.top + (1 - (d - dMin) / (dMax - dMin)) * PLOT_H;
}

function ScatterChart({ items }: { items: Item[] }) {
  const plotItems = items.filter((i) => i.pValue >= 0 && i.discrimination > -2);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ maxHeight: 200 }}
      >
        {/* Reference bands */}
        {/* Too hard zone (p < 0.2) */}
        <rect
          x={toX(0)} y={PAD.top}
          width={toX(0.2) - toX(0)} height={PLOT_H}
          className="fill-red-50"
        />
        {/* Too easy zone (p > 0.95) */}
        <rect
          x={toX(0.95)} y={PAD.top}
          width={toX(1) - toX(0.95)} height={PLOT_H}
          className="fill-amber-50"
        />
        {/* Low disc zone (D < 0.1) */}
        <rect
          x={PAD.left} y={toY(0.1)}
          width={PLOT_W} height={SVG_H - PAD.bottom - toY(0.1)}
          className="fill-orange-50/60"
        />

        {/* Grid lines */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((p) => (
          <line key={p} x1={toX(p)} y1={PAD.top} x2={toX(p)} y2={PAD.top + PLOT_H}
            className="stroke-slate-200" strokeWidth={0.5} />
        ))}
        {[-0.5, 0, 0.1, 0.3, 0.5, 1.0].map((d) => (
          <line key={d} x1={PAD.left} y1={toY(d)} x2={PAD.left + PLOT_W} y2={toY(d)}
            className="stroke-slate-200" strokeWidth={0.5} />
        ))}
        {/* Key threshold lines */}
        <line x1={toX(0.2)} y1={PAD.top} x2={toX(0.2)} y2={PAD.top + PLOT_H}
          className="stroke-red-300" strokeWidth={1} strokeDasharray="3,2" />
        <line x1={toX(0.95)} y1={PAD.top} x2={toX(0.95)} y2={PAD.top + PLOT_H}
          className="stroke-amber-300" strokeWidth={1} strokeDasharray="3,2" />
        <line x1={PAD.left} y1={toY(0.1)} x2={PAD.left + PLOT_W} y2={toY(0.1)}
          className="stroke-orange-300" strokeWidth={1} strokeDasharray="3,2" />
        <line x1={PAD.left} y1={toY(0.3)} x2={PAD.left + PLOT_W} y2={toY(0.3)}
          className="stroke-emerald-300" strokeWidth={1} strokeDasharray="3,2" />

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H}
          className="stroke-slate-400" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H}
          className="stroke-slate-400" strokeWidth={1} />

        {/* Axis labels */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((p) => (
          <text key={p} x={toX(p)} y={PAD.top + PLOT_H + 10}
            textAnchor="middle" className="fill-slate-400 text-[8px]" fontSize={8}>
            {p.toFixed(1)}
          </text>
        ))}
        {[-0.5, 0, 0.3, 0.5, 1.0].map((d) => (
          <text key={d} x={PAD.left - 4} y={toY(d) + 3}
            textAnchor="end" className="fill-slate-400 text-[8px]" fontSize={8}>
            {d.toFixed(1)}
          </text>
        ))}
        <text x={PAD.left + PLOT_W / 2} y={SVG_H - 2}
          textAnchor="middle" className="fill-slate-500 text-[8px]" fontSize={8}>p-value</text>
        <text x={10} y={PAD.top + PLOT_H / 2}
          textAnchor="middle" transform={`rotate(-90, 10, ${PAD.top + PLOT_H / 2})`}
          className="fill-slate-500 text-[8px]" fontSize={8}>D</text>

        {/* Dots */}
        {plotItems.map((it) => {
          const x = toX(it.pValue);
          const y = toY(it.discrimination);
          const flagged = it.flags.length > 0;
          const isHovered = hovered === it.id;
          return (
            <g key={it.id}
              onMouseEnter={() => setHovered(it.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <circle cx={x} cy={y} r={isHovered ? 6 : 4}
                className={flagged ? "fill-red-500" : "fill-emerald-500"}
                fillOpacity={0.8}
              />
              <text x={x} y={y - 5} textAnchor="middle" fontSize={6}
                className="fill-slate-600 pointer-events-none">
                {it.orderInExam + 1}
              </text>
              {isHovered && (
                <foreignObject x={x + 6} y={y - 24} width={90} height={40}>
                  <div className="rounded bg-slate-800 px-1.5 py-1 text-[9px] text-white shadow">
                    Câu {it.orderInExam + 1}<br />
                    p={it.pValue.toFixed(2)} · D={it.discrimination.toFixed(2)}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-faint">
        <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-0.5" />Ổn</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-0.5" />Cần rà</span>
        <span className="text-red-300">— p=0.2</span>
        <span className="text-amber-300">— p=0.95</span>
        <span className="text-emerald-300">-- D=0.3</span>
      </div>
    </div>
  );
}
