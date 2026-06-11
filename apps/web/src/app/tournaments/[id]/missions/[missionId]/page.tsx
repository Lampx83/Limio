import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { calcAggregateScore, calcMedian } from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import MissionSubmitForm from "./MissionSubmitForm";
import MissionRankingPanel from "./MissionRankingPanel";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
}: {
  params: { id: string; missionId: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?next=/tournaments/${params.id}/missions/${params.missionId}`);

  const mission = await prisma.tournamentMission.findFirst({
    where: { id: params.missionId, tournamentId: params.id },
    include: {
      tournament: { select: { id: true, title: true, status: true, teamSize: true } },
      quiz: { select: { id: true } },
      assignment: { select: { id: true } },
    },
  });
  if (!mission) notFound();

  const registered = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: params.id, userId } },
    include: {
      team: { select: { id: true, captainId: true, name: true } },
    },
  });

  // COLLECTIVE submission: status comes from captain's submission (single
  // source of truth for the team). Members see it as theirs but cannot edit.
  const isCollective =
    mission.isTeamSubmission && mission.tournament.teamSize > 1;
  const isCaptain =
    isCollective && registered?.team?.captainId === userId;
  const submissionLookupUserId =
    isCollective && registered?.team
      ? registered.team.captainId
      : userId;

  const submission = await prisma.missionSubmission.findUnique({
    where: {
      missionId_userId: { missionId: params.missionId, userId: submissionLookupUserId },
    },
    include: {
      reviewAssignments: {
        // Ẩn danh: KHÔNG select tên reviewer. Chỉ điểm + nhận xét.
        orderBy: { completedAt: "asc" },
        select: {
          id: true,
          completedAt: true,
          scores: true,
          comment: true,
          aggregateScore: true,
        },
      },
    },
  });

  // Feedback hiện NGAY cho SV (reviewer đã ẩn danh nên không cần chờ chốt điểm).
  // Mỗi review đã hoàn thành hiện liền; điểm tổng hợp (%) chỉ có sau khi chốt.
  const rubricCriteria =
    (mission.rubric as
      | { id: string; label: string; scale: "1-5" | "pass_fail" }[]
      | null) ?? [];
  const receivedFeedback = submission
    ? submission.reviewAssignments
        .filter((r) => r.completedAt)
        .map((r) => ({
          scores:
            (r.scores as { criterionId: string; score: number }[]) ?? [],
          comment: r.comment,
          aggregateScore: r.aggregateScore,
        }))
    : [];

  // ── Xếp hạng mission (cho SV): Top 10 + thứ hạng nhóm mình. Điểm = finalScore
  // hoặc median tạm tính từ review đã hoàn thành. Chỉ cho PEER_REVIEW.
  let rankingTop: {
    rank: number;
    name: string;
    score: number | null;
    isFinal: boolean;
    isMine: boolean;
  }[] = [];
  let myRank: { rank: number; total: number; score: number | null } | null = null;
  if (mission.verifyMode === "PEER_REVIEW") {
    const rubric =
      (mission.rubric as { id: string; label: string; scale: string }[] | null) ??
      [];
    const allSubs = await prisma.missionSubmission.findMany({
      where: { missionId: params.missionId },
      select: {
        id: true,
        userId: true,
        finalScore: true,
        reviewAssignments: {
          where: { completedAt: { not: null } },
          select: { scores: true },
        },
      },
    });
    // Map captain/submitter → tên nhóm (team) hoặc displayName (solo).
    const submitterIds = allSubs.map((s) => s.userId);
    const regs = submitterIds.length
      ? await prisma.tournamentRegistration.findMany({
          where: { tournamentId: params.id, userId: { in: submitterIds } },
          select: {
            userId: true,
            team: { select: { name: true } },
            user: { select: { displayName: true } },
          },
        })
      : [];
    const nameOf = new Map(
      regs.map((r) => [r.userId, r.team?.name ?? r.user.displayName]),
    );
    const scored = allSubs
      .map((s) => {
        const aggs = s.reviewAssignments.map((r) =>
          calcAggregateScore(
            (r.scores as { criterionId: string; score: number }[]) ?? [],
            rubric as never,
          ),
        );
        return {
          id: s.id,
          name: nameOf.get(s.userId) ?? "—",
          score: s.finalScore ?? (aggs.length ? calcMedian(aggs) : null),
          isFinal: s.finalScore !== null,
        };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    const mineId = submission?.id ?? null;
    rankingTop = scored.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      score: r.score,
      isFinal: r.isFinal,
      isMine: r.id === mineId,
    }));
    if (mineId) {
      const idx = scored.findIndex((r) => r.id === mineId);
      if (idx >= 0)
        myRank = {
          rank: idx + 1,
          total: scored.length,
          score: scored[idx]!.score,
        };
    }
  }

  const content = mission.contentPayload as
    | { markdown?: string; url?: string; instructions?: string }
    | null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <Link href={`/tournaments/${params.id}`} className="link text-sm">
        ← {mission.tournament.title}
      </Link>
      <h1 className="mt-3 h-display text-2xl font-bold sm:text-3xl">{mission.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="chip-accent">{mission.points} điểm</span>
        {mission.verifyMode && (
          <span className="chip">
            {{
              AUTO_GRADE:    "Tự chấm (quiz)",
              AUTO_CHECK:    "Tự kiểm tra",
              PEER_REVIEW:   "Bạn học chấm",
              MANUAL_REVIEW: "GV chấm",
            }[mission.verifyMode]}
          </span>
        )}
        {mission.submissionDeadline && (
          <span className="text-faint">
            Hạn nộp: {formatDateTime(mission.submissionDeadline)}
          </span>
        )}
      </div>

      {/* External URL appears first (the action point) */}
      {content?.url && (
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-soft px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
        >
          🔗 Mở liên kết: {content.url}
        </a>
      )}

      {/* Description / nội dung — rich-text HTML */}
      {mission.description && (
        <div
          className="prose prose-sm mt-4 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: mission.description }}
        />
      )}

      {/* Legacy: pre-2026-05-22 missions had markdown in contentPayload */}
      {content?.markdown && !mission.description && (
        <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
          {content.markdown}
        </pre>
      )}

      {/* Team-collective hint */}
      {isCollective && registered?.team && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            🤝 Mission nộp theo nhóm — đội {registered.team.name}
          </p>
          <p className="mt-0.5 text-emerald-700/80 dark:text-emerald-300/80">
            {isCaptain
              ? "Bạn là captain — chỉ bạn nộp 1 lần đại diện cả đội. Kết quả sẽ tính cho mọi thành viên."
              : "Chỉ captain mới được nộp bài. Bạn sẽ tự động được tính hoàn thành khi captain nộp."}
          </p>
        </div>
      )}

      {/* Status / Submit */}
      <section className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
        {!registered ? (
          <div className="text-sm text-muted">
            Bạn cần đăng ký tournament trước.{" "}
            <Link href={`/tournaments/${params.id}`} className="link">
              Đăng ký →
            </Link>
          </div>
        ) : !mission.verifyMode ? (
          <p className="text-sm text-muted">Mission COURSE_LINKED — auto-tracked theo hành vi học.</p>
        ) : isCollective && !isCaptain ? (
          submission ? (
            <SubmissionStatusBlock
              submission={submission}
              verifyMode={mission.verifyMode}
              passThreshold={mission.passThreshold}
              peerReviewerCount={mission.peerReviewerCount}
              submissionDeadlineIso={mission.submissionDeadline?.toISOString() ?? null}
              feedback={receivedFeedback}
              rubric={rubricCriteria}
            />
          ) : (
            <p className="text-sm text-muted">
              Captain của đội chưa nộp bài. Quay lại sau khi captain nộp xong.
            </p>
          )
        ) : (
          // Solo learner or team captain — can submit / resubmit until deadline.
          <div className="space-y-5">
            {submission && (
              <SubmissionStatusBlock
                submission={submission}
                verifyMode={mission.verifyMode}
                passThreshold={mission.passThreshold}
                peerReviewerCount={mission.peerReviewerCount}
                submissionDeadlineIso={mission.submissionDeadline?.toISOString() ?? null}
              />
            )}
            {(() => {
              const beforeDeadline =
                !mission.submissionDeadline || new Date() < mission.submissionDeadline;
              if (!beforeDeadline) {
                return submission ? null : (
                  <p className="text-sm text-muted">⏰ Đã hết hạn nộp bài.</p>
                );
              }
              return (
                <div className="space-y-2">
                  {submission && (
                    <p className="text-sm font-semibold text-strong">
                      ✏️ Nộp lại bài
                      <span className="ml-1 font-normal text-muted">
                        — bài mới sẽ thay bài cũ; được nộp lại đến hết hạn.
                      </span>
                    </p>
                  )}
                  <MissionSubmitForm
                    missionId={mission.id}
                    verifyMode={mission.verifyMode}
                    quizId={mission.quiz?.id ?? null}
                    assignmentId={mission.assignment?.id ?? null}
                    submissionDeadlineIso={mission.submissionDeadline?.toISOString() ?? null}
                    hackathonMode={isCollective}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {rankingTop.length > 0 && (
        <div className="mt-6">
          <MissionRankingPanel top={rankingTop} mine={myRank} />
        </div>
      )}
    </main>
  );
}

function SubmissionStatusBlock({
  submission,
  verifyMode,
  passThreshold,
  peerReviewerCount,
  submissionDeadlineIso,
  feedback = [],
  rubric = [],
}: {
  submission: {
    status: string;
    finalScore: number | null;
    submittedAt: Date;
    reviewAssignments: { completedAt: Date | null }[];
  };
  verifyMode: string | null;
  passThreshold: number | null;
  peerReviewerCount: number | null;
  submissionDeadlineIso: string | null;
  /** Feedback đã chốt, ẩn danh reviewer. */
  feedback?: {
    scores: { criterionId: string; score: number }[];
    comment: string | null;
    aggregateScore: number | null;
  }[];
  rubric?: { id: string; label: string; scale: "1-5" | "pass_fail" }[];
}) {
  const statusLabel = {
    pending:      "Đang chờ xác minh",
    passed:       "Đạt ✓",
    failed:       "Chưa đạt",
    disqualified: "Bị loại",
  }[submission.status] ?? submission.status;

  const tone = submission.status === "passed"
    ? "banner-success"
    : submission.status === "failed" || submission.status === "disqualified"
      ? "banner-danger"
      : "banner-info";

  const completed = submission.reviewAssignments.filter((r) => r.completedAt).length;
  const total = submission.reviewAssignments.length;

  return (
    <div className="space-y-3">
      <div className={tone}>
        <p className="font-medium">{statusLabel}</p>
        {submission.finalScore !== null && (
          <p className="mt-1 text-sm">
            Điểm: {Math.round(submission.finalScore * 100)}%
            {passThreshold && ` (cần ≥ ${Math.round(passThreshold * 100)}%)`}
          </p>
        )}
        {verifyMode === "PEER_REVIEW" && submission.status === "pending" && (
          <p className="mt-1 text-sm">
            Review hoàn thành: {completed} / {peerReviewerCount ?? total}.
            <span className="ml-1 text-faint">XP reviewer sẽ award khi window đóng.</span>
          </p>
        )}
      </div>
      <p className="text-xs text-faint">
        Nộp lúc: {formatDateTime(submission.submittedAt)}
      </p>
      {verifyMode === "PEER_REVIEW" && submission.status === "pending" && (
        <a
          href="/me/reviews"
          className="group flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-soft/60 px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-soft dark:border-brand-800/60"
        >
          <span aria-hidden className="text-xl">🤝</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
              Đến lượt bạn chấm bài bạn khác
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Sau khi window đóng, hệ thống cũng phân công bạn chấm ngẫu nhiên các bài cùng đợt. Vào hàng đợi để chấm khi có →
            </p>
          </div>
          <span aria-hidden className="text-brand-600 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </a>
      )}

      {verifyMode === "PEER_REVIEW" && feedback.length > 0 && (
          <div className="rounded-xl border border-token">
            <div className="border-b border-token bg-[rgb(var(--surface-muted))] px-3 py-2">
              <p className="text-sm font-semibold">
                💬 Nhận xét bạn nhận được ({feedback.length} reviewer)
              </p>
              <p className="text-[11px] text-faint">
                Ẩn danh người chấm. Hiện ngay khi reviewer nộp; điểm cuối là trung
                vị các đánh giá (sau khi chốt).
              </p>
            </div>
            <ul className="divide-y divide-[rgb(var(--border))]">
              {feedback.map((f, i) => (
                <li key={i} className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                      Reviewer {i + 1}
                    </span>
                    {f.aggregateScore !== null && (
                      <span className="text-xs tabular-nums text-muted">
                        {Math.round(f.aggregateScore * 100)}%
                      </span>
                    )}
                  </div>
                  {rubric.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rubric.map((c) => {
                        const s = f.scores.find((x) => x.criterionId === c.id);
                        return (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[11px]"
                          >
                            <span className="text-faint">{c.label}:</span>
                            <span className="font-medium">
                              {s
                                ? c.scale === "pass_fail"
                                  ? s.score === 1
                                    ? "Đạt"
                                    : "Chưa"
                                  : s.score
                                : "—"}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {f.comment ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">
                      {f.comment}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-faint">
                      (Không có nhận xét chữ)
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
