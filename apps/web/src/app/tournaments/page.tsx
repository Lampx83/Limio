import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_TONE: Record<string, string> = {
  published: "chip-accent",
  active: "chip-success",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Sắp diễn ra",
  active: "Đang diễn ra",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function TournamentsPage() {
  const session = await auth();

  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["published", "active"] } },
    orderBy: { startsAt: "asc" },
    include: {
      course: { select: { title: true, slug: true } },
      _count: { select: { registrations: true, missions: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-brand">Tournament</span>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
            Tournaments
          </h1>
          <p className="mt-2 text-muted">
            {tournaments.length > 0
              ? `${tournaments.length} tournament đang mở`
              : "Chưa có tournament nào đang mở."}
          </p>
        </div>

        {!session?.user?.id && (
          <Link href="/signin" className="btn-secondary btn-sm">
            Đăng nhập để đăng ký
          </Link>
        )}
      </div>

      {/* List */}
      {tournaments.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
            🏆
          </div>
          <p className="mt-4 text-muted">
            Chưa có tournament nào đang mở.
          </p>
          <p className="mt-1 text-sm text-faint">
            Hãy quay lại sau để xem tournament mới nhất.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link href={`/tournaments/${t.id}`} className="group block h-full">
                <div className="card-hover h-full">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-base font-semibold transition-colors group-hover:text-brand-600">
                      {t.title}
                    </span>
                    <span className={STATUS_TONE[t.status] ?? "chip"}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>

                  {/* Course */}
                  <p className="mt-1 text-xs text-faint">
                    {t.course ? t.course.title : "Platform-wide"}
                  </p>

                  {/* Date range */}
                  <p className="mt-2 text-xs text-muted">
                    {formatDate(t.startsAt)} → {formatDate(t.endsAt)}
                  </p>

                  {/* Stats */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{t._count.registrations} người tham gia</span>
                    <span>·</span>
                    <span>{t._count.missions} missions</span>
                    {t.prizeXp > 0 && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-accent-600">
                          {t.prizeXp} XP giải thưởng
                        </span>
                      </>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="mt-4 flex items-center justify-end border-t border-token pt-3">
                    <span className="text-sm font-medium text-brand-600 group-hover:text-brand-700">
                      Xem chi tiết →
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
