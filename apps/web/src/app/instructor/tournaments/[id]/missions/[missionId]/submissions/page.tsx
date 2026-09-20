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
import ReviewerManager from "./ReviewerManager";
import MissionGradeForm from "./MissionGradeForm";
import AutoAssignReviewersButton from "./AutoAssignReviewersButton";
import ReviewerLoadPlanner from "./ReviewerLoadPlanner";
import ReviewDetailsPanel from "./ReviewDetailsPanel";
import CloseReviewsButton from "./CloseReviewsButton";

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
              <h2 className="text-sm font-semibold">🏆 Xếp hạng mission</h2>
              <span className="text-[11px] text-faint">
                Điểm chưa chốt là <em>tạm tính</em> theo review đã hoàn thành
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

            return (
              <li
                key={s.id}
                className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-sm"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isCollective && <Crown size={14} className="text-amber-500" />}
                      <p className="font-semibold">
                        {team?.name ?? s.user.displayName}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-faint">
                      {isCollective && team ? (
                        <>
                          Captain: {s.user.displayName} ·{" "}
                          {team.registrations.length} thành viên ·{" "}
                        </>
                      ) : (
                        <>{s.user.email} · </>
                      )}
                      Nộp lúc {formatDateTime(s.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-semibold ${statusCls}`}
                  >
                    <StatusIcon size={12} />
                    {statusLabel}
                    {s.finalScore !== null && (
                      <span className="ml-1">
                        · {Math.round(s.finalScore * 100)}%
                      </span>
                    )}
                  </span>
                </header>

                {isCollective && team && (
                  <p className="mt-2 text-xs text-muted">
                    Thành viên:{" "}
                    {team.registrations
                      .map((r) => r.user.displayName)
                      .join(", ")}
                  </p>
                )}

                {payload.writeup && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm">
                    {payload.writeup}
                  </p>
                )}

                {(payload.repoUrl || payload.slidesUrl || payload.demoVideoUrl) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {payload.repoUrl && (
                      <a
                        href={payload.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                      >
                        <Code2 size={12} />
                        Mã nguồn
                      </a>
                    )}
                    {payload.slidesUrl && (
                      <a
                        href={payload.slidesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                      >
                        <Presentation size={12} />
                        Slide
                      </a>
                    )}
                    {payload.demoVideoUrl && (
                      <a
                        href={payload.demoVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                      >
                        <Video size={12} />
                        Video demo
                      </a>
                    )}
                  </div>
                )}

                {/* Legacy artifactMarkdown (non-hackathon PEER_REVIEW) */}
                {!payload.writeup &&
                  !payload.repoUrl &&
                  payload.artifactMarkdown && (
                    <p className="mt-3 whitespace-pre-wrap rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm">
                      {payload.artifactMarkdown}
                    </p>
                  )}

                {/* Action footer */}
                <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-token pt-3 text-xs">
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
                </footer>

                {mission.verifyMode === "PEER_REVIEW" && (
                  <ReviewDetailsPanel
                    tournamentId={params.id}
                    submissionId={s.id}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
