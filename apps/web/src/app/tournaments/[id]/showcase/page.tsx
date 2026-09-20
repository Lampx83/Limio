import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Code2, Presentation, Video, Crown, Trophy, Play } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { showcaseAccess, canVoteInShowcase, normalizeShowcaseMode } from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import VoteButton from "./VoteButton";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type HackathonPayload = {
  hackathon?: boolean;
  repoUrl?: string;
  slidesUrl?: string;
  demoVideoUrl?: string;
  writeup?: string;
  artifactMarkdown?: string;
};

type SortKey = "recent" | "votes" | "score" | "mission";

// Extract YouTube video ID from common URL formats so we can build a thumbnail.
function youtubeThumbnail(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === "youtu.be") {
      id = u.pathname.slice(1) || null;
    } else if (/youtube\.com$/.test(u.hostname.replace(/^www\./, ""))) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? null;
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] ?? null;
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } catch {
    return null;
  }
}

export default async function ShowcasePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sort?: string; mission?: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=/tournaments/${params.id}/showcase`);

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, teamSize: true, status: true, creatorId: true, showcaseMode: true, endsAt: true },
  });
  if (!tournament) notFound();

  // Ai xem được bài của các đội do giảng viên cấu hình (showcaseMode) + trạng thái giải.
  const myReg = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: params.id, userId } },
    include: { team: { select: { captainId: true } } },
  });
  const myTeamCaptainId = myReg?.team?.captainId ?? null;
  const isCreatorOrAdmin = tournament.creatorId === userId || (await isAdmin(userId));
  const access = showcaseAccess({
    mode: tournament.showcaseMode,
    status: tournament.status,
    isCreatorOrAdmin,
    isParticipant: !!myReg,
  });
  if (!access.canView) redirect("/tournaments");
  const canVote = canVoteInShowcase({
    mode: tournament.showcaseMode,
    status: tournament.status,
    isParticipant: !!myReg,
    isDisqualified: !!myReg?.disqualifiedAt,
  });

  const missions = await prisma.tournamentMission.findMany({
    where: { tournamentId: params.id, isTeamSubmission: true },
    orderBy: { orderIndex: "asc" },
    include: {
      // PEER_REVIEW / hackathon → MissionSubmission.
      submissions: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      // MANUAL_REVIEW (GV chấm) → bài nộp nằm ở AssignmentSubmission.
      assignment: {
        select: {
          submissions: {
            select: {
              id: true,
              userId: true,
              body: true,
              attachmentUrl: true,
              status: true,
              score: true,
              submittedAt: true,
              user: { select: { id: true, displayName: true } },
            },
          },
        },
      },
    },
  });

  const allSubmissionIds = missions.flatMap((m) => m.submissions.map((s) => s.id));
  const allMissionIds = missions.map((m) => m.id);
  const [voteCounts, myVotes] = await Promise.all([
    allSubmissionIds.length
      ? prisma.hackathonVote.groupBy({
          by: ["submissionId"],
          where: { submissionId: { in: allSubmissionIds } },
          _count: { submissionId: true },
        })
      : [],
    allMissionIds.length
      ? prisma.hackathonVote.findMany({
          where: { voterUserId: userId, missionId: { in: allMissionIds } },
          select: { missionId: true, submissionId: true },
        })
      : [],
  ]);
  const voteCountBySubmission = new Map(
    voteCounts.map((v) => [v.submissionId, v._count.submissionId]),
  );
  const myVoteByMission = new Map(myVotes.map((v) => [v.missionId, v.submissionId]));

  // Top voted per mission — drives 🏆 badge.
  const topVotedBySubmission = new Set<string>();
  for (const m of missions) {
    let best: { id: string; count: number } | null = null;
    for (const s of m.submissions) {
      const c = voteCountBySubmission.get(s.id) ?? 0;
      if (c > 0 && (!best || c > best.count)) best = { id: s.id, count: c };
    }
    if (best) topVotedBySubmission.add(best.id);
  }

  const captainIds = missions.flatMap((m) => [
    ...m.submissions.map((s) => s.userId),
    ...(m.assignment?.submissions.map((s) => s.userId) ?? []),
  ]);
  const teamRegs = captainIds.length
    ? await prisma.tournamentRegistration.findMany({
        where: {
          tournamentId: params.id,
          userId: { in: captainIds },
          teamId: { not: null },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              captainId: true,
              registrations: {
                select: { user: { select: { displayName: true } } },
              },
            },
          },
        },
      })
    : [];
  const teamByUser = new Map(teamRegs.map((r) => [r.userId, r.team!]));

  const allRaw = missions.flatMap((m) => [
    // MissionSubmission (peer review / hackathon) — có bình chọn.
    ...m.submissions.map((s) => ({
      submissionId: s.id,
      missionId: m.id,
      missionTitle: m.title,
      missionOrder: m.orderIndex,
      missionPoints: m.points,
      status: s.status as string,
      finalScore: s.finalScore as number | null,
      submittedAt: s.submittedAt,
      captain: s.user,
      team: teamByUser.get(s.userId) ?? null,
      payload: (s.payload ?? {}) as HackathonPayload,
      voteCount: voteCountBySubmission.get(s.id) ?? 0,
      isTopVoted: topVotedBySubmission.has(s.id),
      votable: true,
    })),
    // AssignmentSubmission (MANUAL_REVIEW) — chuẩn hoá cùng shape; không bình chọn.
    ...(m.assignment?.submissions ?? []).map((s) => ({
      submissionId: s.id,
      missionId: m.id,
      missionTitle: m.title,
      missionOrder: m.orderIndex,
      missionPoints: m.points,
      status: s.status as string,
      finalScore: s.score != null ? s.score / 100 : null,
      submittedAt: s.submittedAt,
      captain: s.user,
      team: teamByUser.get(s.userId) ?? null,
      payload: {
        writeup: s.body || undefined,
        repoUrl: s.attachmentUrl || undefined,
      } as HackathonPayload,
      voteCount: 0,
      isTopVoted: false,
      votable: false,
    })),
  ]);

  // Chế độ "sau khi kết thúc": trong lúc thi chỉ thấy bài của đội mình (tránh lộ bài cho đối thủ).
  const ownCaptainIds = new Set([userId, myTeamCaptainId].filter((x): x is string => !!x));
  const all = access.scope === "all" ? allRaw : allRaw.filter((f) => ownCaptainIds.has(f.captain.id));

  // ── Filter + sort (server-driven via searchParams) ────────────────────
  const sort = (searchParams.sort as SortKey) || "recent";
  const missionFilter = searchParams.mission ?? "all";
  let flat = missionFilter === "all" ? all : all.filter((f) => f.missionId === missionFilter);
  switch (sort) {
    case "votes":
      flat = flat.sort((a, b) => b.voteCount - a.voteCount);
      break;
    case "score":
      flat = flat.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
      break;
    case "mission":
      flat = flat.sort(
        (a, b) =>
          a.missionOrder - b.missionOrder ||
          b.submittedAt.getTime() - a.submittedAt.getTime(),
      );
      break;
    case "recent":
    default:
      flat = flat.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  const sortLabels: Record<SortKey, string> = {
    recent: "Mới nhất",
    votes: "Nhiều ❤️ nhất",
    score: "Điểm cao nhất",
    mission: "Theo mission",
  };
  const base = `/tournaments/${params.id}/showcase`;
  const buildUrl = (next: Partial<{ sort: SortKey; mission: string }>) => {
    const params = new URLSearchParams();
    const s = next.sort ?? sort;
    const m = next.mission ?? missionFilter;
    if (s !== "recent") params.set("sort", s);
    if (m !== "all") params.set("mission", m);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <Link
        href={`/tournaments/${params.id}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {tournament.title}
      </Link>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl font-bold sm:text-4xl">
            🎤 Showcase — {tournament.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {all.length === 0
              ? "Chưa có đội nào nộp project."
              : `${all.length} project từ ${new Set(all.map((f) => f.team?.id).filter(Boolean)).size} đội`}
          </p>
        </div>
        {all.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-faint">Sắp xếp:</span>
            <div className="flex gap-1">
              {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                <Link
                  key={k}
                  href={buildUrl({ sort: k })}
                  className={`rounded-full border px-3 py-1 font-medium transition-colors ${
                    sort === k
                      ? "border-brand-500 bg-brand-soft text-brand-700"
                      : "border-token hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                  prefetch={false}
                >
                  {sortLabels[k]}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {access.scope === "own_team_only" && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Trong lúc giải diễn ra, bạn chỉ thấy bài của đội mình. Bài của tất cả các đội sẽ được mở sau khi giải kết thúc
          {" "}({formatDateTime(tournament.endsAt)}), lúc đó bạn cũng bình chọn được.
        </div>
      )}
      {access.reason === "creator" && normalizeShowcaseMode(tournament.showcaseMode) === "after_end" && tournament.status !== "ended" && (
        <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
          Bạn xem được tất cả vì là người tạo giải. Người chơi chỉ thấy bài của đội mình cho đến khi giải kết thúc
          (đổi ở tab Thông tin cơ bản, mục "Khi nào xem được bài của các đội").
        </div>
      )}
      {tournament.status === "draft" && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Đây là bản xem thử. Giải còn nháp nên học viên chưa thấy trang này.
        </div>
      )}

      {/* Mission filter chips — only when >1 COLLECTIVE mission */}
      {missions.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Link
            href={buildUrl({ mission: "all" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              missionFilter === "all"
                ? "border-brand-500 bg-brand-soft text-brand-700"
                : "border-token hover:bg-[rgb(var(--surface-muted))]"
            }`}
          >
            Tất cả mission
          </Link>
          {missions.map((m) => (
            <Link
              key={m.id}
              href={buildUrl({ mission: m.id })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                missionFilter === m.id
                  ? "border-brand-500 bg-brand-soft text-brand-700"
                  : "border-token hover:bg-[rgb(var(--surface-muted))]"
              }`}
              prefetch={false}
            >
              {m.title}
            </Link>
          ))}
        </div>
      )}

      {flat.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-token py-16 text-center">
          <div className="text-4xl">🚧</div>
          <p className="mt-3 font-medium">
            {all.length === 0
              ? access.scope === "own_team_only"
                ? "Đội bạn chưa nộp bài"
                : "Chờ các đội nộp bài"
              : "Không có bài nộp khớp bộ lọc"}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {flat.map((f) => {
            const team = f.team;
            const thumb = youtubeThumbnail(f.payload.demoVideoUrl);
            return (
              <article
                key={f.submissionId}
                className={`relative flex flex-col overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                  f.isTopVoted ? "border-amber-300 ring-2 ring-amber-200" : "border-token"
                }`}
              >
                {f.isTopVoted && (
                  <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                    <Trophy size={11} strokeWidth={2.5} />
                    Top voted
                  </span>
                )}

                {/* Thumbnail or gradient header */}
                {thumb ? (
                  <a
                    href={f.payload.demoVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-video overflow-hidden bg-slate-900"
                    title="Xem demo video"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={`Demo của ${team?.name ?? "đội"}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-lg">
                        <Play size={20} fill="currentColor" />
                      </span>
                    </span>
                  </a>
                ) : (
                  <div className="bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-4 text-white">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-90">
                      {f.missionTitle}
                    </p>
                  </div>
                )}

                <div className="flex-1 p-4">
                  {thumb && (
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                      {f.missionTitle}
                    </p>
                  )}
                  <h2 className="mt-1 text-lg font-bold leading-tight">
                    {team?.name ?? "Solo"}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Crown size={12} />
                    {f.captain.displayName}
                    {team && (
                      <span className="text-faint">
                        · {team.registrations.length} thành viên
                      </span>
                    )}
                  </p>

                  {f.payload.writeup && (
                    <p className="mt-2 line-clamp-3 text-sm text-[rgb(var(--text-muted))]">
                      {f.payload.writeup}
                    </p>
                  )}
                  {!f.payload.writeup && !thumb && f.payload.artifactMarkdown && (
                    <p className="mt-2 line-clamp-3 text-sm text-[rgb(var(--text-muted))]">
                      {f.payload.artifactMarkdown.slice(0, 200)}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {f.payload.repoUrl && (
                      <a
                        href={f.payload.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                      >
                        <Code2 size={12} />
                        Repo
                      </a>
                    )}
                    {f.payload.slidesUrl && (
                      <a
                        href={f.payload.slidesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                      >
                        <Presentation size={12} />
                        Slides
                      </a>
                    )}
                    {f.payload.demoVideoUrl && !thumb && (
                      <a
                        href={f.payload.demoVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                      >
                        <Video size={12} />
                        Demo
                      </a>
                    )}
                  </div>
                </div>

                <footer className="flex items-center justify-between gap-2 border-t border-token bg-[rgb(var(--surface-muted))/0.5] px-4 py-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        f.status === "passed"
                          ? "bg-success-50 text-success-700"
                          : f.status === "failed"
                            ? "bg-danger-50 text-danger-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {f.status === "passed"
                        ? "✓ Đạt"
                        : f.status === "failed"
                          ? "Chưa đạt"
                          : "Chờ chấm"}
                    </span>
                    {f.votable && (
                      <VoteButton
                        tournamentId={params.id}
                        missionId={f.missionId}
                        submissionId={f.submissionId}
                        initialVoted={myVoteByMission.get(f.missionId) === f.submissionId}
                        initialCount={f.voteCount}
                        disabled={!canVote || myTeamCaptainId === f.captain.id}
                        disabledReason={
                          !canVote
                            ? "Chỉ người chơi được bình chọn, khi giải cho xem bài của tất cả các đội"
                            : "Không thể bình chọn cho đội của bạn"
                        }
                      />
                    )}
                  </div>
                  <span className="text-faint">
                    {formatDateTime(f.submittedAt)}
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
