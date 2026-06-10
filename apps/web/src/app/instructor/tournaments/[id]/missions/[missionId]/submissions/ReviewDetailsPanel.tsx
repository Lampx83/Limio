"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Flag } from "lucide-react";

type RubricCol = { id: string; label: string; scale: "1-5" | "pass_fail" };
type Review = {
  reviewerName: string;
  completed: boolean;
  scores: { criterionId: string; score: number }[];
  comment: string | null;
  aggregateScore: number | null;
  deltaFromMedian: number | null;
  flagged: boolean;
  flagReason: string | null;
  xpAwarded: number | null;
};
type Data = {
  status: string;
  finalScore: number | null;
  rubric: RubricCol[];
  reviews: Review[];
};

/**
 * Bảng chi tiết chấm peer review của 1 bài nộp (read-only, cho GV). Lazy-fetch
 * khi mở. Hiện từng reviewer: điểm theo rubric, điểm tổng hợp, lệch median, cờ
 * outlier, nhận xét.
 */
export default function ReviewDetailsPanel({
  tournamentId,
  submissionId,
}: {
  tournamentId: string;
  submissionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data && !busy) {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/instructor/tournaments/${tournamentId}/submissions/${submissionId}/reviews`,
        );
        if (!res.ok) {
          setError("Không tải được chi tiết.");
          return;
        }
        setData((await res.json()) as Data);
      } catch {
        setError("Không kết nối được máy chủ.");
      } finally {
        setBusy(false);
      }
    }
  }

  const fmtPct = (v: number | null) =>
    v === null ? "—" : `${Math.round(v * 100)}%`;
  const done = data?.reviews.filter((r) => r.completed) ?? [];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Chi tiết chấm{" "}
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : data ? (
          `(${done.length} reviewer)`
        ) : null}
      </button>

      {open && error && (
        <p className="mt-1 text-xs text-danger-600">⚠ {error}</p>
      )}

      {open && data && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-token">
          {done.length === 0 ? (
            <p className="p-3 text-xs text-muted">Chưa có reviewer nào chấm xong.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-[rgb(var(--surface-muted))] text-left text-faint">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Reviewer</th>
                  {data.rubric.map((c) => (
                    <th key={c.id} className="px-2 py-1.5 font-medium" title={c.scale}>
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 font-medium">Tổng</th>
                  <th className="px-2 py-1.5 font-medium">Lệch median</th>
                  <th className="px-2 py-1.5 font-medium">Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {done.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-token ${r.flagged ? "bg-warning-50 dark:bg-warning-950/20" : ""}`}
                  >
                    <td className="px-2 py-1.5">
                      <span className="inline-flex items-center gap-1">
                        {r.flagged && (
                          <Flag size={11} className="text-warning-600" />
                        )}
                        {r.reviewerName}
                      </span>
                      {r.flagged && r.flagReason && (
                        <span className="block text-[10px] text-warning-700 dark:text-warning-400">
                          {r.flagReason}
                        </span>
                      )}
                    </td>
                    {data.rubric.map((c) => {
                      const s = r.scores.find((x) => x.criterionId === c.id);
                      return (
                        <td key={c.id} className="px-2 py-1.5">
                          {s
                            ? c.scale === "pass_fail"
                              ? s.score === 1
                                ? "Đạt"
                                : "Chưa"
                              : s.score
                            : "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 font-medium">
                      {fmtPct(r.aggregateScore)}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.deltaFromMedian === null
                        ? "—"
                        : `${r.deltaFromMedian > 0 ? "+" : ""}${Math.round(r.deltaFromMedian * 100)}%`}
                    </td>
                    <td className="max-w-[16rem] whitespace-pre-wrap px-2 py-1.5 text-muted">
                      {r.comment || <span className="text-faint">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-token bg-[rgb(var(--surface-muted))] font-medium">
                  <td className="px-2 py-1.5" colSpan={data.rubric.length + 1}>
                    Điểm cuối (median)
                  </td>
                  <td className="px-2 py-1.5" colSpan={2}>
                    {fmtPct(data.finalScore)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
