"use client";

import { Download } from "lucide-react";

export interface CandidateResult {
  id: string;
  displayName: string;
  accessCode: string;
  roomId: string;
  roomName: string;
  attemptStatus: "submitted" | "auto_submitted" | "graded" | "in_progress" | "none";
  score: number | null;
  scorePct: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

interface Props {
  roundId: string;
  sessionId: string;
  candidates: CandidateResult[];
}

const STATUS_LABEL: Record<CandidateResult["attemptStatus"], string> = {
  submitted: "Đã nộp",
  auto_submitted: "Hết giờ",
  graded: "Đã chấm",
  in_progress: "Đang thi",
  none: "Chưa vào",
};

const STATUS_TONE: Record<CandidateResult["attemptStatus"], string> = {
  submitted: "bg-blue-100 text-blue-800",
  auto_submitted: "bg-amber-100 text-amber-800",
  graded: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-purple-100 text-purple-800",
  none: "bg-slate-100 text-slate-600",
};

export default function SessionResultsPanel({ roundId, sessionId, candidates }: Props) {
  if (candidates.length === 0) {
    return (
      <div className="rounded border border-dashed border-default px-4 py-10 text-center text-sm text-faint">
        Ca thi chưa có thí sinh nào. Thêm thí sinh ở tab Phòng thi.
      </div>
    );
  }

  const submitted = candidates.filter((c) =>
    ["submitted", "auto_submitted", "graded"].includes(c.attemptStatus),
  );
  const graded = candidates.filter((c) => c.attemptStatus === "graded");
  const passed = candidates.filter((c) => c.passed === true);
  const scorePcts = candidates.flatMap((c) => (c.scorePct !== null ? [c.scorePct] : []));
  const avgPct =
    scorePcts.length > 0
      ? scorePcts.reduce((a, b) => a + b, 0) / scorePcts.length
      : null;

  return (
    <div className="space-y-4">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Thí sinh" value={candidates.length} />
        <StatCard label="Đã nộp" value={`${submitted.length} / ${candidates.length}`} />
        <StatCard
          label="Điểm TB"
          value={avgPct !== null ? `${avgPct.toFixed(1)}%` : "—"}
        />
        <StatCard
          label="Đạt"
          value={
            graded.length > 0
              ? `${passed.length} / ${graded.length} (${Math.round((passed.length / graded.length) * 100)}%)`
              : "—"
          }
        />
      </div>

      {/* Header row with download */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{candidates.length} thí sinh</p>
        <a
          href={`/api/exam-rounds/${roundId}/gradebook?sessionId=${sessionId}`}
          download
          className="inline-flex items-center gap-1.5 rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          <Download size={13} />
          Xuất bảng điểm ca thi (CSV)
        </a>
      </div>

      {/* Per-candidate table */}
      <div className="overflow-x-auto rounded-lg border border-default">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-default bg-slate-50 text-left text-faint">
              <th className="px-3 py-2 font-medium">Thí sinh</th>
              <th className="px-3 py-2 font-medium">Phòng</th>
              <th className="px-3 py-2 font-medium">Mã dự thi</th>
              <th className="px-3 py-2 font-medium text-right">Trạng thái</th>
              <th className="px-3 py-2 font-medium text-right">Điểm %</th>
              <th className="px-3 py-2 font-medium text-right">Kết quả</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default bg-white">
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{c.displayName}</td>
                <td className="px-3 py-2 text-faint">{c.roomName}</td>
                <td className="px-3 py-2 font-mono text-faint">{c.accessCode}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_TONE[c.attemptStatus]}`}>
                    {STATUS_LABEL[c.attemptStatus]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.scorePct !== null ? `${c.scorePct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.passed === null ? (
                    <span className="text-faint">—</span>
                  ) : c.passed ? (
                    <span className="font-medium text-emerald-700">Đạt</span>
                  ) : (
                    <span className="font-medium text-red-700">Chưa đạt</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-default px-3 py-2.5">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
