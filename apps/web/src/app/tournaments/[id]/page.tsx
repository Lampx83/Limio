import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import TournamentRegisterButton from "./TournamentRegisterButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_TONE: Record<string, string> = {
  published: "chip-accent",
  active: "chip-success",
  ended: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Sắp diễn ra",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(d: Date, now: Date): string {
  const diffMs = d.getTime() - now.getTime();
  const absDiff = Math.abs(diffMs);
  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  const suffix = diffMs > 0 ? "nữa" : "trước";
  if (days > 0) return `${days} ngày ${suffix}`;
  if (hours > 0) return `${hours} giờ ${suffix}`;
  return `${minutes} phút ${suffix}`;
}

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function TournamentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const now = new Date();

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: {
      course: { select: { title: true, slug: true } },
      missions: { orderBy: { orderIndex: "asc" } },
      rankings: {
        orderBy: { rank: "asc" },
        take: 20,
      },
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) notFound();
  if (tournament.status === "draft") redirect("/tournaments");

  // Check if current user is registered
  const registration =
    session?.user?.id
      ? await prisma.tournamentRegistration.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId: params.id,
              userId: session.user.id,
            },
          },
        })
      : null;
  const isRegistered = !!registration;

  // Fetch user display names for rankings
  const userIds = tournament.rankings
    .filter((r) => r.userId != null)
    .map((r) => r.userId!);
  const rankingUsers =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, avatarUrl: true },
        })
      : [];
  const userMap = new Map(rankingUsers.map((u) => [u.id, u]));

  const isEnded = tournament.status === "ended";
  const isOpen =
    tournament.status === "published" || tournament.status === "active";
  const isActive = tournament.status === "active";
  const showLeaderboard = isActive || isEnded;

  // Time label for info bar
  let timeLabel: string;
  if (isEnded) {
    timeLabel = `Kết thúc ${formatRelativeTime(tournament.endsAt, now)}`;
  } else if (now < tournament.startsAt) {
    timeLabel = `Bắt đầu sau ${formatRelativeTime(tournament.startsAt, now)}`;
  } else {
    timeLabel = `Kết thúc sau ${formatRelativeTime(tournament.endsAt, now)}`;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {/* Back link */}
      <Link
        href="/tournaments"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Tournaments
      </Link>

      {/* Header */}
      <header className="mt-4">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="h-display flex-1 text-3xl font-bold sm:text-4xl">
            {tournament.title}
          </h1>
          <span className={STATUS_TONE[tournament.status] ?? "chip"}>
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </span>
        </div>

        {/* Course tag */}
        {tournament.course ? (
          <p className="mt-2 text-sm text-muted">
            Khóa học:{" "}
            <Link
              href={`/catalog/${tournament.course.slug}`}
              className="link font-medium"
            >
              {tournament.course.title}
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Platform-wide</p>
        )}
      </header>

      {/* Info bar */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-2.5">
          <span className="text-base">👥</span>
          <span className="text-sm font-medium">
            {tournament._count.registrations} người tham gia
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-2.5">
          <span className="text-base">🎯</span>
          <span className="text-sm font-medium">
            {tournament.missions.length} missions
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-2.5">
          <span className="text-base">🕐</span>
          <span className="text-sm font-medium">{timeLabel}</span>
        </div>
        {tournament.prizeXp > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5">
            <span className="text-base">🏆</span>
            <span className="text-sm font-medium text-accent-700">
              {tournament.prizeXp} XP giải thưởng
            </span>
          </div>
        )}
      </div>

      {/* Content grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Left column */}
        <div className="space-y-8">
          {/* Description */}
          {tournament.description && (
            <section className="card">
              <h2 className="text-lg font-semibold">Mô tả</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                {tournament.description}
              </p>
            </section>
          )}

          {/* Date range */}
          <section className="card">
            <h2 className="text-lg font-semibold">Thời gian</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-[rgb(var(--surface-muted))] px-4 py-3">
                <p className="text-xs text-faint">Bắt đầu</p>
                <p className="mt-0.5 text-sm font-medium">
                  {formatDate(tournament.startsAt)}
                </p>
              </div>
              <div className="rounded-lg bg-[rgb(var(--surface-muted))] px-4 py-3">
                <p className="text-xs text-faint">Kết thúc</p>
                <p className="mt-0.5 text-sm font-medium">
                  {formatDate(tournament.endsAt)}
                </p>
              </div>
            </div>
          </section>

          {/* Missions */}
          {tournament.missions.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Missions</h2>
              <ol className="mt-4 space-y-3">
                {tournament.missions.map((mission, idx) => (
                  <li key={mission.id} className="card">
                    <div className="flex items-start gap-4">
                      {/* Order badge */}
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-700">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold">{mission.title}</h3>
                          <span className="chip-accent shrink-0">
                            {mission.points} điểm
                          </span>
                        </div>
                        {mission.description && (
                          <p className="mt-1 text-sm text-muted">
                            {mission.description}
                          </p>
                        )}
                        {mission.prerequisiteId && (
                          <p className="mt-1.5 text-xs text-faint">
                            🔒 Yêu cầu hoàn thành mission trước
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Leaderboard */}
          {showLeaderboard && (
            <section>
              <h2 className="text-lg font-semibold">
                Bảng xếp hạng{" "}
                <span className="text-sm font-normal text-faint">
                  (Top 20)
                </span>
              </h2>

              {tournament.rankings.length === 0 ? (
                <div className="card mt-4 text-center text-sm text-muted py-8">
                  Chưa có người hoàn thành mission nào.
                </div>
              ) : (
                <div className="card mt-4 overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-token bg-[rgb(var(--surface-muted))]">
                        <th className="px-4 py-3 text-left font-semibold text-faint">
                          #
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-faint">
                          Người tham gia
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-faint">
                          Điểm
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-token">
                      {tournament.rankings.map((entry) => {
                        const user = entry.userId
                          ? userMap.get(entry.userId)
                          : null;
                        const displayName =
                          user?.displayName ?? entry.teamId ?? "—";
                        const isTop3 = entry.rank <= 3;
                        const isMe =
                          entry.userId != null &&
                          entry.userId === session?.user?.id;

                        return (
                          <tr
                            key={entry.id}
                            className={
                              isMe
                                ? "bg-brand-soft"
                                : isTop3
                                  ? "bg-accent-50/60"
                                  : ""
                            }
                          >
                            <td className="w-12 px-4 py-3 tabular-nums font-medium">
                              {RANK_MEDALS[entry.rank] ?? `#${entry.rank}`}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={
                                  isMe
                                    ? "font-semibold text-brand-700"
                                    : isTop3
                                      ? "font-semibold"
                                      : ""
                                }
                              >
                                {displayName}
                                {isMe && (
                                  <span className="ml-1.5 text-xs text-faint">
                                    (bạn)
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium">
                              {entry.totalPoints}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="space-y-5">
          {/* Register panel */}
          <TournamentRegisterButton
            tournamentId={params.id}
            isLoggedIn={!!session?.user?.id}
            isRegistered={isRegistered}
            isEnded={isEnded}
            isOpen={isOpen}
          />

          {/* Quick stats */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
              Thông tin tournament
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-faint">Trạng thái</dt>
                <dd>
                  <span className={STATUS_TONE[tournament.status] ?? "chip"}>
                    {STATUS_LABEL[tournament.status] ?? tournament.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">Hình thức</dt>
                <dd className="font-medium">
                  {tournament.teamSize > 1
                    ? `Đội nhóm (${tournament.teamSize} người)`
                    : "Cá nhân"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">Số missions</dt>
                <dd className="font-medium tabular-nums">
                  {tournament.missions.length}
                </dd>
              </div>
              {tournament.prizeXp > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-faint">Giải thưởng</dt>
                  <dd className="font-medium text-accent-600 tabular-nums">
                    {tournament.prizeXp} XP
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Prize distribution */}
          {tournament.prizeXp > 0 &&
            tournament.prizeDistribution != null &&
            typeof tournament.prizeDistribution === "object" && (
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                  Phân phối giải thưởng
                </h2>
                <dl className="space-y-2 text-sm">
                  {Object.entries(
                    tournament.prizeDistribution as Record<string, number>,
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([place, pct]) => {
                      const xp = Math.round(
                        (pct / 100) * tournament.prizeXp,
                      );
                      return (
                        <div
                          key={place}
                          className="flex items-center justify-between gap-2"
                        >
                          <dt className="text-faint">
                            {RANK_MEDALS[Number(place)] ??
                              `Hạng ${place}`}
                          </dt>
                          <dd className="font-medium tabular-nums">
                            {xp} XP{" "}
                            <span className="text-xs text-faint">
                              ({pct}%)
                            </span>
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              </div>
            )}
        </aside>
      </div>
    </main>
  );
}
