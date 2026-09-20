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
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <span>🏁</span> Arena
              </p>
              <h1 className="mt-4 text-5xl font-black leading-none sm:text-6xl">
                Đấu trường
                <span className="ml-3 inline-block animate-bounce">🏆</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg font-medium text-white/95">
                Tham gia đấu trường — hoàn thành nhiệm vụ, leo bảng xếp hạng,
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
                    ⏳ {upcomingCount} sắp bắt đầu
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
            aria-label="Bộ lọc đấu trường"
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
// Card — nền sáng, thanh accent trên đầu, số liệu gọn một hàng.
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
    teamSize: number;
    course: { title: string; slug: string } | null;
    _count: { registrations: number; missions: number };
  };
  isRegistered: boolean;
}) {
  const isActive = t.status === "active";
  const isUpcoming = t.status === "published";
  const isEnded = t.status === "ended";
  const isTeam = t.teamSize > 1;

  // Thanh accent trên đầu thẻ: solo = ấm (rose/cam), đội = lạnh (indigo/sky).
  const accent = isEnded
    ? "from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-700"
    : isTeam
      ? "from-indigo-500 to-sky-400"
      : isActive
        ? "from-rose-500 to-orange-400"
        : "from-amber-400 to-yellow-300";

  return (
    <li className="group">
      <Link
        href={`/tournaments/${t.id}`}
        className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} aria-hidden />

        <div className="flex flex-1 flex-col p-5">
          {/* Trạng thái + loại */}
          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                </span>
                Đang diễn ra
              </span>
            ) : isUpcoming ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60">
                Sắp mở
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                Đã kết thúc
              </span>
            )}
            <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-[11px] font-medium text-muted">
              {isTeam ? `Đội ${t.teamSize}` : "Cá nhân"}
            </span>
            {isRegistered && (
              <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
                Đã ghi danh
              </span>
            )}
          </div>

          {/* Tiêu đề + phạm vi */}
          <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900 transition-colors group-hover:text-rose-600 dark:text-white dark:group-hover:text-orange-400">
            {t.title}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {t.course ? t.course.title : "Toàn nền tảng"}
          </p>

          {/* Đếm ngược */}
          {(isActive || isUpcoming) && (
            <p
              className={`mt-4 text-sm font-semibold ${
                isActive
                  ? "text-rose-600 dark:text-rose-300"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {isActive ? (
                <>Còn <Countdown to={t.endsAt} endedText="đã kết thúc" /></>
              ) : (
                <>Khởi tranh sau <Countdown to={t.startsAt} endedText="đã mở" /></>
              )}
            </p>
          )}

          {/* Số liệu */}
          <dl className="mt-4 grid grid-cols-3 divide-x divide-[rgb(var(--border))] rounded-xl bg-[rgb(var(--surface-muted))] py-2.5 text-center">
            <Stat value={t._count.registrations} label="người chơi" />
            <Stat value={t._count.missions} label="nhiệm vụ" />
            <Stat
              value={t.prizeXp > 0 ? `${t.prizeXp}` : "—"}
              label="XP thưởng"
              highlight={t.prizeXp > 0}
            />
          </dl>

          {/* Chân thẻ */}
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <p className="text-[11px] leading-relaxed text-muted">
              <DateTime value={t.startsAt} format="datetime" />
              <br />→ <DateTime value={t.endsAt} format="datetime" />
            </p>
            <span className="shrink-0 text-sm font-semibold text-rose-600 transition-transform group-hover:translate-x-0.5 dark:text-orange-400">
              {isEnded ? "Xem kết quả" : isRegistered ? "Tiếp tục" : "Tham gia"} →
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-2">
      <dd
        className={`text-base font-bold ${
          highlight ? "text-amber-600 dark:text-amber-300" : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {highlight ? "💎 " : ""}
        {value}
      </dd>
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state — dramatic, not just a chip + "no tournaments".
// ─────────────────────────────────────────────────────────────────────

function EmptyArena({ tab }: { tab: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-orange-300 bg-gradient-to-br from-white via-amber-50 to-rose-50 p-12 text-center dark:border-orange-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div className="text-7xl">{tab === "mine" ? "🎟️" : "🏟️"}</div>
      <h2 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
        {tab === "mine"
          ? "Bạn chưa tham gia đấu trường nào"
          : "Đấu trường đang im ắng"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {tab === "mine"
          ? "Đăng ký đấu trường đang mở để leo bảng xếp hạng và giành XP."
          : "Đấu trường mới sẽ xuất hiện ở đây ngay khi giảng viên mở. Quay lại sau nhé."}
      </p>
      {tab === "mine" && (
        <Link
          href="/tournaments"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-105"
        >
          Xem đấu trường đang mở →
        </Link>
      )}
    </div>
  );
}
