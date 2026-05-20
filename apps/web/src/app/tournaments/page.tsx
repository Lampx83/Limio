import Link from "next/link";
import { prisma, Prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import {
  EmptyState,
  StatusBadge,
  DateTime,
  Countdown,
} from "@/components/ui";
import type { StatusTone } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_TONE: Record<string, StatusTone> = {
  published: "info",
  active: "success",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Sắp diễn ra",
  active: "Đang diễn ra",
};

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const tab = searchParams?.tab === "mine" && userId ? "mine" : "all";

  const myRegistrations = userId
    ? await prisma.tournamentRegistration.findMany({
        where: { userId },
        select: { tournamentId: true },
      })
    : [];
  const myIdSet = new Set(myRegistrations.map((r) => r.tournamentId));

  const where: Prisma.TournamentWhereInput =
    tab === "mine"
      ? { id: { in: Array.from(myIdSet) } }
      : { status: { in: ["published", "active"] } };

  const tournaments = await prisma.tournament.findMany({
    where,
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
          <h1 className="mt-3 h-display text-h1">Đấu trường</h1>
          <p className="mt-2 text-meta">
            {tab === "mine"
              ? `Bạn đã tham gia ${tournaments.length} tournament`
              : tournaments.length > 0
                ? `${tournaments.length} tournament đang mở`
                : "Chưa có tournament nào đang mở."}
          </p>
        </div>
        {!userId && (
          <Link href="/signin" className="btn-secondary btn-sm">
            Đăng nhập để đăng ký
          </Link>
        )}
      </div>

      {/* Tabs */}
      {userId && (
        <div
          role="tablist"
          aria-label="Bộ lọc tournament"
          className="mt-6 inline-flex rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-1"
        >
          <Link
            role="tab"
            aria-selected={tab === "all"}
            href="/tournaments"
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              tab === "all"
                ? "bg-brand-600 text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Tất cả
          </Link>
          <Link
            role="tab"
            aria-selected={tab === "mine"}
            href="/tournaments?tab=mine"
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              tab === "mine"
                ? "bg-brand-600 text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Của tôi
            {myIdSet.size > 0 && (
              <span className="ml-1.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
                {myIdSet.size}
              </span>
            )}
          </Link>
        </div>
      )}

      {/* List */}
      {tournaments.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon="🏆"
            title={
              tab === "mine"
                ? "Bạn chưa tham gia tournament nào"
                : "Chưa có tournament nào đang mở"
            }
            description={
              tab === "mine"
                ? "Đăng ký tournament đang mở để hoàn thành nhiệm vụ và nhận giải thưởng."
                : "Hãy quay lại sau để xem tournament mới nhất."
            }
            actions={
              tab === "mine"
                ? [{ label: "Xem tournament đang mở", href: "/tournaments" }]
                : undefined
            }
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => {
            const isRegistered = myIdSet.has(t.id);
            const tone = STATUS_TONE[t.status] ?? "neutral";
            const isActive = t.status === "active";
            return (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="card-hover group block h-full"
                  aria-label={`Tournament: ${t.title}`}
                >
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-snug transition-colors group-hover:text-brand-600">
                      {t.title}
                    </h2>
                    <StatusBadge tone={tone} pulse={isActive} className="shrink-0">
                      {STATUS_LABEL[t.status] ?? t.status}
                    </StatusBadge>
                  </div>

                  {/* Course / scope */}
                  {t.course ? (
                    <span className="chip-brand mt-2">{t.course.title}</span>
                  ) : (
                    <span className="chip mt-2">Toàn nền tảng</span>
                  )}

                  {/* Date range + countdown */}
                  <p className="mt-3 text-xs text-meta">
                    <DateTime value={t.startsAt} format="datetime" /> →{" "}
                    <DateTime value={t.endsAt} format="datetime" />
                  </p>
                  {t.status === "published" && (
                    <p className="mt-1 text-xs font-medium text-info-700">
                      <Countdown to={t.startsAt} endedText="Đã mở đăng ký" />
                    </p>
                  )}
                  {t.status === "active" && (
                    <p className="mt-1 text-xs font-medium text-success-700">
                      Còn <Countdown to={t.endsAt} endedText="đã kết thúc" /> để hoàn thành
                    </p>
                  )}

                  {/* Stats */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-meta">
                    <span>{t._count.registrations} người</span>
                    <span aria-hidden>·</span>
                    <span>{t._count.missions} missions</span>
                    {t.prizeXp > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-semibold text-accent-600">
                          {t.prizeXp} XP
                        </span>
                      </>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="mt-4 flex items-center justify-between border-t border-token pt-3">
                    {isRegistered ? (
                      <span className="chip-success">Đã đăng ký</span>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm font-semibold text-brand-600 group-hover:text-brand-700">
                      Xem chi tiết →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
