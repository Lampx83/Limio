import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Trophy,
  Flag,
  Rocket,
  Users,
  User,
  Target,
  Clock,
  Hourglass,
  Gem,
  BookOpen,
  Globe,
  CalendarClock,
  CalendarOff,
  ScrollText,
  CheckCircle2,
  Lock,
  Crown,
  Medal,
  Award,
  Settings,
  Sparkles,
  ArrowRight,
  Eye,
  XCircle,
  Circle,
  Ban,
  LogIn,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isMissionTeamCompatible } from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import TournamentRegisterButton from "./TournamentRegisterButton";
import TournamentTeamPanel from "./TournamentTeamPanel";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import { formatVN, formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  published: "Sắp bắt đầu",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

function formatDate(d: Date) {
  return formatVN(d, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

const RANK_MEDAL_COLOR: Record<number, string> = {
  1: "text-amber-500",
  2: "text-slate-400",
  3: "text-orange-600",
};

function RankMedal({ rank, className = "h-4 w-4" }: { rank: number; className?: string }) {
  const color = RANK_MEDAL_COLOR[rank];
  if (!color) return <span className="text-slate-500">#{rank}</span>;
  return <Medal className={`${className} ${color}`} aria-label={`Hạng ${rank}`} />;
}

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

  // Check if current user is registered. For team tournaments we also pull
  // team + roster so the right-rail panel can render team UI.
  const registration =
    session?.user?.id
      ? await prisma.tournamentRegistration.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId: params.id,
              userId: session.user.id,
            },
          },
          include: {
            team: {
              include: {
                registrations: {
                  orderBy: { registeredAt: "asc" },
                  include: {
                    user: { select: { id: true, displayName: true } },
                  },
                },
              },
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

  // Team tournaments rank by teamId — resolve names so the board shows team
  // names instead of raw UUIDs.
  const rankingTeamIds = tournament.rankings
    .filter((r) => r.teamId != null)
    .map((r) => r.teamId!);
  const rankingTeams =
    rankingTeamIds.length > 0
      ? await prisma.tournamentTeam.findMany({
          where: { id: { in: rankingTeamIds } },
          select: { id: true, name: true },
        })
      : [];
  const teamMap = new Map(rankingTeams.map((t) => [t.id, t.name]));
  const rankName = (entry: { userId: string | null; teamId: string | null }) =>
    (entry.userId ? userMap.get(entry.userId)?.displayName : null) ??
    (entry.teamId ? teamMap.get(entry.teamId) : null) ??
    "—";

  const isEnded = tournament.status === "ended";
  const isOpen =
    tournament.status === "published" || tournament.status === "active";
  const isActive = tournament.status === "active";
  const showLeaderboard = isActive || isEnded;

  // Hide individual-only missions from learner view in team tournaments —
  // any legacy mission of that type would never contribute to team score.
  tournament.missions = tournament.missions.filter((m) =>
    isMissionTeamCompatible(m.conditionType, tournament.teamSize),
  );

  // ── Viewer state (single source of truth for banner + mission gating) ──
  const uid = session?.user?.id ?? null;
  const isLoggedIn = !!uid;

  // Registration window closes at start unless late registration is allowed.
  const regDeadline = tournament.allowLateRegistration
    ? tournament.endsAt
    : tournament.startsAt;
  const regOpen = !isEnded && now < regDeadline;
  const canRegister = isLoggedIn && !isRegistered && isOpen && regOpen;
  // Logged-in, not registered, window shut, not ended → view-only spectator.
  const isSpectator = isLoggedIn && !isRegistered && !isEnded && !regOpen;

  // Per-mission submission status for the viewer. COLLECTIVE missions read the
  // captain's row (team's single source of truth).
  const missionIds = tournament.missions.map((m) => m.id);
  const captainId = registration?.team?.captainId ?? null;
  const lookupIds = [uid, captainId].filter((x): x is string => !!x);
  const subRows =
    isRegistered && missionIds.length > 0
      ? await prisma.missionSubmission.findMany({
          where: { missionId: { in: missionIds }, userId: { in: lookupIds } },
          select: { missionId: true, userId: true, status: true },
        })
      : [];
  const subKeyFor = (m: (typeof tournament.missions)[number]) =>
    m.isTeamSubmission && captainId ? captainId : uid;
  const statusFor = (m: (typeof tournament.missions)[number]) =>
    subRows.find((s) => s.missionId === m.id && s.userId === subKeyFor(m))?.status ?? null;
  // Prerequisite unlock — a prereq counts as "done" once the learner has either
  // SUBMITTED it (any status: GV-graded missions sit at `pending` until the
  // instructor grades — we must NOT block the next mission while they wait) OR
  // COMPLETED it (auto / course-linked / graded-pass → tournament.mission.completed
  // event; course-linked missions have no MissionSubmission row at all).
  const submittedMissionIds = new Set(subRows.map((s) => s.missionId));
  const completedEvents =
    isRegistered && missionIds.length > 0
      ? await prisma.learningEvent.findMany({
          where: {
            userId: { in: lookupIds },
            eventType: LearningEventType.TournamentMissionCompleted,
          },
          select: { eventKey: true },
        })
      : [];
  const completedMissionIds = new Set(
    completedEvents.flatMap((e) => {
      // eventKey = "tournament.mission.completed:{userId}:{missionId}"
      const id = e.eventKey?.split(":").pop();
      return id ? [id] : [];
    }),
  );
  const lockedFor = (m: (typeof tournament.missions)[number]) =>
    !!m.prerequisiteId &&
    !submittedMissionIds.has(m.prerequisiteId) &&
    !completedMissionIds.has(m.prerequisiteId);

  // Viewer's own standing (solo → userId, team → teamId).
  const myRanking = isRegistered
    ? await prisma.tournamentRanking.findFirst({
        where:
          tournament.teamSize > 1 && registration?.team
            ? { tournamentId: params.id, teamId: registration.team.id }
            : { tournamentId: params.id, userId: uid! },
        select: { rank: true, totalPoints: true },
      })
    : null;

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
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đã kết thúc
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-900">
                  <Hourglass className="h-3.5 w-3.5" /> Sắp bắt đầu
                </span>
              )}

              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
                {tournament.title}
              </h1>

              {tournament.course ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white/85">
                  <BookOpen className="h-4 w-4" />
                  <Link
                    href={`/catalog/${tournament.course.slug}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {tournament.course.title}
                  </Link>
                </p>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white/85">
                  <Globe className="h-4 w-4" /> Toàn nền tảng
                </p>
              )}
            </div>

            {/* Floating hero icon */}
            <div className="hidden drop-shadow-2xl sm:block" aria-hidden>
              {isActive ? (
                <Flag
                  className="h-24 w-24 text-white/90 sm:h-32 sm:w-32"
                  strokeWidth={1.5}
                />
              ) : isEnded ? (
                <Trophy
                  className="h-24 w-24 text-amber-200 sm:h-32 sm:w-32"
                  strokeWidth={1.5}
                  fill="currentColor"
                />
              ) : (
                <Rocket
                  className="h-24 w-24 -rotate-45 text-white/90 sm:h-32 sm:w-32"
                  strokeWidth={1.5}
                />
              )}
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat icon={<Users className="h-4 w-4" />} value={tournament._count.registrations} label="Người chơi" />
            <HeroStat icon={<Target className="h-4 w-4" />} value={tournament.missions.length} label="Missions" />
            <HeroStat icon={<Clock className="h-4 w-4" />} value={timeLabel} label="Thời gian" small />
            <HeroStat
              icon={<Gem className="h-4 w-4" />}
              value={tournament.prizeXp > 0 ? `${tournament.prizeXp}` : "—"}
              label="XP thưởng"
              highlight={tournament.prizeXp > 0}
            />
          </div>
        </div>
      </section>

      {/* ── CONTENT GRID ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10">
      <StatusBanner
        tournamentId={params.id}
        isLoggedIn={isLoggedIn}
        isRegistered={isRegistered}
        isEnded={isEnded}
        canRegister={canRegister}
        isSpectator={isSpectator}
        teamSize={tournament.teamSize}
        teamName={registration?.team?.name ?? null}
        teamCount={registration?.team?.registrations.length ?? null}
        myRank={myRanking?.rank ?? null}
        myPoints={myRanking?.totalPoints ?? null}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Left column */}
        <div className="space-y-8">
          {/* Description */}
          {tournament.description && (
            <section className="rounded-2xl border border-orange-200/60 bg-white p-6 shadow-md dark:border-orange-900/40 dark:bg-slate-800">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <ScrollText className="h-5 w-5 text-rose-600 dark:text-orange-400" />
                Mô tả
              </h2>
              <SafeHtml
                html={plainToRichHtml(tournament.description)}
                className="prose prose-sm mt-3 max-w-none text-slate-600 dark:prose-invert dark:text-slate-300"
              />
            </section>
          )}

          {/* Date range */}
          {(() => {
            const regDeadline = tournament.allowLateRegistration
              ? tournament.endsAt
              : tournament.startsAt;
            const regOpen = !isEnded && now < regDeadline;
            return (
              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-800/50 dark:from-emerald-950/30 dark:to-slate-800">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    <CalendarClock className="h-4 w-4" /> Bắt đầu
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {formatDate(tournament.startsAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 dark:border-rose-800/50 dark:from-rose-950/30 dark:to-slate-800">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
                    <CalendarOff className="h-4 w-4" /> Kết thúc
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {formatDate(tournament.endsAt)}
                  </p>
                </div>
                <div
                  className={
                    regOpen
                      ? "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-slate-800"
                      : "rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-800"
                  }
                >
                  <p
                    className={
                      regOpen
                        ? "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400"
                        : "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                    }
                  >
                    <Hourglass className="h-4 w-4" /> Hạn đăng ký
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {regOpen ? formatDate(regDeadline) : "Đã đóng"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {tournament.allowLateRegistration
                      ? "Nhận đăng ký đến khi tournament kết thúc"
                      : "Đóng đăng ký khi tournament bắt đầu"}
                  </p>
                </div>
              </section>
            );
          })()}

          {/* Missions */}
          {tournament.missions.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Target className="h-6 w-6 text-rose-600 dark:text-orange-400" />
                Danh sách nhiệm vụ
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                  {tournament.missions.length}
                </span>
              </h2>
              <ol className="mt-4 space-y-3">
                {tournament.missions.map((mission, idx) => {
                  const mStatus = isRegistered ? statusFor(mission) : null;
                  const mLocked = isRegistered && lockedFor(mission);
                  const actionable =
                    !!mission.missionType && mission.missionType !== "COURSE_LINKED";
                  return (
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
                          <div className="flex items-center gap-1.5">
                            {isRegistered && (
                              <MissionStatusChip status={mStatus} locked={mLocked} />
                            )}
                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-1 text-xs font-black text-amber-900 ring-1 ring-amber-500/40">
                              <Gem
                                className="h-3.5 w-3.5 text-sky-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                                fill="currentColor"
                                strokeWidth={1.5}
                                stroke="white"
                              />
                              {mission.points}
                            </span>
                          </div>
                        </div>
                        {mission.description && (
                          <SafeHtml
                            html={plainToRichHtml(mission.description)}
                            className="prose prose-sm mt-2 max-w-none text-slate-600 dark:prose-invert dark:text-slate-300"
                          />
                        )}
                        {mission.prerequisiteId && (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <Lock className="h-3 w-3" /> Yêu cầu hoàn thành mission trước
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {actionable ? (
                            <>
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
                                  Hạn: {formatDateTime(mission.submissionDeadline)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold uppercase text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                              Tự động tính theo học tập
                            </span>
                          )}

                          {/* CTA — adapts to viewer state */}
                          {actionable && (
                            isEnded ? (
                              <Link
                                href={`/tournaments/${tournament.id}/missions/${mission.id}`}
                                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                Xem nhiệm vụ <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            ) : !isRegistered ? (
                              canRegister || !isLoggedIn ? (
                                <a
                                  href="#register-panel"
                                  className="ml-auto inline-flex items-center gap-1 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                >
                                  <Lock className="h-3.5 w-3.5" /> Đăng ký để mở
                                </a>
                              ) : (
                                <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                                  <Eye className="h-3.5 w-3.5" /> Chỉ xem
                                </span>
                              )
                            ) : mLocked ? (
                              <span
                                className="ml-auto inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                                title="Cần hoàn thành mission trước"
                              >
                                <Lock className="h-3.5 w-3.5" /> Khoá
                              </span>
                            ) : (
                              <Link
                                href={`/tournaments/${tournament.id}/missions/${mission.id}`}
                                className="ml-auto inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:scale-105"
                              >
                                {mStatus ? "Xem nhiệm vụ" : "Làm nhiệm vụ"} <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Leaderboard */}
          {showLeaderboard && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Trophy className="h-6 w-6 text-amber-500" />
                Bảng xếp hạng
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  (Top 20)
                </span>
              </h2>

              {tournament.rankings.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-orange-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-orange-700 dark:bg-slate-800 dark:text-slate-400">
                  <Users className="mx-auto h-10 w-10 text-orange-400" strokeWidth={1.5} />
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
                      teamMap={teamMap}
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
                            const displayName = rankName(entry);
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
          {/* Register / Team panel */}
          <div id="register-panel" className="scroll-mt-20">
          {tournament.teamSize > 1 ? (
            <TournamentTeamPanel
              tournamentId={params.id}
              teamSize={tournament.teamSize}
              isLoggedIn={!!session?.user?.id}
              isEnded={isEnded}
              isOpen={isOpen}
              isLocked={tournament.status === "active"}
              currentUserId={session?.user?.id ?? null}
              myTeam={
                registration?.team
                  ? {
                      id: registration.team.id,
                      name: registration.team.name,
                      captainId: registration.team.captainId,
                      joinCode: registration.team.joinCode,
                      members: registration.team.registrations.map((r) => ({
                        id: r.id,
                        registeredAt: r.registeredAt.toISOString(),
                        user: r.user,
                      })),
                    }
                  : null
              }
            />
          ) : (
            <TournamentRegisterButton
              tournamentId={params.id}
              isLoggedIn={!!session?.user?.id}
              isRegistered={isRegistered}
              isEnded={isEnded}
              isOpen={isOpen}
              regOpen={regOpen}
            />
          )}
          </div>

          {/* Showcase link — chỉ hiện khi có mission COLLECTIVE */}
          {tournament.missions.some((m) => m.isTeamSubmission) && (
            <Link
              href={`/tournaments/${params.id}/showcase`}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 p-4 text-center font-bold text-violet-800 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-violet-700 dark:from-violet-950/40 dark:via-fuchsia-950/40 dark:to-rose-950/40 dark:text-violet-200"
            >
              <Sparkles className="h-4 w-4" /> Xem showcase project <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {/* Quick stats */}
          <div className="rounded-2xl border border-orange-200/60 bg-white p-5 shadow-md dark:border-orange-900/40 dark:bg-slate-800">
            <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-rose-700 dark:text-orange-400">
              <Settings className="h-3.5 w-3.5" /> Quy chế
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Hình thức</dt>
                <dd className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  {tournament.teamSize > 1 ? (
                    <>
                      <Users className="h-4 w-4" /> Đội ({tournament.teamSize})
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4" /> Cá nhân
                    </>
                  )}
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
                  <dt className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                    <Gem className="h-4 w-4" /> Tổng giải
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
                  <Award className="h-3.5 w-3.5" /> Phân phối giải
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
                          <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                            <RankMedal rank={placeNum} className="h-4 w-4" />
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
// Status banner — single source of truth for "what can I do here?".
// Sits above the content grid so registration state is unmissable.
// ─────────────────────────────────────────────────────────────────────
function StatusBanner({
  tournamentId,
  isLoggedIn,
  isRegistered,
  isEnded,
  canRegister,
  isSpectator,
  teamSize,
  teamName,
  teamCount,
  myRank,
  myPoints,
}: {
  tournamentId: string;
  isLoggedIn: boolean;
  isRegistered: boolean;
  isEnded: boolean;
  canRegister: boolean;
  isSpectator: boolean;
  teamSize: number;
  teamName: string | null;
  teamCount: number | null;
  myRank: number | null;
  myPoints: number | null;
}) {
  const base =
    "mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 shadow-sm";

  // Standing summary shown when registered + has a ranking row.
  const standing =
    myRank != null ? (
      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-slate-800 dark:bg-black/20 dark:text-slate-100">
        <Trophy className="h-4 w-4 text-amber-500" /> Hạng #{myRank}
        <span className="text-slate-400">·</span> {myPoints ?? 0} điểm
      </span>
    ) : null;

  if (!isLoggedIn) {
    return (
      <div className={`${base} border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-700 dark:from-amber-950/30 dark:to-orange-950/20`}>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          🎟️ Đăng nhập để đăng ký và nhận nhiệm vụ.
        </p>
        <a
          href={`/signin?callbackUrl=/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow transition hover:scale-105"
        >
          <LogIn className="h-4 w-4" /> Đăng nhập
        </a>
      </div>
    );
  }

  if (isRegistered) {
    return (
      <div className={`${base} border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 dark:border-emerald-700 dark:from-emerald-950/30 dark:to-teal-950/20`}>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {isEnded ? "Tournament đã kết thúc" : "Bạn đã ghi danh"}
          </p>
          {teamSize > 1 && teamName ? (
            <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              Đội <span className="font-bold">{teamName}</span> · {teamCount ?? 0}/{teamSize} thành viên
              {teamCount != null && teamCount < teamSize && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Còn thiếu {teamSize - teamCount}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              {isEnded ? "Xem kết quả chung cuộc bên dưới." : "Hoàn thành nhiệm vụ để leo bảng xếp hạng!"}
            </p>
          )}
        </div>
        {standing}
      </div>
    );
  }

  if (canRegister) {
    return (
      <div className={`${base} border-rose-300 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 dark:border-rose-700 dark:from-rose-950/30 dark:via-orange-950/20 dark:to-amber-950/20`}>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          🔥 Bạn <span className="font-black text-rose-700 dark:text-rose-400">chưa đăng ký</span> — đăng ký để mở khoá nhiệm vụ.
        </p>
        <a
          href="#register-panel"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow transition hover:scale-105"
        >
          Đăng ký ngay <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  if (isSpectator) {
    return (
      <div className={`${base} border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800`}>
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Eye className="h-4 w-4" /> Tournament đã bắt đầu — bạn đang ở chế độ xem, không nộp bài được.
        </p>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className={`${base} border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800`}>
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
          🏁 Tournament đã kết thúc — xem kết quả bên dưới.
        </p>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Per-mission status chip (only shown to registered viewers).
// ─────────────────────────────────────────────────────────────────────
function MissionStatusChip({
  status,
  locked,
}: {
  status: "pending" | "passed" | "failed" | "disqualified" | null;
  locked: boolean;
}) {
  const cls = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold";
  if (locked) {
    return (
      <span className={`${cls} bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400`}>
        <Lock className="h-3 w-3" /> Khoá
      </span>
    );
  }
  switch (status) {
    case "passed":
      return (
        <span className={`${cls} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300`}>
          <CheckCircle2 className="h-3 w-3" /> Đạt
        </span>
      );
    case "failed":
      return (
        <span className={`${cls} bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300`}>
          <XCircle className="h-3 w-3" /> Chưa đạt
        </span>
      );
    case "pending":
      return (
        <span className={`${cls} bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300`}>
          <Clock className="h-3 w-3" /> Đã nộp
        </span>
      );
    case "disqualified":
      return (
        <span className={`${cls} bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300`}>
          <Ban className="h-3 w-3" /> Bị loại
        </span>
      );
    default:
      return (
        <span className={`${cls} bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400`}>
          <Circle className="h-3 w-3" /> Chưa làm
        </span>
      );
  }
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
  icon: React.ReactNode;
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
        {icon}
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
  teamMap,
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
  teamMap: Map<string, string>;
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
        teamMap={teamMap}
        currentUserId={currentUserId}
        rank={2}
        height="h-32 sm:h-36"
        gradient="from-slate-300 to-slate-400"
      />
      <PodiumSlot
        entry={byRank[1]}
        userMap={userMap}
        teamMap={teamMap}
        currentUserId={currentUserId}
        rank={1}
        height="h-40 sm:h-48"
        gradient="from-yellow-400 to-amber-500"
        crown
      />
      <PodiumSlot
        entry={byRank[3]}
        userMap={userMap}
        teamMap={teamMap}
        currentUserId={currentUserId}
        rank={3}
        height="h-28 sm:h-32"
        gradient="from-orange-400 to-amber-600"
      />
    </div>
  );
}

function PodiumSlot({
  entry,
  userMap,
  teamMap,
  currentUserId,
  rank,
  height,
  gradient,
  crown,
}: {
  entry?: { id: string; userId: string | null; teamId: string | null; totalPoints: number };
  userMap: Map<string, { displayName: string }>;
  teamMap: Map<string, string>;
  currentUserId?: string;
  rank: number;
  height: string;
  gradient: string;
  crown?: boolean;
}) {
  if (!entry) {
    return (
      <div
        className={`flex ${height} flex-col items-center justify-end rounded-t-xl bg-slate-100 px-2 py-3 text-center dark:bg-slate-800`}
      >
        <RankMedal rank={rank} className="h-8 w-8 opacity-30" />
        <span className="mt-1 text-xs font-bold text-slate-400">Hạng {rank}</span>
      </div>
    );
  }
  const displayName =
    (entry.userId ? userMap.get(entry.userId)?.displayName : null) ??
    (entry.teamId ? teamMap.get(entry.teamId) : null) ??
    "—";
  const isMe = entry.userId != null && entry.userId === currentUserId;

  return (
    <div
      className={`relative flex ${height} flex-col items-center justify-end rounded-t-xl bg-gradient-to-b ${gradient} px-2 py-3 text-center shadow-lg ${
        isMe ? "ring-4 ring-rose-500/60 ring-offset-2 ring-offset-amber-50 dark:ring-offset-slate-900" : ""
      }`}
    >
      {crown && (
        <Crown
          aria-hidden
          className="absolute -top-7 left-1/2 h-8 w-8 -translate-x-1/2 text-amber-400 drop-shadow-lg"
          fill="currentColor"
        />
      )}
      <RankMedal rank={rank} className="h-9 w-9 drop-shadow-md" />
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
