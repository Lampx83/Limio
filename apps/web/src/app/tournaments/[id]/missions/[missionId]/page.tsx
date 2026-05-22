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
      tournament: { select: { id: true, title: true, status: true } },
      quiz: { select: { id: true } },
      assignment: { select: { id: true } },
    },
  });
  if (!mission) notFound();

  const registered = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: params.id, userId } },
  });

  const submission = await prisma.missionSubmission.findUnique({
    where: { missionId_userId: { missionId: params.missionId, userId } },
    include: {
      reviewAssignments: { select: { id: true, completedAt: true } },
    },
  });

  const content = mission.contentPayload as
    | { markdown?: string; url?: string; instructions?: string }
    | null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
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

      {/* Description */}
      {mission.description && (
        <div
          className="prose prose-sm mt-4 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: mission.description }}
        />
      )}

      {/* Custom content */}
      {content?.markdown && (
        <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
          {content.markdown}
        </pre>
      )}
      {content?.url && (
        <p className="mt-3">
          <a href={content.url} target="_blank" rel="noopener noreferrer" className="link">
            🔗 Mở liên kết: {content.url}
          </a>
        </p>
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
        ) : mission.verifyMode ? (
          <MissionSubmitForm
            missionId={mission.id}
            verifyMode={mission.verifyMode}
            quizId={mission.quiz?.id ?? null}
            assignmentId={mission.assignment?.id ?? null}
            submissionDeadlineIso={mission.submissionDeadline?.toISOString() ?? null}
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
    </div>
  );
}
