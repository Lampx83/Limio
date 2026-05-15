"use client";

import { useEffect, useState } from "react";

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

export default function AnalyticsPanel({ examId }: { examId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/exams/${examId}/analytics`);
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { items: Item[] };
      setItems(j.items);
    })();
  }, [examId]);

  const visible = items
    ? showOnlyFlagged
      ? items.filter((i) => i.flags.length > 0)
      : items
    : null;

  const flaggedCount = items?.filter((i) => i.flags.length > 0).length ?? 0;

  return (
    <section
      data-testid="analytics-panel"
      className="mt-8 rounded border border-default bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">📊 Item Analytics</h2>
          <p className="text-sm text-faint">
            P-value (độ khó) · Discrimination (phân biệt SV giỏi/yếu) · Distractor (lựa chọn từng đáp án).
            Chạy nightly 02:00 hoặc trigger thủ công.
          </p>
        </div>
        {flaggedCount > 0 && (
          <button
            onClick={() => setShowOnlyFlagged((s) => !s)}
            className={`rounded border px-3 py-1.5 text-sm ${
              showOnlyFlagged
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-default bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {showOnlyFlagged ? `✓ Đang lọc cờ (${flaggedCount})` : `⚠ ${flaggedCount} câu cần rà`}
          </button>
        )}
      </div>

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-default text-left text-xs uppercase text-faint">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Câu hỏi</th>
              <th className="px-2 py-2 text-right">Lượt thi</th>
              <th className="px-2 py-2 text-right">p-value</th>
              <th className="px-2 py-2 text-right">Disc</th>
              <th className="px-2 py-2">Cờ</th>
            </tr>
          </thead>
          <tbody>
            {visible === null && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-faint">Đang tải...</td></tr>
            )}
            {visible && visible.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-faint">
                {showOnlyFlagged ? "Không có câu nào bị cờ." : "Chưa có analytics (cần ≥5 lượt thi)."}
              </td></tr>
            )}
            {visible?.map((it) => (
              <tr
                key={it.id}
                data-testid={`analytics-row-${it.id}`}
                className={`border-b border-default ${it.flags.length > 0 ? "bg-amber-50/40" : ""}`}
              >
                <td className="px-2 py-2 font-mono text-xs">{it.orderInExam + 1}</td>
                <td className="px-2 py-2">
                  <div className="line-clamp-2 text-sm">{it.prompt}</div>
                  <div className="mt-0.5 text-[10px] uppercase text-faint">
                    {it.type} · {it.points} điểm
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
                        className={`rounded px-1.5 py-0.5 text-[10px] ${FLAG_TONE[f] ?? "bg-slate-100"}`}
                      >
                        {FLAG_LABEL[f] ?? f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PValueBadge({ v }: { v: number }) {
  if (v < 0) return <span className="text-faint">—</span>;
  const tone =
    v < 0.2 ? "text-red-700" : v > 0.95 ? "text-amber-700" : "text-emerald-700";
  return <span className={`font-mono ${tone}`}>{v.toFixed(2)}</span>;
}

function DiscBadge({ v }: { v: number }) {
  if (v < -1) return <span className="text-faint">—</span>;
  const tone =
    v < 0.1 ? "text-red-700" : v > 0.3 ? "text-emerald-700" : "text-slate-700";
  return <span className={`font-mono ${tone}`}>{v.toFixed(2)}</span>;
}
