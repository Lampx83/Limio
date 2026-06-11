type Row = {
  rank: number;
  name: string;
  score: number | null;
  isFinal: boolean;
  isMine: boolean;
};

/**
 * Bảng xếp hạng mission cho SV: Top 10 + dòng "nhóm bạn" nếu ngoài top.
 * Điểm chưa chốt hiển thị "tạm tính". Read-only.
 */
export default function MissionRankingPanel({
  top,
  mine,
}: {
  top: Row[];
  mine: { rank: number; total: number; score: number | null } | null;
}) {
  if (top.length === 0) return null;
  const mineInTop = top.some((r) => r.isMine);

  const ScoreCell = ({
    score,
    isFinal,
  }: {
    score: number | null;
    isFinal: boolean;
  }) =>
    score === null ? (
      <span className="text-faint">—</span>
    ) : (
      <>
        {Math.round(score * 100)}%
        {!isFinal && (
          <span className="ml-1 text-[10px] text-amber-600">tạm tính</span>
        )}
      </>
    );

  return (
    <section className="overflow-hidden rounded-xl border border-token">
      <div className="flex items-center justify-between bg-[rgb(var(--surface-muted))] px-3 py-2">
        <h2 className="text-sm font-semibold">🏆 Xếp hạng mission</h2>
        <span className="text-[11px] text-faint">
          Điểm chưa chốt là <em>tạm tính</em>
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-faint">
          <tr className="border-b border-token">
            <th className="px-3 py-1.5 font-medium">#</th>
            <th className="px-3 py-1.5 font-medium">Nhóm</th>
            <th className="px-3 py-1.5 font-medium">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => (
            <tr
              key={r.rank}
              className={`border-b border-token last:border-0 ${
                r.isMine ? "bg-brand-soft/60 font-medium" : ""
              }`}
            >
              <td className="px-3 py-1.5 tabular-nums text-muted">{r.rank}</td>
              <td className="px-3 py-1.5">
                {r.name}
                {r.isMine && (
                  <span className="ml-1 text-[10px] text-brand-700 dark:text-brand-300">
                    (nhóm bạn)
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5 tabular-nums">
                <ScoreCell score={r.score} isFinal={r.isFinal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {mine && !mineInTop && (
        <div className="border-t border-token bg-brand-soft/40 px-3 py-2 text-sm">
          Nhóm bạn đang hạng{" "}
          <strong>
            {mine.rank}/{mine.total}
          </strong>
          {mine.score !== null && (
            <span className="ml-1 tabular-nums text-muted">
              · {Math.round(mine.score * 100)}%
            </span>
          )}
        </div>
      )}
    </section>
  );
}
