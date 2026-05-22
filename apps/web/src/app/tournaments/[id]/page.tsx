import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import TournamentRegisterButton from "./TournamentRegisterButton";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  published: "Sắp bắt đầu",
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

  const heroGradient = isActive
    ? "from-rose-700 via-red-600 to-orange-500"
    : isEnded
      ? "from-slate-700 via-slate-600 to-slate-500"
      : "from-amber-600 via-orange-500 to-rose-500";

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* ── HERO BANNER ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient}`} />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(circle at 85% 70%, rgba(255,200,80,0.5) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.5) 12px, rgba(255,255,255,0.5) 14px)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-10 sm:py-14">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white"
          >
            ← Arena
          </Link>

          <div className="mt-6 flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0 text-white drop-shadow-md">
              {/* Status pill */}
              {isActive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-700 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white ring-2 ring-white/40">
                  <span className="flex h-2 w-2 animate-ping rounded-full bg-white" />
                  Đang diễn ra
                </span>
              ) : isEnded ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-700">
                  ✓ Đã kết thúc
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-900">
                  ⏳ Sắp bắt đầu
                </span>
              )}

              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
                {tournament.title}
              </h1>

              {tournament.course ? (
                <p className="mt-2 text-sm font-semibold text-white/85">
                  📚{" "}
                  <Link
                    href={`/catalog/${tournament.course.slug}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {tournament.course.title}
                  </Link>
                </p>
              ) : (
                <p className="mt-2 text-sm font-semibold text-white/85">🌐 Toàn nền tảng</p>
              )}
            </div>

            {/* Floating trophy */}
            <div className="hidden text-7xl drop-shadow-2xl sm:block sm:text-8xl" aria-hidden>
              {isActive ? "🏁" : isEnded ? "🏆" : "🎟️"}
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat icon="👥" value={tournament._count.registrations} label="Người chơi" />
            <HeroStat icon="🎯" value={tournament.missions.length} label="Missions" />
            <HeroStat icon="⏱" value={timeLabel} label="Thời gian" small />
            <HeroStat
              icon="💎"
              value={tournament.prizeXp > 0 ? `${tournament.prizeXp}` : "—"}
              label="XP thưởng"
              highlight={tournament.prizeXp > 0}
            />
          </div>
        </div>
      </section>

      {/* ── CONTENT GRID ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Left column */}
        <div className="space-y-8">
          {/* Description */}
          {tournament.description && (
            <section className="rounded-2xl border border-orange-200/60 bg-white p-6 shadow-md dark:border-orange-900/40 dark:bg-slate-800">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                📜 Mô tả
              </h2>
              <SafeHtml
                html={plainToRichHtml(tournament.description)}
                className="prose prose-sm mt-3 max-w-none text-slate-600 dark:prose-invert dark:text-slate-300"
              />
            </section>
          )}

          {/* Date range */}
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-800/50 dark:from-emerald-950/30 dark:to-slate-800">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                🟢 Bắt đầu
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {formatDate(tournament.startsAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 dark:border-rose-800/50 dark:from-rose-950/30 dark:to-slate-800">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
                🔴 Kết thúc
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {formatDate(tournament.endsAt)}
              </p>
            </div>
          </section>

          {/* Missions */}
          {tournament.missions.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                🎯 Danh sách nhiệm vụ
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                  {tournament.missions.length}
                </span>
              </h2>
              <ol className="mt-4 space-y-3">
                {tournament.missions.map((mission, idx) => (
                  <li
                    key={mission.id}
                    className="group relative overflow-hidden rounded-2xl border border-orange-200/60 bg-white shadow-md transition-all hover:shadow-xl dark:border-orange-900/40 dark:bg-slate-800"
                  >
                    {/* Accent bar */}
                    <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-rose-600 to-orange-500" />

                    <div className="flex items-start gap-4 p-5 pl-7">
                      {/* Order badge */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-orange-500 text-lg font-black text-white shadow-md">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {mission.title}
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-1 text-xs font-black text-amber-900 ring-1 ring-amber-500/40">
                            💎 {mission.points}
                          </span>
                        </div>
                        {mission.description && (
                          <SafeHtml
                            html={plainToRichHtml(mission.description)}
                            className="prose prose-sm mt-2 max-w-none text-slate-600 dark:prose-invert dark:text-slate-300"
                          />
                        )}
                        {mission.prerequisiteId && (
                          <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            🔒 Yêu cầu hoàn thành mission trước
                          </p>
                        )}
                        {mission.missionType && mission.missionType !== "COURSE_LINKED" && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              {mission.missionType === "CUSTOM" ? "Tự thiết kế" : "Liên kết ngoài"}
                            </span>
                            {mission.verifyMode && (
                              <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-bold uppercase text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                                {{
                                  AUTO_GRADE:    "Quiz",
                                  AUTO_CHECK:    "Tự kiểm tra",
                                  PEER_REVIEW:   "Peer review",
                                  MANUAL_REVIEW: "GV chấm",
                                }[mission.verifyMode]}
                              </span>
                            )}
                            {mission.submissionDeadline && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Hạn: {new Date(mission.submissionDeadline).toLocaleString("vi-VN")}
                              </span>
                            )}
                            <Link
                              href={`/tournaments/${tournament.id}/missions/${mission.id}`}
                              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:scale-105"
                            >
                              Sẵn sàng nhận nhiệm vụ →
                            </Link>
                          </div>
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
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                🏆 Bảng xếp hạng
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  (Top 20)
                </span>
              </h2>

              {tournament.rankings.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-orange-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-orange-700 dark:bg-slate-800 dark:text-slate-400">
                  <p className="text-3xl">🏟️</p>
                  <p className="mt-2 font-semibold">
                    Đấu trường đang chờ người chơi đầu tiên!
                  </p>
                </div>
              ) : (
                <>
                  {/* Podium for top 3 */}
                  {tournament.rankings.length >= 1 && (
                    <Podium
                      rankings={tournament.rankings.slice(0, 3)}
                      userMap={userMap}
                      currentUserId={session?.user?.id}
                    />
                  )}

                  {/* Rest of leaderboard (rank 4+) */}
                  {tournament.rankings.length > 3 && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-orange-200/60 bg-white shadow-md dark:border-orange-900/40 dark:bg-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Hạng
                            </th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Người chơi
                            </th>
                            <th className="px-4 py-3 text-right font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Điểm
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {tournament.rankings.slice(3).map((entry) => {
                            const user = entry.userId ? userMap.get(entry.userId) : null;
                            const displayName = user?.displayName ?? entry.teamId ?? "—";
                            const isMe =
                              entry.userId != null && entry.userId === session?.user?.id;

                            return (
                              <tr
                                key={entry.id}
                                className={
                                  isMe
                                    ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
                                    : ""
                                }
                              >
                                <td className="w-16 px-4 py-3 font-black tabular-nums text-slate-700 dark:text-slate-300">
                                  #{entry.rank}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={
                                      isMe
                                        ? "font-bold text-rose-700 dark:text-rose-400"
                                        : "font-medium text-slate-800 dark:text-slate-200"
                                    }
                                  >
                                    {displayName}
                                    {isMe && (
                                      <span className="ml-1.5 text-xs font-medium text-slate-500">
                                        (bạn)
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">
                                  {entry.totalPoints}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
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
          <div className="rounded-2xl border border-orange-200/60 bg-white p-5 shadow-md dark:border-orange-900/40 dark:bg-slate-800">
            <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-rose-700 dark:text-orange-400">
              ⚙️ Quy chế
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Hình thức</dt>
                <dd className="font-bold text-slate-900 dark:text-white">
                  {tournament.teamSize > 1
                    ? `👥 Đội (${tournament.teamSize})`
                    : "🏃 Cá nhân"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Missions</dt>
                <dd className="font-bold tabular-nums text-slate-900 dark:text-white">
                  {tournament.missions.length}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Người chơi</dt>
                <dd className="font-bold tabular-nums text-slate-900 dark:text-white">
                  {tournament._count.registrations}
                </dd>
              </div>
              {tournament.prizeXp > 0 && (
                <div className="flex justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <dt className="font-semibold text-amber-700 dark:text-amber-400">
                    💎 Tổng giải
                  </dt>
                  <dd className="font-black tabular-nums text-amber-700 dark:text-amber-400">
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
              <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-md dark:border-amber-700 dark:from-amber-950/40 dark:to-orange-950/40">
                <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  🏅 Phân phối giải
                </h2>
                <ul className="mt-3 space-y-2">
                  {Object.entries(
                    tournament.prizeDistribution as Record<string, number>,
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([place, pct]) => {
                      const xp = Math.round((pct / 100) * tournament.prizeXp);
                      const placeNum = Number(place);
                      return (
                        <li
                          key={place}
                          className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm dark:bg-slate-800/50"
                        >
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {RANK_MEDALS[placeNum] ?? `#${place}`}{" "}
                            <span className="text-xs text-slate-500">
                              hạng {place}
                            </span>
                          </span>
                          <span className="font-black tabular-nums text-amber-700 dark:text-amber-400">
                            {xp}{" "}
                            <span className="text-xs font-medium text-slate-500">
                              ({pct}%)
                            </span>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
        </aside>
      </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hero stat tile — used in the dramatic banner.
// ─────────────────────────────────────────────────────────────────────
function HeroStat({
  icon,
  value,
  label,
  highlight,
  small,
}: {
  icon: string;
  value: string | number;
  label: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/20 backdrop-blur-md ${
        highlight
          ? "bg-gradient-to-br from-amber-300/90 to-yellow-200/90 text-amber-900 ring-2 ring-white/40"
          : "bg-white/15 text-white"
      } px-3 py-2.5`}
    >
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-90">
        <span className="text-base">{icon}</span>
        {label}
      </p>
      <p
        className={`mt-0.5 font-black leading-none ${
          small ? "text-sm" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Podium — top 3 with elevated 1st spot (Olympic-style).
// ─────────────────────────────────────────────────────────────────────
function Podium({
  rankings,
  userMap,
  currentUserId,
}: {
  rankings: Array<{
    id: string;
    rank: number;
    userId: string | null;
    teamId: string | null;
    totalPoints: number;
  }>;
  userMap: Map<string, { displayName: string }>;
  currentUserId?: string;
}) {
  // Arrange visually: 2nd left, 1st center (elevated), 3rd right
  const byRank: Record<number, (typeof rankings)[number] | undefined> = {
    1: rankings.find((r) => r.rank === 1),
    2: rankings.find((r) => r.rank === 2),
    3: rankings.find((r) => r.rank === 3),
  };

  return (
    <div className="mt-4 grid grid-cols-3 items-end gap-3">
      <PodiumSlot
        entry={byRank[2]}
        userMap={userMap}
        currentUserId={currentUserId}
        rank={2}
        height="h-32 sm:h-36"
        gradient="from-slate-300 to-slate-400"
        medal="🥈"
      />
      <PodiumSlot
        entry={byRank[1]}
        userMap={userMap}
        currentUserId={currentUserId}
        rank={1}
        height="h-40 sm:h-48"
        gradient="from-yellow-400 to-amber-500"
        medal="🥇"
        crown
      />
      <PodiumSlot
        entry={byRank[3]}
        userMap={userMap}
        currentUserId={currentUserId}
        rank={3}
        height="h-28 sm:h-32"
        gradient="from-orange-400 to-amber-600"
        medal="🥉"
      />
    </div>
  );
}

function PodiumSlot({
  entry,
  userMap,
  currentUserId,
  rank,
  height,
  gradient,
  medal,
  crown,
}: {
  entry?: { id: string; userId: string | null; teamId: string | null; totalPoints: number };
  userMap: Map<string, { displayName: string }>;
  currentUserId?: string;
  rank: number;
  height: string;
  gradient: string;
  medal: string;
  crown?: boolean;
}) {
  if (!entry) {
    return (
      <div
        className={`flex ${height} flex-col items-center justify-end rounded-t-xl bg-slate-100 px-2 py-3 text-center dark:bg-slate-800`}
      >
        <span className="text-2xl opacity-30">{medal}</span>
        <span className="mt-1 text-xs font-bold text-slate-400">Hạng {rank}</span>
      </div>
    );
  }
  const user = entry.userId ? userMap.get(entry.userId) : null;
  const displayName = user?.displayName ?? entry.teamId ?? "—";
  const isMe = entry.userId != null && entry.userId === currentUserId;

  return (
    <div
      className={`relative flex ${height} flex-col items-center justify-end rounded-t-xl bg-gradient-to-b ${gradient} px-2 py-3 text-center shadow-lg ${
        isMe ? "ring-4 ring-rose-500/60 ring-offset-2 ring-offset-amber-50 dark:ring-offset-slate-900" : ""
      }`}
    >
      {crown && (
        <span
          aria-hidden
          className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl drop-shadow-lg"
        >
          👑
        </span>
      )}
      <span className="text-3xl drop-shadow-md">{medal}</span>
      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-900 sm:text-sm">
        {displayName}
        {isMe && <span className="ml-1 opacity-80">(bạn)</span>}
      </p>
      <p className="mt-0.5 rounded-full bg-white/70 px-2 py-0.5 text-xs font-black tabular-nums text-slate-900">
        {entry.totalPoints} pts
      </p>
    </div>
  );
}
