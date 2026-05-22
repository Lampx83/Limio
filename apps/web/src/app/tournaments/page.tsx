import Link from "next/link";
import { prisma, Prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { DateTime, Countdown } from "@/components/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  published: "Sắp diễn ra",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

// Competitive theme — fiery gradient, bold typography, dramatic status badges.
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

  const activeCount = tournaments.filter((t) => t.status === "active").length;
  const upcomingCount = tournaments.filter((t) => t.status === "published").length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* ── HERO BANNER ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-orange-200/40 dark:border-orange-900/40">
        {/* Decorative gradient + radial */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-orange-500 to-amber-400 opacity-90" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,200,50,0.4) 0%, transparent 50%)",
          }}
        />
        {/* Diagonal stripes pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(255,255,255,0.5) 14px, rgba(255,255,255,0.5) 16px)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl text-white drop-shadow-md">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/25 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white backdrop-blur">
                <span>⚔️</span> Arena
              </p>
              <h1 className="mt-4 text-5xl font-black leading-none sm:text-6xl">
                Đấu trường
                <span className="ml-3 inline-block animate-bounce">🏆</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg font-medium text-white/95">
                Tham gia tournament — hoàn thành nhiệm vụ, leo bảng xếp hạng,
                giành XP & danh hiệu.
              </p>

              {/* Live counters */}
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
                {activeCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-700 px-3 py-1.5 text-white ring-2 ring-rose-300/60">
                    <span className="flex h-2 w-2 animate-ping rounded-full bg-white" />
                    {activeCount} đang diễn ra
                  </span>
                )}
                {upcomingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-3 py-1.5 text-amber-900 ring-2 ring-amber-100/60">
                    ⏳ {upcomingCount} sắp khởi tranh
                  </span>
                )}
                {tab === "mine" && myIdSet.size > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-rose-700 ring-2 ring-white/60">
                    🎯 Bạn đăng ký {myIdSet.size}
                  </span>
                )}
              </div>
            </div>

            {!userId && (
              <Link
                href="/signin"
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-rose-700 shadow-xl ring-1 ring-white/40 transition hover:scale-105 hover:bg-amber-50"
              >
                Đăng nhập để tham gia →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        {/* Tabs */}
        {userId && (
          <div
            role="tablist"
            aria-label="Bộ lọc tournament"
            className="mb-8 inline-flex rounded-full border-2 border-rose-300/40 bg-white p-1 shadow-md dark:border-rose-700/40 dark:bg-slate-800"
          >
            <Link
              role="tab"
              aria-selected={tab === "all"}
              href="/tournaments"
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                tab === "all"
                  ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md"
                  : "text-slate-600 hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-400"
              }`}
            >
              🌐 Tất cả
            </Link>
            <Link
              role="tab"
              aria-selected={tab === "mine"}
              href="/tournaments?tab=mine"
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                tab === "mine"
                  ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md"
                  : "text-slate-600 hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-400"
              }`}
            >
              🎯 Của tôi
              {myIdSet.size > 0 && (
                <span className="ml-2 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
                  {myIdSet.size}
                </span>
              )}
            </Link>
          </div>
        )}

        {/* List */}
        {tournaments.length === 0 ? (
          <EmptyArena tab={tab} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {tournaments.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                isRegistered={myIdSet.has(t.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card — fiery gradient border, live pulse, prize XP front and center.
// ─────────────────────────────────────────────────────────────────────

function TournamentCard({
  tournament: t,
  isRegistered,
}: {
  tournament: {
    id: string;
    title: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    prizeXp: number;
    course: { title: string; slug: string } | null;
    _count: { registrations: number; missions: number };
  };
  isRegistered: boolean;
}) {
  const isActive = t.status === "active";
  const isUpcoming = t.status === "published";
  const isEnded = t.status === "ended";

  const accent = isActive
    ? "from-rose-600 to-orange-500"
    : isUpcoming
      ? "from-amber-500 to-yellow-400"
      : "from-slate-500 to-slate-400";

  return (
    <li className="group relative">
      {/* Gradient border wrapper */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accent} opacity-60 blur transition-opacity group-hover:opacity-100`}
        aria-hidden
      />
      <Link
        href={`/tournaments/${t.id}`}
        className="relative block h-full overflow-hidden rounded-2xl border border-white/60 bg-white p-5 shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700/60 dark:bg-slate-800"
      >
        {/* Status ribbon */}
        <div className="flex items-start justify-between gap-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
              <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          ) : isUpcoming ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
              ⏳ Sắp mở
            </span>
          ) : (
            <span className="rounded-full bg-slate-300 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              Đã kết thúc
            </span>
          )}

          {isRegistered && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-300">
              ✓ Đã ghi danh
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="mt-3 text-xl font-black leading-tight text-slate-900 transition-colors group-hover:text-rose-600 dark:text-white dark:group-hover:text-orange-400">
          {t.title}
        </h2>

        {/* Course / scope */}
        <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {t.course ? `📚 ${t.course.title}` : "🌐 Toàn nền tảng"}
        </p>

        {/* Countdown */}
        {(isActive || isUpcoming) && (
          <div
            className={`mt-4 rounded-lg p-2.5 text-xs font-semibold ${
              isActive
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            }`}
          >
            {isActive ? (
              <>⏱ Còn <Countdown to={t.endsAt} endedText="đã kết thúc" /></>
            ) : (
              <>⏳ Khởi tranh sau <Countdown to={t.startsAt} endedText="đã mở" /></>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat icon="👥" value={t._count.registrations} label="đấu sĩ" />
          <Stat icon="⚔️" value={t._count.missions} label="missions" />
          <Stat
            icon="💎"
            value={t.prizeXp > 0 ? `${t.prizeXp}` : "—"}
            label="XP thưởng"
            highlight={t.prizeXp > 0}
          />
        </div>

        {/* Date range — small footer */}
        <p className="mt-4 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <DateTime value={t.startsAt} format="datetime" /> →{" "}
          <DateTime value={t.endsAt} format="datetime" />
        </p>

        {/* CTA */}
        <p className="mt-2 text-right text-sm font-bold text-rose-600 group-hover:text-rose-700 dark:text-orange-400 dark:group-hover:text-orange-300">
          {isEnded ? "Xem kết quả →" : isRegistered ? "Vào đấu →" : "Tham chiến →"}
        </p>
      </Link>
    </li>
  );
}

function Stat({
  icon,
  value,
  label,
  highlight,
}: {
  icon: string;
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2 py-1.5 ${
        highlight
          ? "bg-gradient-to-br from-amber-100 to-orange-100 ring-1 ring-amber-300 dark:from-amber-900/40 dark:to-orange-900/40 dark:ring-amber-700"
          : "bg-slate-50 dark:bg-slate-900/50"
      }`}
    >
      <p className="text-base">{icon}</p>
      <p
        className={`text-sm font-black ${
          highlight
            ? "text-amber-700 dark:text-amber-300"
            : "text-slate-700 dark:text-slate-200"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state — dramatic, not just a chip + "no tournaments".
// ─────────────────────────────────────────────────────────────────────

function EmptyArena({ tab }: { tab: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-orange-300 bg-gradient-to-br from-white via-amber-50 to-rose-50 p-12 text-center dark:border-orange-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div className="text-7xl">{tab === "mine" ? "🛡️" : "🏟️"}</div>
      <h2 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
        {tab === "mine"
          ? "Bạn chưa tham chiến tournament nào"
          : "Đấu trường đang im ắng"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {tab === "mine"
          ? "Đăng ký tournament đang mở để leo bảng xếp hạng và giành XP."
          : "Tournament mới sẽ xuất hiện ở đây ngay khi giảng viên mở. Quay lại sau nhé."}
      </p>
      {tab === "mine" && (
        <Link
          href="/tournaments"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-105"
        >
          Xem tournament đang mở →
        </Link>
      )}
    </div>
  );
}
