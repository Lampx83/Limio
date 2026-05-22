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
import { auth } from "@/lib/auth";

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
            select: { id: true, completedAt: true },
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={`/instructor/tournaments/${params.id}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {mission.tournament.title}
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
          {mission.verifyMode}
          {isCollective && " · Nộp theo nhóm"}
        </p>
        <h1 className="mt-1 h-display text-2xl font-bold sm:text-3xl">
          {mission.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mission.submissions.length} submission
          {mission.submissions.length !== 1 ? "s" : ""}
        </p>
      </header>

      {mission.submissions.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-token py-16 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 font-medium">Chưa có submission nào</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {mission.submissions.map((s) => {
            const team = teamByUser.get(s.userId);
            const payload = (s.payload ?? {}) as HackathonPayload;
            const completedReviews = s.reviewAssignments.filter(
              (r) => r.completedAt,
            ).length;
            const totalReviews = s.reviewAssignments.length;

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
                      Nộp lúc {new Date(s.submittedAt).toLocaleString("vi-VN")}
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
                        Repo
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
                        Slides
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
                        Demo
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
                  {mission.verifyMode === "MANUAL_REVIEW" && mission.assignment ? (
                    <Link
                      href={`/instructor/assignments/${mission.assignment.id}/submissions`}
                      className="btn-primary btn-sm"
                    >
                      Chấm bài →
                    </Link>
                  ) : mission.verifyMode === "PEER_REVIEW" ? (
                    <span className="text-muted">
                      Review: {completedReviews}/{totalReviews} hoàn thành
                    </span>
                  ) : (
                    <span className="text-faint">Auto-graded</span>
                  )}
                </footer>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
