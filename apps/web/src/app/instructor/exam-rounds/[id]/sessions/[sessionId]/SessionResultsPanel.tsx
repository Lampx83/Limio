"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

export interface CandidateResult {
  id: string;
  /** Latest attempt id (null if candidate hasn't started). Needed for re-grade. */
  attemptId: string | null;
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
  const router = useRouter();
  // Per-row "đang chấm lại" busy state, keyed by attemptId.
  const [regrading, setRegrading] = useState<Set<string>>(new Set());

  async function regrade(attemptId: string) {
    setRegrading((prev) => new Set(prev).add(attemptId));
    try {
      const res = await fetch(
        apiUrl(`/api/exam-attempts/${attemptId}/regrade`),
        { method: "POST" },
      );
      if (res.ok) {
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        alert(`Chấm lại thất bại: ${body?.error ?? res.statusText}`);
      }
    } finally {
      setRegrading((prev) => {
        const next = new Set(prev);
        next.delete(attemptId);
        return next;
      });
    }
  }

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
              <th className="px-3 py-2 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default bg-white">
            {candidates.map((c) => {
              // Stuck attempts: học viên đã nộp (hoặc hết giờ) nhưng score vẫn
              // null — auto-grade worker chưa chạy. Cho phép instructor bấm
              // "Chấm lại" để chấm đồng bộ ngay tại request, không qua queue.
              const isStuck =
                c.attemptId !== null &&
                (c.attemptStatus === "submitted" ||
                  c.attemptStatus === "auto_submitted") &&
                c.score === null;
              const isBusy = c.attemptId !== null && regrading.has(c.attemptId);
              return (
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
                  <td className="px-3 py-2 text-right">
                    {isStuck && c.attemptId ? (
                      <button
                        type="button"
                        onClick={() => regrade(c.attemptId!)}
                        disabled={isBusy}
                        title="Bài đã nộp nhưng chưa được chấm — bấm để chấm ngay"
                        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={isBusy ? "animate-spin" : ""} />
                        {isBusy ? "Đang chấm…" : "Chấm lại"}
                      </button>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        Trailer note — giải thích cho instructor khi nào nút "Chấm lại" xuất
        hiện, để cô không bối rối khi thấy bài có dấu chấm than màu cam.
      */}
      {candidates.some(
        (c) =>
          c.attemptId !== null &&
          (c.attemptStatus === "submitted" ||
            c.attemptStatus === "auto_submitted") &&
          c.score === null,
      ) && (
        <p className="text-[11px] text-amber-700">
          ⚠️ Có bài đã nộp nhưng hệ thống chưa chấm tự động được. Bấm{" "}
          <strong>Chấm lại</strong> ở từng dòng để chấm ngay, hoặc đợi tối đa{" "}
          1 phút để hệ thống tự chạy lại.
        </p>
      )}
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
