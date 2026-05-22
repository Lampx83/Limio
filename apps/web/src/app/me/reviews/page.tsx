import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PeerReviewQueuePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?next=/me/reviews");

  const items = await prisma.missionReviewAssignment.findMany({
    where: { reviewerId: userId, completedAt: null },
    orderBy: { dueAt: "asc" },
    include: {
      submission: {
        include: {
          mission: {
            select: {
              id: true,
              title: true,
              tournament: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="h-display text-2xl font-bold sm:text-3xl">Hàng đợi review</h1>
      <p className="mt-1 text-sm text-muted">
        Bài bạn được phân công chấm. XP reviewer được award sau khi window đóng.
      </p>

      {items.length === 0 ? (
        <div className="card mt-6 text-center text-sm text-muted py-12">
          Chưa có bài nào cần chấm.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((ra) => {
            const due = new Date(ra.dueAt);
            const overdue = due < new Date();
            return (
              <li key={ra.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-faint">
                      {ra.submission.mission.tournament.title}
                    </p>
                    <p className="mt-0.5 font-medium">{ra.submission.mission.title}</p>
                    <p className={`mt-1 text-xs ${overdue ? "text-danger-600" : "text-muted"}`}>
                      Hạn chấm: {due.toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <Link href={`/me/reviews/${ra.id}`} className="btn-primary btn-sm shrink-0">
                    Chấm
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
