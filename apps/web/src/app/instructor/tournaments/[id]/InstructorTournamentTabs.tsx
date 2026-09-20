"use client";

import { useState } from "react";
import TournamentMetaForm from "./TournamentMetaForm";
import TournamentMissionManager from "./TournamentMissionManager";
import RegistrationsList, { type Registration } from "./RegistrationsList";
import JudgesPanel from "./JudgesPanel";
import TournamentPrizeForm from "./TournamentPrizeForm";
import TournamentSetupChecklist from "./TournamentSetupChecklist";
import TournamentInfoSummary, { type InfoSummaryData } from "./TournamentInfoSummary";
import { buildSetupSteps, type SetupTab } from "@/lib/tournamentSetup";

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
  judgeCount,
  courseTitle,
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
  judgeCount: number;
  courseTitle: string | null;
}) {
  const [activeTab, setActiveTab] = useState("basic");

  const showLeaderboard = status === "active" || status === "ended";
  const setup = buildSetupSteps({
    status,
    title: initial.title,
    description: initial.description,
    startsAt: new Date(initial.startsAt),
    endsAt: new Date(initial.endsAt),
    missionCount: missions.length,
    prizeXp,
    prizeDistribution,
    judgeCount,
  });
  const summary: InfoSummaryData = {
    title: initial.title,
    description: initial.description,
    startsAt: initial.startsAt,
    endsAt: initial.endsAt,
    prizeXp: initial.prizeXp,
    allowLateRegistration: initial.allowLateRegistration,
    teamSize,
    courseTitle,
  };
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "leaderboard" && !showLeaderboard) return false;
    return true;
  });

  return (
    <div className="mt-8">
      {status === "draft" && (
        <div className="mb-6">
          <TournamentSetupChecklist steps={setup.steps} onGoTab={(tab: SetupTab) => setActiveTab(tab)} />
        </div>
      )}

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
        {activeTab === "basic" && (
          <div className="space-y-4">
            <TournamentInfoSummary
              data={summary}
              note={
                canEdit
                  ? status === "published"
                    ? "Đấu trường đã công bố. Bạn vẫn sửa được tiêu đề, mô tả và thời gian; XP thưởng chỉnh ở tab Giải thưởng. Số người mỗi đội thì không đổi được."
                    : undefined
                  : status === "active"
                    ? "Đấu trường đang diễn ra nên không sửa được thông tin."
                    : "Đấu trường đã kết thúc nên không sửa được thông tin."
              }
            />
            {canEdit && (
              <div>
                <TournamentMetaForm tournamentId={tournamentId} initial={initial} />
              </div>
            )}
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
          <div className="space-y-4">
            {!courseId ? (
              <div className="card">
                <h3 className="text-base font-semibold">Giải thưởng</h3>
                <p className="mt-2 text-sm text-muted">
                  Đấu trường toàn hệ thống hiện chưa trao XP thưởng vì XP luôn cộng vào một khoá học cụ thể.
                  Gắn đấu trường với một khoá học nếu muốn có thưởng.
                </p>
              </div>
            ) : (
              <TournamentPrizeForm
                tournamentId={tournamentId}
                prizeXp={prizeXp}
                initialDistribution={
                  prizeDistribution && typeof prizeDistribution === "object"
                    ? (prizeDistribution as Record<string, number>)
                    : null
                }
                teamSize={teamSize}
                canEdit={canEdit}
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
