import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import TournamentPublishBar from "./TournamentPublishBar";
import InstructorTournamentTabs from "./InstructorTournamentTabs";
import { ShareCard } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "chip",
  published: "chip-accent",
  active: "chip-success",
  ended: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã công bố",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

function formatDate(d: Date | null) {
  if (!d) return "—";
  return formatDateTime(d);
}

function timeRelative(tournament: {
  status: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const now = Date.now();
  if (tournament.status === "ended") return "Đã kết thúc";
  if (tournament.status === "active") {
    const diff = new Date(tournament.endsAt).getTime() - now;
    if (diff <= 0) return "Đã kết thúc";
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `Còn ${hours}h`;
    return `Còn ${Math.floor(hours / 24)} ngày`;
  }
  // draft or published
  const diff = new Date(tournament.startsAt).getTime() - now;
  if (diff <= 0) return "Sắp bắt đầu";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `Bắt đầu sau ${hours}h`;
  return `Bắt đầu sau ${Math.floor(hours / 24)} ngày`;
}

export default async function TournamentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/tournaments/${params.id}`);
  }
  const userId = session.user.id;

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: {
      course: { select: { title: true, slug: true } },
      missions: { orderBy: { orderIndex: "asc" } },
      rankings: {
        orderBy: { rank: "asc" },
        take: 10,
        select: {
          id: true,
          rank: true,
          totalPoints: true,
          userId: true,
          teamId: true,
        },
      },
      registrations: {
        orderBy: { registeredAt: "asc" },
        select: {
          id: true,
          registeredAt: true,
          disqualifiedAt: true,
          teamId: true,
          team: { select: { name: true, captainId: true } },
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
      _count: { select: { registrations: true } },
    },
  });
  // prizeDistribution is already included in default select

  if (!tournament) notFound();

  // Resolve user names for ranking rows that have a userId
  const rankingUserIds = tournament.rankings
    .map((r) => r.userId)
    .filter((id): id is string => id !== null);

  const rankingUsers =
    rankingUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: rankingUserIds } },
          select: { id: true, displayName: true },
        })
      : [];

  const userNameMap = new Map(rankingUsers.map((u) => [u.id, u.displayName]));

  // Team tournaments rank by teamId — resolve names so the board shows team
  // names instead of raw UUIDs.
  const rankingTeamIds = tournament.rankings
    .map((r) => r.teamId)
    .filter((id): id is string => id !== null);
  const rankingTeams =
    rankingTeamIds.length > 0
      ? await prisma.tournamentTeam.findMany({
          where: { id: { in: rankingTeamIds } },
          select: { id: true, name: true },
        })
      : [];
  const teamNameMap = new Map(rankingTeams.map((t) => [t.id, t.name]));

  const rankings = tournament.rankings.map((r) => ({
    ...r,
    displayName: r.userId
      ? (userNameMap.get(r.userId) ?? "Ẩn danh")
      : r.teamId
        ? (teamNameMap.get(r.teamId) ?? "Đội ẩn")
        : "—",
  }));

  const admin = await isAdmin(userId);
  const isCreator = tournament.creatorId === userId;
  if (!admin && !isCreator) redirect("/instructor/tournaments");

  const canEdit =
    tournament.status === "draft" || tournament.status === "published";

  // Số bài đang chờ chấm theo từng mission (status=pending) → badge ở tab Missions.
  const missionIds = tournament.missions.map((m) => m.id);
  const pendingGroups = missionIds.length
    ? await prisma.missionSubmission.groupBy({
        by: ["missionId"],
        where: { missionId: { in: missionIds }, status: "pending" },
        _count: { _all: true },
      })
    : [];
  const pendingCounts: Record<string, number> = {};
  for (const g of pendingGroups) pendingCounts[g.missionId] = g._count._all;

  const judgeCount = await prisma.tournamentJudge.count({ where: { tournamentId: tournament.id } });

  return (
    <main>
      {/* Back link */}
      <Link
        href="/instructor/tournaments"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Đấu trường
      </Link>

      {/* A. Header */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="leading-tight text-2xl font-bold">
            {tournament.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tournament.course ? tournament.course.title : "Toàn hệ thống"}
          </p>
        </div>
        <span className={STATUS_TONE[tournament.status] ?? "chip"}>
          {STATUS_LABEL[tournament.status] ?? tournament.status}
        </span>
      </header>

      {/* B. Stats bar */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-center">
          <p className="text-2xl font-bold">{tournament._count.registrations}</p>
          <p className="mt-1 text-xs text-muted">Người tham gia</p>
        </div>
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-center">
          <p className="text-2xl font-bold">{tournament.missions.length}</p>
          <p className="mt-1 text-xs text-muted">Nhiệm vụ</p>
        </div>
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-center">
          <p className="text-lg font-semibold">{timeRelative(tournament)}</p>
          <p className="mt-1 text-xs text-muted">Thời gian</p>
        </div>
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-center">
          <p className="text-2xl font-bold">{tournament.prizeXp.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted">XP thưởng</p>
        </div>
      </div>

      {/* Dates */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
        <span>Bắt đầu: <span className="font-medium text-[rgb(var(--fg))]">{formatDate(tournament.startsAt)}</span></span>
        <span>·</span>
        <span>Kết thúc: <span className="font-medium text-[rgb(var(--fg))]">{formatDate(tournament.endsAt)}</span></span>
      </div>

      {/* D. Publish bar */}
      <section className="mt-6">
        <TournamentPublishBar
          tournamentId={tournament.id}
          status={tournament.status}
          registrationCount={tournament._count.registrations}
          missionCount={tournament.missions.length}
        />
      </section>

      {/* Link chia sẻ — tournament nháp bị /tournaments/[id] đá về danh sách,
          nên chưa publish thì không có gì để gửi đi. */}
      {tournament.status !== "draft" && (
        <section className="mt-4">
          <ShareCard
            path={`/tournaments/${tournament.id}`}
            label="Link giới thiệu đấu trường"
            hint="Người chưa đăng nhập cũng xem được thể lệ và bảng xếp hạng; đăng ký thì cần tài khoản."
            fileName={`tournament-${tournament.id.slice(0, 8)}`}
          />
        </section>
      )}

      {/* E. Danh sách thiết lập (khi nháp) + các tab */}
      <InstructorTournamentTabs
        tournamentId={tournament.id}
        status={tournament.status}
        canEdit={canEdit}
        initial={{
          title: tournament.title,
          description: tournament.description,
          startsAt: tournament.startsAt.toISOString(),
          endsAt: tournament.endsAt.toISOString(),
          prizeXp: tournament.prizeXp,
          allowLateRegistration: tournament.allowLateRegistration,
          showcaseMode: tournament.showcaseMode,
          teamSize: tournament.teamSize,
        }}
        missions={tournament.missions}
        courseId={tournament.courseId}
        prizeDistribution={tournament.prizeDistribution}
        prizeXp={tournament.prizeXp}
        teamSize={tournament.teamSize}
        tournamentTitle={tournament.title}
        pendingCounts={pendingCounts}
        judgeCount={judgeCount}
        courseTitle={tournament.course?.title ?? null}
        registrations={tournament.registrations.map((r) => ({
          id: r.id,
          registeredAt: r.registeredAt.toISOString(),
          disqualifiedAt: r.disqualifiedAt?.toISOString() ?? null,
          teamId: r.teamId,
          teamName: r.team?.name ?? null,
          isCaptain: r.team?.captainId === r.user.id,
          user: r.user,
        }))}
        leaderboardSection={
          (tournament.status === "active" || tournament.status === "ended") &&
          rankings.length > 0 ? (
            <div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-token">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-token bg-[rgb(var(--surface-muted))] text-left text-xs text-muted">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Người chơi</th>
                      <th className="px-4 py-3 font-medium text-right">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={`border-b border-token last:border-0 ${
                          idx < 3 ? "font-semibold" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          {r.rank <= 3 ? (
                            <span
                              className={
                                r.rank === 1
                                  ? "text-accent-500"
                                  : r.rank === 2
                                    ? "text-muted"
                                    : "text-orange-600"
                              }
                            >
                              {r.rank}
                            </span>
                          ) : (
                            r.rank
                          )}
                        </td>
                        <td className="px-4 py-3">{r.displayName}</td>
                        <td className="px-4 py-3 text-right">
                          {r.totalPoints.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null
        }
      />
    </main>
  );
}
