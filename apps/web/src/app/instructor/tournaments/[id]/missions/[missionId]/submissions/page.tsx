import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Crown,
  Code2,
  Presentation,
  Video,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import {
  calcAggregateScore,
  calcMedian,
  resolveReviewQuorum,
} from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { safeHref, safeHttpUrl } from "@/lib/safeUrl";
import ReviewerManager from "./ReviewerManager";
import MissionGradeForm from "./MissionGradeForm";
import AutoAssignReviewersButton from "./AutoAssignReviewersButton";
import ReviewerLoadPlanner from "./ReviewerLoadPlanner";
import ReviewDetailsPanel from "./ReviewDetailsPanel";
import CloseReviewsButton from "./CloseReviewsButton";
import {
  OpenViewerButton,
  ShowcaseViewerProvider,
  ViewLabel,
  type ViewerItem,
} from "@/app/tournaments/[id]/showcase/ShowcaseViewer";
import { showcaseScoreLabel, showcaseStatus, showcaseWriteup } from "@/lib/tournamentShowcase";

export const dynamic = "force-dynamic";

type HackathonPayload = {
  hackathon?: boolean;
  repoUrl?: string;
  slidesUrl?: string;
  demoVideoUrl?: string;
  writeup?: string;
  artifactMarkdown?: string;
  assignmentSubmissionId?: string;
};

