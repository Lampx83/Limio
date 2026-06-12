"use client";

import { useState, type ReactNode } from "react";
import { Crown, Medal } from "lucide-react";

type Row = {
  rank: number;
  name: string;
  score: number | null;
  isFinal: boolean;
  isMine: boolean;
};
type MissionTab = { id: string; title: string; rows: Row[] };

/**
 * Tab xếp hạng: "Tổng giải" (overall — JSX server truyền vào) + từng mission
 * PEER_REVIEW. Cho SV xem xếp hạng mỗi mission ngay trên trang giải, không phải
 * vào trang nộp bài.
 */
export default function LeaderboardTabs({
  overall,
  missions,
}: {
  overall: ReactNode;
  missions: MissionTab[];
}) {
  const [active, setActive] = useState<string>("overall");
  // Không có mission peer review → chỉ hiện bảng tổng, khỏi tab.
  if (missions.length === 0) return <>{overall}</>;

  const activeMission =
    active === "overall" ? null : missions.find((m) => m.id === active);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5">
        <TabButton
          active={active === "overall"}
          onClick={() => setActive("overall")}
        >
          Tổng giải
        </TabButton>
        {missions.map((m) => (
          <TabButton
            key={m.id}
            active={active === m.id}
            onClick={() => setActive(m.id)}
          >
            {m.title}
          </TabButton>
        ))}
      </div>

      <div className="mt-4">
        {active === "overall" ? (
          overall
        ) : activeMission ? (
          <MissionTable rows={activeMission.rows} />
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function scoreLabel(r: Row): ReactNode {
  if (r.score === null) return <span className="text-slate-400">—</span>;
  return (
    <>
      {Math.round(r.score * 100)}%
      {!r.isFinal && (
        <span className="ml-1 text-[10px] font-medium text-amber-600">
          tạm tính
        </span>
      )}
    </>
  );
}

const MEDAL_COLOR: Record<number, string> = {
  1: "text-amber-500",
  2: "text-slate-400",
  3: "text-orange-600",
};
function RankMedal({ rank, className = "h-9 w-9 drop-shadow-md" }: { rank: number; className?: string }) {
  return <Medal className={`${className} ${MEDAL_COLOR[rank] ?? "text-slate-400"}`} aria-label={`Hạng ${rank}`} />;
}

function MissionTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-orange-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-orange-700 dark:bg-slate-800">
        Chưa có bài nộp nào cho nhiệm vụ này.
      </p>
    );
  }
  const byRank = (n: number) => rows.find((r) => r.rank === n);
  const rest = rows.filter((r) => r.rank > 3);
  return (
    <>
      {/* Podium top 3 — như bảng xếp hạng tổng */}
      <div className="grid grid-cols-3 items-end gap-3">
        <PodiumSlot row={byRank(2)} rank={2} height="h-32 sm:h-36" gradient="from-slate-300 to-slate-400" />
        <PodiumSlot row={byRank(1)} rank={1} height="h-40 sm:h-48" gradient="from-yellow-400 to-amber-500" crown />
        <PodiumSlot row={byRank(3)} rank={3} height="h-28 sm:h-32" gradient="from-orange-400 to-amber-600" />
      </div>

      {/* Bảng chi tiết hạng 4+ */}
      {rest.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-orange-200/60 bg-white shadow-md dark:border-orange-900/40 dark:bg-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hạng</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nhóm</th>
                <th className="px-4 py-3 text-right font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rest.map((r) => (
                <tr key={r.rank} className={r.isMine ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30" : ""}>
                  <td className="w-16 px-4 py-3 font-black tabular-nums text-slate-700 dark:text-slate-300">#{r.rank}</td>
                  <td className="px-4 py-3">
                    <span className={r.isMine ? "font-bold text-rose-700 dark:text-rose-400" : "font-medium text-slate-800 dark:text-slate-200"}>
                      {r.name}
                      {r.isMine && <span className="ml-1.5 text-xs font-medium text-slate-500">(nhóm bạn)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">{scoreLabel(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PodiumSlot({
  row,
  rank,
  height,
  gradient,
  crown,
}: {
  row?: Row;
  rank: number;
  height: string;
  gradient: string;
  crown?: boolean;
}) {
  if (!row) {
    return (
      <div className={`flex ${height} flex-col items-center justify-end rounded-t-xl bg-slate-100 px-2 py-3 text-center dark:bg-slate-800`}>
        <RankMedal rank={rank} className="h-8 w-8 opacity-30" />
        <span className="mt-1 text-xs font-bold text-slate-400">Hạng {rank}</span>
      </div>
    );
  }
  return (
    <div
      className={`relative flex ${height} flex-col items-center justify-end rounded-t-xl bg-gradient-to-b ${gradient} px-2 py-3 text-center shadow-lg ${
        row.isMine ? "ring-4 ring-rose-500/60 ring-offset-2 ring-offset-amber-50 dark:ring-offset-slate-900" : ""
      }`}
    >
      {crown && (
        <Crown aria-hidden className="absolute -top-7 left-1/2 h-8 w-8 -translate-x-1/2 text-amber-400 drop-shadow-lg" fill="currentColor" />
      )}
      <RankMedal rank={rank} />
      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-900 sm:text-sm">
        {row.name}
        {row.isMine && <span className="ml-1 opacity-80">(nhóm bạn)</span>}
      </p>
      <p className="mt-0.5 rounded-full bg-white/70 px-2 py-0.5 text-xs font-black tabular-nums text-slate-900">
        {scoreLabel(row)}
      </p>
    </div>
  );
}
