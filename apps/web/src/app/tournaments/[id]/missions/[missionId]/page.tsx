import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import MissionSubmitForm from "./MissionSubmitForm";

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
      reviewAssignments: { select: { id: true, completedAt: true } },
    },
  });

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
            Hạn nộp: {new Date(mission.submissionDeadline).toLocaleString("vi-VN")}
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
        ) : submission ? (
          <SubmissionStatusBlock
            submission={submission}
            verifyMode={mission.verifyMode}
            passThreshold={mission.passThreshold}
            peerReviewerCount={mission.peerReviewerCount}
            submissionDeadlineIso={mission.submissionDeadline?.toISOString() ?? null}
          />
        ) : isCollective && !isCaptain ? (
          <p className="text-sm text-muted">
            Captain của đội chưa nộp bài. Quay lại sau khi captain nộp xong.
          </p>
        ) : mission.verifyMode ? (
          <MissionSubmitForm
            missionId={mission.id}
            verifyMode={mission.verifyMode}
            quizId={mission.quiz?.id ?? null}
            assignmentId={mission.assignment?.id ?? null}
            submissionDeadlineIso={mission.submissionDeadline?.toISOString() ?? null}
            hackathonMode={isCollective}
          />
        ) : (
          <p className="text-sm text-muted">Mission COURSE_LINKED — auto-tracked theo hành vi học.</p>
        )}
      </section>
    </main>
  );
}

function SubmissionStatusBlock({
  submission,
  verifyMode,
  passThreshold,
  peerReviewerCount,
  submissionDeadlineIso,
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
  const beforeDeadline = submissionDeadlineIso
    ? new Date() < new Date(submissionDeadlineIso)
    : false;
  const canResubmit =
    submission.status === "pending" &&
    beforeDeadline &&
    (verifyMode === "AUTO_GRADE" ||
      verifyMode === "AUTO_CHECK" ||
      (verifyMode === "PEER_REVIEW" && completed === 0) ||
      verifyMode === "MANUAL_REVIEW");

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
        Nộp lúc: {submission.submittedAt.toLocaleString("vi-VN")}
      </p>
      {canResubmit && (
        <p className="text-xs text-muted">Bạn có thể nộp lại trước hạn nộp.</p>
      )}
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
    </div>
  );
}
