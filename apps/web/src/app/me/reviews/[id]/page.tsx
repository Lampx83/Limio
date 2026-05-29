import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import ReviewForm from "./ReviewForm";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type RubricCriterion = { id: string; label: string; scale: "1-5" | "pass_fail"; weight: number };

export default async function ReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?next=/me/reviews/${params.id}`);

  const ra = await prisma.missionReviewAssignment.findUnique({
    where: { id: params.id },
    include: {
      submission: {
        include: {
          mission: {
            select: { title: true, rubric: true, tournament: { select: { id: true, title: true } } },
          },
        },
      },
    },
  });
  if (!ra) notFound();
  if (ra.reviewerId !== userId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 text-sm text-muted">
        Bạn không có quyền xem review này.
      </main>
    );
  }

  const rubric = (ra.submission.mission.rubric ?? []) as RubricCriterion[];
  const payload = ra.submission.payload as { artifactMarkdown?: string; url?: string } | null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <Link href="/me/reviews" className="link text-sm">← Hàng đợi review</Link>
      <h1 className="mt-3 h-display text-2xl font-bold">
        {ra.submission.mission.title}
      </h1>
      <p className="mt-1 text-xs text-faint">
        {ra.submission.mission.tournament.title} · Hạn:{" "}
        {formatDateTime(ra.dueAt)}
      </p>

      {/* Anonymized submission */}
      <section className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-5">
        <h2 className="text-sm font-semibold text-muted">Bài nộp (ẩn danh)</h2>
        {payload?.artifactMarkdown && (
          <pre className="mt-3 whitespace-pre-wrap text-sm">{payload.artifactMarkdown}</pre>
        )}
        {payload?.url && (
          <p className="mt-3 text-sm">
            <a href={payload.url} target="_blank" rel="noopener noreferrer" className="link">
              {payload.url}
            </a>
          </p>
        )}
      </section>

      {/* Review form */}
      <section className="mt-6">
        {ra.completedAt ? (
          <div className="banner-success">
            <p className="font-medium">Bạn đã chấm bài này.</p>
            <p className="mt-1 text-sm">
              XP sẽ award khi review window đóng và so sánh với median.
            </p>
          </div>
        ) : (
          <ReviewForm reviewAssignmentId={ra.id} rubric={rubric} />
        )}
      </section>
    </main>
  );
}
