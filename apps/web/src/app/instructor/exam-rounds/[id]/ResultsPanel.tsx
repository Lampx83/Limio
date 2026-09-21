"use client";

import Link from "next/link";
import { Download } from "lucide-react";

export interface SessionSummary {
  id: string;
  code: string;
  title: string;
  examId: string;
  examTitle: string;
  totalCandidates: number;
  submitted: number;
  graded: number;
  avgScorePct: number | null;
  passCount: number;
}

interface Props {
  roundId: string;
  sessions: SessionSummary[];
}

export default function ResultsPanel({ roundId, sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="rounded border border-dashed border-default px-4 py-10 text-center text-sm text-faint">
        Chưa có ca thi nào. Thêm ca thi ở tab Ca thi.
      </div>
    );
  }

  // Aggregate across all sessions that share the same exam.
  const byExam = new Map<string, { examId: string; examTitle: string; sessions: SessionSummary[] }>();
  for (const s of sessions) {
    if (!byExam.has(s.examId)) {
      byExam.set(s.examId, { examId: s.examId, examTitle: s.examTitle, sessions: [] });
    }
    byExam.get(s.examId)!.sessions.push(s);
  }

  const totalCandidatesAll = sessions.reduce((n, s) => n + s.totalCandidates, 0);

  return (
    <div className="space-y-6">
      {/* Round-level bulk download */}
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">{totalCandidatesAll} thí sinh</span> — toàn bộ ca thi trong đợt
        </p>
        <a
          href={`/api/exam-rounds/${roundId}/gradebook`}
          download
          className="inline-flex items-center gap-1.5 rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
        >
          <Download size={13} />
          Xuất toàn bộ đợt thi (CSV)
        </a>
      </div>
      {Array.from(byExam.values()).map(({ examId, examTitle, sessions: ss }) => {
        const totalCandidates = ss.reduce((n, s) => n + s.totalCandidates, 0);
        const totalSubmitted = ss.reduce((n, s) => n + s.submitted, 0);
        const totalGraded = ss.reduce((n, s) => n + s.graded, 0);
        const totalPass = ss.reduce((n, s) => n + s.passCount, 0);
        const avgPcts = ss.flatMap((s) => (s.avgScorePct !== null ? [s.avgScorePct] : []));
        const overallAvg = avgPcts.length > 0
          ? avgPcts.reduce((a, b) => a + b, 0) / avgPcts.length
          : null;

        return (
          <section key={examId} className="rounded-lg border border-default bg-white p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{examTitle}</h2>
                <p className="text-xs text-faint">{ss.length} ca thi</p>
              </div>
              <a
                href={`/api/exams/${examId}/gradebook?roomId=all`}
                download
                className="inline-flex items-center gap-1.5 rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                <Download size={13} />
                Xuất bảng điểm (CSV)
              </a>
            </div>

            {/* Aggregate stats */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Thí sinh" value={totalCandidates} />
              <StatCard label="Đã nộp" value={`${totalSubmitted} / ${totalCandidates}`} />
              <StatCard
                label="Điểm TB"
                value={overallAvg !== null ? `${overallAvg.toFixed(1)}%` : "—"}
              />
              <StatCard
                label="Đạt"
                value={
                  totalGraded > 0
                    ? `${totalPass} / ${totalGraded} (${Math.round((totalPass / totalGraded) * 100)}%)`
                    : "—"
                }
              />
            </div>

            {/* Một ca duy nhất: bảng theo ca sẽ chỉ lặp lại số tổng, nên chỉ đưa lối vào chi tiết. */}
            {ss.length === 1 && (
              <p className="mb-2 text-xs">
                <Link
                  href={`/instructor/exam-runs/${ss[0]!.id}`}
                  className="text-blue-600 hover:underline"
                >
                  Xem chi tiết kết quả của ca →
                </Link>
              </p>
            )}

            {/* Per-session breakdown */}
            {ss.length > 1 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-default text-left text-faint">
                    <th className="pb-1.5 pr-3 font-medium">Ca thi</th>
                    <th className="pb-1.5 pr-3 font-medium text-right">Thí sinh</th>
                    <th className="pb-1.5 pr-3 font-medium text-right">Đã nộp</th>
                    <th className="pb-1.5 pr-3 font-medium text-right">Điểm TB</th>
                    <th className="pb-1.5 pr-3 font-medium text-right">Đạt</th>
                    <th className="pb-1.5 font-medium text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {ss.map((s) => (
                    <tr key={s.id}>
                      <td className="py-1.5 pr-3">
                        <span className="font-mono text-faint">{s.code}</span>
                        {" "}
                        <span>{s.title}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{s.totalCandidates}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{s.submitted}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {s.avgScorePct !== null ? `${s.avgScorePct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {s.graded > 0 ? `${s.passCount}/${s.graded}` : "—"}
                      </td>
                      <td className="py-1.5 text-right">
                        <Link
                          href={`/instructor/exam-runs/${s.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Xem →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
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
