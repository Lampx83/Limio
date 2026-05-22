import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import TournamentPublishBar from "./TournamentPublishBar";
import InstructorTournamentTabs from "./InstructorTournamentTabs";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "chip",
  published: "chip-accent",
  active: "chip-success",
  ended: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const rankings = tournament.rankings.map((r) => ({
    ...r,
    displayName: r.userId
      ? (userNameMap.get(r.userId) ?? "Ẩn danh")
      : (r.teamId ?? "—"),
  }));

  const admin = await isAdmin(userId);
  const isCreator = tournament.creatorId === userId;
  if (!admin && !isCreator) redirect("/instructor/tournaments");

  const canEdit =
    tournament.status === "draft" || tournament.status === "published";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Back link */}
      <Link
        href="/instructor/tournaments"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Tournaments
      </Link>

      {/* A. Header */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-display text-3xl font-bold leading-tight sm:text-4xl">
            {tournament.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tournament.course ? tournament.course.title : "Platform-wide"}
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
          <p className="mt-1 text-xs text-muted">Missions</p>
        </div>
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-center">
          <p className="text-lg font-semibold">{timeRelative(tournament)}</p>
          <p className="mt-1 text-xs text-muted">Thời gian</p>
        </div>
        <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-center">
          <p className="text-2xl font-bold">{tournament.prizeXp.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted">Prize XP</p>
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

      {/* E. Tab interface — Basic Info, Missions, Prize, Leaderboard */}
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
        }}
        missions={tournament.missions}
        courseId={tournament.courseId}
        prizeDistribution={tournament.prizeDistribution}
        prizeXp={tournament.prizeXp}
        teamSize={tournament.teamSize}
        tournamentTitle={tournament.title}
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
