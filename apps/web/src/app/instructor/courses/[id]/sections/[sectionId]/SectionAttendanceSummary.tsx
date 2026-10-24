import type { SectionAttendanceSummary as Summary } from "@feedbackme/core-lms";

/**
 * Chuyên cần của lớp (CENTER C2.10). Chỉ gợi ý để giáo viên chú ý, không tự nhắn ai.
 * Tỉ lệ = (có mặt + muộn) / (có mặt + muộn + vắng); buổi có phép không tính.
 */
export default function SectionAttendanceSummary({ summary }: { summary: Summary }) {
  if (summary.learners.length === 0) return null;
  const flagged = summary.learners.filter((l) => l.needsAttention);

  return (
    <section className="mt-8" aria-labelledby="chuyen-can-heading">
      <h2 id="chuyen-can-heading" className="text-h3">
        Chuyên cần
      </h2>
      <p className="mt-1 text-sm text-muted">
        {summary.meetingsHeld === 0
          ? "Lớp chưa có buổi nào đã diễn ra."
          : `Tính trên ${summary.meetingsHeld} buổi đã diễn ra.`}
      </p>

      {flagged.length > 0 && (
        <div className="banner-warning mt-3 text-sm">
          <p className="font-medium">Cần chú ý ({flagged.length} học viên vắng từ 2 buổi liên tiếp trở lên):</p>
          <p className="mt-1">{flagged.map((l) => `${l.displayName} (${l.consecutiveAbsent} buổi)`).join(", ")}</p>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-2xl border border-token bg-[rgb(var(--surface))]">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-[rgb(var(--surface-muted))/0.5] text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">Học viên</th>
              <th className="px-4 py-2">Có mặt</th>
              <th className="px-4 py-2">Muộn</th>
              <th className="px-4 py-2">Vắng</th>
              <th className="px-4 py-2">Có phép</th>
              <th className="px-4 py-2">Chuyên cần</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {summary.learners.map((l) => (
              <tr key={l.userId} className={l.needsAttention ? "bg-yellow-50/60 dark:bg-yellow-950/20" : ""}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{l.displayName}</p>
                  {l.needsAttention && <p className="text-xs text-yellow-800 dark:text-yellow-300">Vắng {l.consecutiveAbsent} buổi liên tiếp</p>}
                </td>
                <td className="px-4 py-2.5">{l.present}</td>
                <td className="px-4 py-2.5">{l.late}</td>
                <td className="px-4 py-2.5">{l.absent}</td>
                <td className="px-4 py-2.5">{l.excused}</td>
                <td className="px-4 py-2.5">{l.attendedRate === null ? "—" : `${Math.round(l.attendedRate * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
