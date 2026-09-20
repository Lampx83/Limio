"use client";

import { useState } from "react";
import TournamentMetaForm from "./TournamentMetaForm";
import TournamentMissionManager from "./TournamentMissionManager";
import RegistrationsList, { type Registration } from "./RegistrationsList";
import JudgesPanel from "./JudgesPanel";
import TournamentPrizeForm from "./TournamentPrizeForm";
import { prizeXpForPercent } from "@feedbackme/core-gamification";

interface Tab {
  id: string;
  label: string;
  hidden?: boolean;
}

const TABS: Tab[] = [
  { id: "basic", label: "Thông tin cơ bản" },
  { id: "missions", label: "Nhiệm vụ" },
  { id: "registrations", label: "Đăng ký" },
  { id: "judges", label: "Giám khảo" },
  { id: "prize", label: "Giải thưởng" },
  { id: "leaderboard", label: "Bảng xếp hạng" },
];

export default function InstructorTournamentTabs({
  tournamentId,
  status,
  canEdit,
  initial,
  missions,
  courseId,
  leaderboardSection,
  prizeDistribution,
  prizeXp,
  registrations,
  teamSize,
  tournamentTitle,
  pendingCounts,
}: {
  tournamentId: string;
  status: string;
  canEdit: boolean;
  initial: any;
  missions: any[];
  courseId: string | null;
  leaderboardSection: React.ReactNode;
  prizeDistribution: any;
  prizeXp: number;
  registrations: Registration[];
  teamSize: number;
  tournamentTitle: string;
  pendingCounts: Record<string, number>;
}) {
  const [activeTab, setActiveTab] = useState("basic");

  const showLeaderboard = status === "active" || status === "ended";
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "leaderboard" && !showLeaderboard) return false;
    return true;
  });

  return (
    <div className="mt-8">
      {/* Tab buttons */}
      <div className="flex gap-0.5 border-b border-token overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab.id
                ? "text-brand-600"
                : "text-muted hover:text-[rgb(var(--text))]"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {/* Basic Info Tab */}
        {activeTab === "basic" && canEdit && (
          <div>
            <TournamentMetaForm tournamentId={tournamentId} initial={initial} />
          </div>
        )}

        {activeTab === "basic" && !canEdit && (
          <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-6">
            <p className="text-sm text-muted">
              Không thể chỉnh sửa đấu trường sau khi publish. Liên hệ admin nếu cần thay đổi.
            </p>
          </div>
        )}

        {/* Missions Tab */}
        {activeTab === "missions" && (
          <div>
            <TournamentMissionManager
              tournamentId={tournamentId}
              status={status}
              missions={missions}
              courseId={courseId}
              teamSize={teamSize}
              pendingCounts={pendingCounts}
              tournamentWindow={{ startsAt: initial.startsAt, endsAt: initial.endsAt }}
            />
          </div>
        )}

        {/* Registrations Tab */}
        {activeTab === "registrations" && (
          <RegistrationsList
            registrations={registrations}
            teamSize={teamSize}
            tournamentTitle={tournamentTitle}
          />
        )}

        {/* Judges Tab */}
        {activeTab === "judges" && (
          <JudgesPanel tournamentId={tournamentId} />
        )}

        {/* Prize Tab */}
        {activeTab === "prize" && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold">Tổng giải thưởng</h3>
              <p className="mt-4 text-3xl font-bold text-accent-600">
                {prizeXp.toLocaleString()} XP
              </p>
            </div>

            {prizeDistribution && typeof prizeDistribution === "object" ? (
              <div className="card">
                <h3 className="text-lg font-semibold">Phân phối theo hạng</h3>
                <dl className="mt-4 space-y-3">
                  {Object.entries(prizeDistribution as Record<string, number>)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([place, pct]) => {
                      const xp = prizeXpForPercent(prizeXp, pct);
                      const medals: Record<number, string> = {
                        1: "🥇",
                        2: "🥈",
                        3: "🥉",
                      };
                      const rankLabels: Record<number, string> = {
                        1: "Hạng Vàng",
                        2: "Hạng Bạc",
                        3: "Hạng Đồng",
                      };
                      return (
                        <div
                          key={place}
                          className="flex items-center justify-between gap-2 border-b border-token pb-3 last:border-0"
                        >
                          <dt className="font-medium">
                            <span className="mr-2">
                              {medals[Number(place)] ?? "🎖️"}
                            </span>
                            <span>
                              {rankLabels[Number(place)] ?? `Hạng ${place}`}
                            </span>
                          </dt>
                          <dd className="text-right">
                            <span className="font-bold text-accent-600">
                              {xp} XP
                            </span>
                            <span className="text-xs text-muted ml-2">
                              ({pct}%)
                            </span>
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              </div>
            ) : (
              canEdit &&
              prizeXp > 0 && (
                <div className="card border-2 border-dashed border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                    Chưa chia tỷ lệ giải thưởng
                  </h3>
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                    {prizeXp.toLocaleString()} XP sẽ <strong>không được trao cho
                    ai</strong> khi giải kết thúc nếu chưa thiết lập tỷ lệ chia
                    theo hạng. Hãy thiết lập ngay bên dưới.
                  </p>
                </div>
              )
            )}

            {canEdit && prizeXp > 0 && (
              <TournamentPrizeForm
                tournamentId={tournamentId}
                prizeXp={prizeXp}
                initialDistribution={
                  prizeDistribution && typeof prizeDistribution === "object"
                    ? (prizeDistribution as Record<string, number>)
                    : null
                }
              />
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && showLeaderboard && (
          <div>{leaderboardSection}</div>
        )}
      </div>
    </div>
  );
}