export default async function MissionSubmissionsPage({
  params,
}: {
  params: { id: string; missionId: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(
      `/signin?callbackUrl=/instructor/tournaments/${params.id}/missions/${params.missionId}/submissions`,
    );
  }

  const mission = await prisma.tournamentMission.findFirst({
    where: { id: params.missionId, tournamentId: params.id },
    include: {
      tournament: {
        select: { id: true, title: true, creatorId: true, teamSize: true },
      },
      assignment: { select: { id: true } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          reviewAssignments: {
            select: {
              id: true,
              completedAt: true,
              reviewerId: true,
              scores: true,
              reviewer: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });
  if (!mission) notFound();

  const admin = await isAdmin(userId);
  if (!admin && mission.tournament.creatorId !== userId) {
    redirect("/instructor/tournaments");
  }

  // Resolve team info (for COLLECTIVE missions submission.userId = captainId).
  const captainIds = mission.submissions.map((s) => s.userId);
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
              registrations: {
                include: { user: { select: { id: true, displayName: true } } },
              },
            },
          },
        },
      })
    : [];
  const teamByUser = new Map(teamRegs.map((r) => [r.userId, r.team!]));

  const isCollective = mission.isTeamSubmission;

  // Pool for manual reviewer assignment: any active (non-disqualified)
  // participant of the tournament. Author exclusion happens per-submission.
  const reviewerPool =
    mission.verifyMode === "PEER_REVIEW"
      ? (
          await prisma.tournamentRegistration.findMany({
            where: { tournamentId: params.id, disqualifiedAt: null },
            select: { userId: true, user: { select: { displayName: true } } },
          })
        ).map((r) => ({ userId: r.userId, name: r.user.displayName }))
      : [];

  // Pool reviewer thực tế của mission (để planner gợi ý N):
  //   team + mọi-thành-viên  → số participant active có team
  //   team + chỉ-captain, hoặc solo → số người đã nộp (= submitters)
  const teamMemberCount =
    mission.verifyMode === "PEER_REVIEW" && mission.isTeamSubmission
      ? await prisma.tournamentRegistration.count({
          where: {
            tournamentId: params.id,
            disqualifiedAt: null,
            teamId: { not: null },
          },
        })
      : 0;
  const plannerPoolSize =
    mission.isTeamSubmission && !mission.peerReviewCaptainsOnly
      ? teamMemberCount
      : mission.submissions.length;

  // Xếp hạng mission: điểm = finalScore (đã chốt) hoặc median TẠM TÍNH từ các
  // review đã hoàn thành. Sắp giảm dần; bài chưa có review xuống cuối.
  const rubricForRank =
    (mission.rubric as
      | { id: string; label: string; scale: "1-5" | "pass_fail"; weight: number }[]
      | null) ?? [];
  const quorum = resolveReviewQuorum(
    mission.reviewQuorum,
    mission.peerReviewerCount,
  );
  const ranking = mission.submissions
    .map((s) => {
      const aggs = s.reviewAssignments
        .filter((r) => r.completedAt && r.scores)
        .map((r) =>
          calcAggregateScore(
            (r.scores as { criterionId: string; score: number }[]) ?? [],
            rubricForRank,
          ),
        );
      const provisional = aggs.length ? calcMedian(aggs) : null;
      return {
        id: s.id,
        name: teamByUser.get(s.userId)?.name ?? s.user.displayName,
        score: s.finalScore ?? provisional,
        isFinal: s.finalScore !== null,
        reviews: aggs.length,
        status: s.status,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // Khung xem trước (video/slide nhúng, Trước/Sau theo đúng thứ tự bảng). Chỉ mission "GV chấm"
  // mới có nút Đạt / Chưa đạt trong khung; chấm chéo do reviewer chấm nên GV chỉ xem.
  const viewerItems: ViewerItem[] = mission.submissions.map((s) => {
    const team = teamByUser.get(s.userId);
    const payload = (s.payload ?? {}) as HackathonPayload;
    const st = showcaseStatus("mission", s.status);
    const writeup = showcaseWriteup(payload);
    return {
      submissionId: s.id,
      missionId: mission.id,
      missionTitle: mission.title,
      teamLabel: team?.name ?? s.user.displayName,
      captainName: s.user.displayName,
      memberNames: team ? team.registrations.map((r) => r.user.displayName) : [],
      statusLabel: st.label,
      statusTone: st.tone,
      scoreLabel: showcaseScoreLabel({ kind: "mission", finalScore: s.finalScore, score: null, maxScore: null }),
      submittedAtLabel: formatDateTime(s.submittedAt),
      isLate: s.isLate,
      writeup: writeup ? writeup.slice(0, 20000) : null,
      repoHref: safeHref(payload.repoUrl),
      slidesHref: safeHttpUrl(payload.slidesUrl),
      demoHref: safeHttpUrl(payload.demoVideoUrl),
      votable: false,
      voteCount: 0,
      voted: false,
      voteDisabled: true,
      voteDisabledReason: "",
      isTopVoted: false,
      ...(mission.verifyMode === "MANUAL_REVIEW" ? { grade: { status: s.status } } : {}),
    };
  });

  return (
    <main>
      <Link
        href={`/instructor/tournaments/${params.id}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {mission.tournament.title}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            {mission.verifyMode
              ? {
                  AUTO_GRADE: "Làm bài kiểm tra",
                  AUTO_CHECK: "Nộp liên kết hoặc tệp",
                  PEER_REVIEW: "Chấm chéo",
                  MANUAL_REVIEW: "Bạn chấm",
                }[mission.verifyMode]
              : "Tự tính theo việc học"}
            {isCollective && " · Nộp theo nhóm"}
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {mission.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mission.submissions.length} bài nộp
            {mission.submissions.some((s) => s.isLate) && (
              <> · {mission.submissions.filter((s) => s.isLate).length} nộp muộn</>
            )}
          </p>
        </div>
        {mission.verifyMode === "PEER_REVIEW" && (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <AutoAssignReviewersButton
              tournamentId={params.id}
              missionId={mission.id}
              canAssign={
                mission.submissionDeadline !== null &&
                mission.submissionDeadline.getTime() <= Date.now()
              }
              deadlineLabel={
                mission.submissionDeadline
                  ? formatDateTime(mission.submissionDeadline)
                  : null
              }
            />
            <CloseReviewsButton
              tournamentId={params.id}
              missionId={mission.id}
              quorum={quorum}
            />
          </div>
        )}
      </header>

      {mission.verifyMode === "PEER_REVIEW" &&
        mission.submissions.length > 0 && (
          <ReviewerLoadPlanner
            tournamentId={params.id}
            missionId={mission.id}
            submissionCount={mission.submissions.length}
            poolSize={plannerPoolSize}
            currentN={mission.peerReviewerCount ?? 3}
            captainsOnly={Boolean(mission.peerReviewCaptainsOnly)}
            canAssign={
              mission.submissionDeadline !== null &&
              mission.submissionDeadline.getTime() <= Date.now()
            }
            deadlineLabel={
              mission.submissionDeadline
                ? formatDateTime(mission.submissionDeadline)
                : null
            }
          />
        )}

      {mission.verifyMode === "PEER_REVIEW" &&
        mission.submissions.length > 0 && (
          <section className="mt-4 overflow-hidden rounded-xl border border-token">
            <div className="flex items-center justify-between bg-[rgb(var(--surface-muted))] px-3 py-2">
              <h2 className="text-sm font-semibold">🏆 Xếp hạng nhiệm vụ</h2>
              <span className="text-[11px] text-faint">
                Điểm chưa chốt là <em>tạm tính</em> theo các lượt chấm đã xong
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-faint">
                <tr className="border-b border-token">
                  <th className="px-3 py-1.5 font-medium">#</th>
                  <th className="px-3 py-1.5 font-medium">Nhóm / Học viên</th>
                  <th className="px-3 py-1.5 font-medium">Điểm</th>
                  <th className="px-3 py-1.5 font-medium">Review</th>
                  <th className="px-3 py-1.5 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id} className="border-b border-token last:border-0">
                    <td className="px-3 py-1.5 tabular-nums text-muted">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{r.name}</td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {r.score === null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <>
                          {Math.round(r.score * 100)}%
                          {!r.isFinal && (
                            <span className="ml-1 text-[10px] text-amber-600">
                              tạm tính
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-muted">
                      {r.reviews}/{mission.peerReviewerCount ?? 3}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.status === "passed" ? (
                        <span className="text-success-600">Đạt</span>
                      ) : r.status === "failed" ? (
                        <span className="text-danger-600">Chưa đạt</span>
                      ) : (
                        <span className="text-amber-600">Chờ chốt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

      {mission.submissions.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-token py-16 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 font-medium">Chưa có bài nộp nào</p>
          {mission.submissionDeadline && (
            <p className="mt-1 text-sm text-muted">Hạn nộp: {formatDateTime(mission.submissionDeadline)}</p>
          )}
        </div>
      ) : (
        <ShowcaseViewerProvider tournamentId={params.id} items={viewerItems}>
        <ul className="mt-6 space-y-3">
          {mission.submissions.map((s) => {
            const team = teamByUser.get(s.userId);
            const payload = (s.payload ?? {}) as HackathonPayload;

            const StatusIcon =
              s.status === "passed"
                ? CheckCircle2
                : s.status === "failed"
                  ? XCircle
                  : Clock;
            const statusCls =
              s.status === "passed"
                ? "text-success-600"
                : s.status === "failed"
                  ? "text-danger-600"
                  : "text-amber-600";
            const statusLabel =
              s.status === "passed"
                ? "Đạt"
                : s.status === "failed"
                  ? "Chưa đạt"
                  : s.status === "disqualified"
                    ? "Bị loại"
                    : "Chờ chấm";

            // Vạch màu bên trái thẻ theo trạng thái: lướt qua là biết bài nào chờ chấm.
            const accent =
              s.status === "passed"
                ? "border-l-success-500"
                : s.status === "failed" || s.status === "disqualified"
                  ? "border-l-danger-500"
                  : "border-l-amber-400";
            const repoHref = safeHref(payload.repoUrl);
            const slidesHref = safeHttpUrl(payload.slidesUrl);
            const demoHref = safeHttpUrl(payload.demoVideoUrl);
            const writeup = showcaseWriteup(payload);
            const linkCls =
              "inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))] px-3 py-1 text-xs font-medium transition-colors hover:border-brand-400 hover:bg-brand-soft hover:text-brand-700 dark:hover:text-brand-300";

            return (
              <li
                key={s.id}
                className={`overflow-hidden rounded-2xl border border-l-4 border-token bg-[rgb(var(--surface))] shadow-sm transition-shadow hover:shadow-md ${accent}`}
              >
                <div className="p-5">
                  <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isCollective && <Crown size={16} className="shrink-0 text-amber-500" />}
                        <h3 className="text-lg font-bold leading-tight">
                          {team?.name ?? s.user.displayName}
                        </h3>
                        {s.isLate && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            Nộp muộn
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {isCollective && team ? (
                          <>
                            Đội trưởng <span className="font-medium text-[rgb(var(--text))]">{s.user.displayName}</span>
                            {" · "}
                            {team.registrations.length} thành viên
                          </>
                        ) : (
                          <>{s.user.email}</>
                        )}
                        {" · "}Nộp lúc {formatDateTime(s.submittedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-semibold ${statusCls}`}
                      >
                        <StatusIcon size={12} />
                        {statusLabel}
                        {s.finalScore !== null && (
                          <span className="ml-1">· {Math.round(s.finalScore * 100)}%</span>
                        )}
                      </span>
                      <OpenViewerButton
                        submissionId={s.id}
                        className="btn-primary btn-sm !px-4 !py-2 text-sm font-semibold"
                      >
                        <ViewLabel />
                      </OpenViewerButton>
                    </div>
                  </header>

                  {isCollective && team && (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      <span className="font-medium text-faint">Thành viên:</span>{" "}
                      {team.registrations.map((r) => r.user.displayName).join(", ")}
                    </p>
                  )}

                  {writeup && (
                    <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[rgb(var(--surface-muted))] px-4 py-3 text-sm leading-relaxed">
                      {writeup}
                    </p>
                  )}

                  {(demoHref || slidesHref || repoHref) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {demoHref && (
                        <a href={demoHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                          <Video size={13} />
                          Video demo
                        </a>
                      )}
                      {slidesHref && (
                        <a href={slidesHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                          <Presentation size={13} />
                          Slide
                        </a>
                      )}
                      {repoHref && (
                        <a href={repoHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                          <Code2 size={13} />
                          Mã nguồn
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Chấm điểm / chia reviewer */}
                <footer className="border-t border-token bg-[rgb(var(--surface-muted))]/60 px-5 py-3 text-xs">
                  {mission.verifyMode === "MANUAL_REVIEW" ? (
                    <MissionGradeForm
                      tournamentId={params.id}
                      submissionId={s.id}
                      status={s.status}
                    />
                  ) : mission.verifyMode === "PEER_REVIEW" ? (
                    <ReviewerManager
                      tournamentId={params.id}
                      submissionId={s.id}
                      assignments={s.reviewAssignments.map((r) => ({
                        id: r.id,
                        reviewerId: r.reviewerId,
                        name: r.reviewer.displayName,
                        completedAt: r.completedAt
                          ? r.completedAt.toISOString()
                          : null,
                      }))}
                      pool={reviewerPool.filter((p) => p.userId !== s.userId)}
                      targetCount={mission.peerReviewerCount ?? 3}
                    />
                  ) : (
                    <span className="text-faint">Hệ thống tự chấm</span>
                  )}
                  {mission.verifyMode === "PEER_REVIEW" && (
                    <ReviewDetailsPanel
                      tournamentId={params.id}
                      submissionId={s.id}
                    />
                  )}
                </footer>
              </li>
            );
          })}
        </ul>
        </ShowcaseViewerProvider>
      )}
    </main>
  );
}
