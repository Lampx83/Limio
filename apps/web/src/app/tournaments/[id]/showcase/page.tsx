import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Github, Presentation, Video, FileText, Crown } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type HackathonPayload = {
  hackathon?: boolean;
  repoUrl?: string;
  slidesUrl?: string;
  demoVideoUrl?: string;
  writeup?: string;
  artifactMarkdown?: string;
};

export default async function ShowcasePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=/tournaments/${params.id}/showcase`);

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      teamSize: true,
      status: true,
    },
  });
  if (!tournament) notFound();

  // Pull all COLLECTIVE missions and their submissions with team context.
  const missions = await prisma.tournamentMission.findMany({
    where: { tournamentId: params.id, isTeamSubmission: true },
    orderBy: { orderIndex: "asc" },
    include: {
      submissions: {
        include: {
          user: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  // For each submission, find the team via the captain's registration.
  const captainIds = missions.flatMap((m) => m.submissions.map((s) => s.userId));
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

  const flat = missions.flatMap((m) =>
    m.submissions.map((s) => ({
      submissionId: s.id,
      missionId: m.id,
      missionTitle: m.title,
      missionPoints: m.points,
      status: s.status,
      finalScore: s.finalScore,
      submittedAt: s.submittedAt,
      captain: s.user,
      team: teamByUser.get(s.userId) ?? null,
      payload: (s.payload ?? {}) as HackathonPayload,
    })),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/tournaments/${params.id}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {tournament.title}
      </Link>
      <header className="mt-4">
        <h1 className="h-display text-3xl font-bold sm:text-4xl">
          🎤 Showcase — {tournament.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {flat.length === 0
            ? "Chưa có đội nào nộp project."
            : `${flat.length} project từ ${new Set(flat.map((f) => f.team?.id).filter(Boolean)).size} đội — click vào artifact để xem.`}
        </p>
      </header>

      {flat.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-token py-16 text-center">
          <div className="text-4xl">🚧</div>
          <p className="mt-3 font-medium">Chờ các đội nộp project</p>
          <p className="mt-1 text-sm text-muted">
            Showcase sẽ tự động cập nhật khi có submission mới.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {flat.map((f) => {
            const team = f.team;
            const hasAnyLink = !!(
              f.payload.repoUrl ||
              f.payload.slidesUrl ||
              f.payload.demoVideoUrl
            );
            return (
              <article
                key={f.submissionId}
                className="flex flex-col overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">
                    {f.missionTitle}
                  </p>
                  <h2 className="mt-1 text-xl font-bold leading-tight">
                    {team?.name ?? "Solo"}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs opacity-90">
                    <Crown size={12} />
                    {f.captain.displayName}
                    {team && (
                      <span className="opacity-70">
                        · {team.registrations.length} thành viên
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex-1 p-4">
                  {f.payload.writeup && (
                    <p className="line-clamp-4 text-sm text-[rgb(var(--text-muted))]">
                      {f.payload.writeup}
                    </p>
                  )}
                  {!f.payload.writeup && !hasAnyLink && f.payload.artifactMarkdown && (
                    <p className="line-clamp-4 text-sm text-[rgb(var(--text-muted))]">
                      {f.payload.artifactMarkdown.slice(0, 200)}
                    </p>
                  )}

                  {hasAnyLink && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {f.payload.repoUrl && (
                        <a
                          href={f.payload.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40"
                        >
                          <Github size={12} />
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
                      {f.payload.demoVideoUrl && (
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
                  )}
                </div>

                <footer className="flex items-center justify-between gap-2 border-t border-token bg-[rgb(var(--surface-muted))/0.5] px-4 py-2 text-[11px]">
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
                      ? "✓ Đã chấm đạt"
                      : f.status === "failed"
                        ? "Chưa đạt"
                        : "Chờ chấm"}
                  </span>
                  <span className="text-faint">
                    {new Date(f.submittedAt).toLocaleDateString("vi-VN")}
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

// Lint helper — FileText reserved for future writeup-only card link.
void FileText;
