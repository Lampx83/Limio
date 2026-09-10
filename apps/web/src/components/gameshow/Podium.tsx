"use client";

import { useMemo } from "react";
import { teamColorClasses } from "@/lib/gameshow/teams";
import type { LiveParticipant, TeamStanding } from "@/lib/gameshow/types";
import { RankBadge, initials, avatarGradient } from "@/components/gameshow/RankBadge";

const PODIUM_HEIGHT = ["h-40 sm:h-56", "h-28 sm:h-40", "h-20 sm:h-28"];
// Hiện theo thứ tự #2 - #1 - #3 (giống bục thật), nhưng animation-delay phải
// theo thứ tự TIẾT LỘ mong muốn: hạng 3 lên trước, rồi hạng 2, rồi hạng 1
// lên sau cùng kịch tính nhất — ngược hẳn với animation-delay = rank cũ (bug
// cũ: hạng 1 lại lên đầu tiên vì rank=0 -> delay=0).
const PODIUM_DISPLAY_ORDER = [1, 0, 2];
const REVEAL_DELAY_MS: Record<number, number> = { 2: 0, 1: 450, 0: 900 };

type Entry = LiveParticipant | TeamStanding;

function isTeam(e: Entry): e is TeamStanding {
  return "avgScore" in e;
}

export function Confetti({ count = 28 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i * 0.11) % 2.2}s`,
        duration: `${1.8 + (i % 5) * 0.3}s`,
        drift: `${((i % 7) - 3) * 14}px`,
        color: ["#facc15", "#f472b6", "#84cc16", "#60a5fa", "#fb923c"][i % 5],
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((c, i) => (
        <span
          key={i}
          className="gs-confetti absolute top-0 h-2.5 w-2.5 rounded-sm"
          style={{
            left: c.left,
            backgroundColor: c.color,
            animationDelay: c.delay,
            animationDuration: c.duration,
            ["--gs-drift" as string]: c.drift,
          }}
        />
      ))}
    </div>
  );
}

/** Bục vinh danh top-3 (cá nhân hoặc đội) + danh sách hạng 4+ cuộn được. */
export function Podium({
  teamModeEnabled,
  participants,
  teamStandings,
  highlightTeamId,
  highlightParticipantId,
}: {
  teamModeEnabled: boolean;
  participants: LiveParticipant[];
  teamStandings: TeamStanding[];
  highlightTeamId?: string | null;
  highlightParticipantId?: string | null;
}) {
  const top3: (Entry | undefined)[] = teamModeEnabled
    ? teamStandings.slice(0, 3)
    : participants.slice(0, 3);
  const rest: Entry[] = teamModeEnabled ? teamStandings.slice(3) : participants.slice(3);
  const empty = teamModeEnabled ? teamStandings.length === 0 : participants.length === 0;

  return (
    <div className="relative">
      <Confetti />
      <div className="relative flex items-end justify-center gap-3 overflow-hidden pb-2 sm:gap-6">
        {PODIUM_DISPLAY_ORDER.map((rank) => {
          const entry = top3[rank];
          if (!entry) return <div key={rank} className="w-24 sm:w-32" />;
          const team = isTeam(entry) ? entry : null;
          const p = !team ? (entry as LiveParticipant) : null;
          const colors = team ? teamColorClasses(team.colorKey) : null;
          const key = team ? team.teamId : p!.participantId;
          const score = team ? team.avgScore : p!.totalScore;
          const mine = team
            ? highlightTeamId === team.teamId
            : highlightParticipantId === p!.participantId;
          return (
            <div
              key={key}
              className="gs-podium-rise flex w-24 flex-col items-center sm:w-32"
              style={{ animationDelay: `${REVEAL_DELAY_MS[rank]}ms` }}
            >
              <div className="gs-float mb-2 flex flex-col items-center">
                <RankBadge rank={rank + 1} size="lg" />
                {team ? (
                  <>
                    <span
                      className={`mt-2 flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white sm:h-14 sm:w-14 sm:text-base ${teamColorClasses(team.colorKey).bg}`}
                    >
                      {initials(team.name)}
                    </span>
                    <span className="mt-1 max-w-[6rem] truncate text-sm font-bold sm:max-w-[8rem]">
                      {team.name}
                    </span>
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {team.members.slice(0, 6).map((m) => (
                        <span
                          key={m.participantId}
                          title={m.displayName}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ background: avatarGradient(m.participantId) }}
                        >
                          {initials(m.displayName)}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white sm:h-14 sm:w-14 sm:text-base"
                      style={{ background: avatarGradient(p!.participantId) }}
                    >
                      {initials(p!.displayName)}
                    </span>
                    <span className="mt-1 max-w-[6rem] truncate text-sm font-bold sm:max-w-[8rem]">
                      {p!.displayName}
                    </span>
                  </>
                )}
                <span className="text-xs font-semibold text-amber-300">{score} điểm</span>
              </div>
              <div
                className={`w-full rounded-t-xl ${PODIUM_HEIGHT[rank]} ${
                  colors
                    ? colors.bg
                    : rank === 0
                      ? "bg-gradient-to-b from-amber-300 to-amber-500"
                      : rank === 1
                        ? "bg-gradient-to-b from-slate-200 to-slate-400"
                        : "bg-gradient-to-b from-orange-300 to-orange-500"
                } flex items-start justify-center pt-2 text-2xl font-black text-white/90 ${
                  mine ? "ring-4 ring-white" : ""
                }`}
              >
                {rank + 1}
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="relative mx-auto mt-8 max-h-64 max-w-md space-y-1.5 overflow-y-auto text-left">
          {rest.map((entry, i) => {
            const team = isTeam(entry) ? entry : null;
            const p = !team ? (entry as LiveParticipant) : null;
            const key = team ? team.teamId : p!.participantId;
            const mine = team
              ? highlightTeamId === team.teamId
              : highlightParticipantId === p!.participantId;
            return (
              <li
                key={key}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  mine ? "bg-white/25 ring-2 ring-white/60" : "bg-white/10"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 flex-none text-right text-xs font-bold text-white/50">
                    {i + 4}
                  </span>
                  {team ? (
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-black text-white ${teamColorClasses(team.colorKey).bg}`}
                    >
                      {initials(team.name)}
                    </span>
                  ) : (
                    <span
                      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ background: avatarGradient(p!.participantId) }}
                    >
                      {initials(p!.displayName)}
                    </span>
                  )}
                  <span className="truncate">{team ? team.name : p!.displayName}</span>
                </span>
                <span className="flex-none font-bold text-amber-300">
                  {team ? team.avgScore : p!.totalScore}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {empty && <p className="mt-6 text-center text-sm text-white/50">Không có ai tham gia phiên này.</p>}
    </div>
  );
}
