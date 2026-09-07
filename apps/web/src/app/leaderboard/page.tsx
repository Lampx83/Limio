import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  getLeaderboard,
  type BoardEntry,
  type Period,
  type Scope,
} from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import LeaderboardOptOutToggle from "./LeaderboardOptOutToggle";

export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Hôm nay",
  weekly: "Tuần này",
  monthly: "Tháng này",
  all_time: "Mọi thời",
};
const PERIODS: Period[] = ["daily", "weekly", "monthly", "all_time"];

function isPeriod(s: string | undefined): s is Period {
  return !!s && (PERIODS as string[]).includes(s);
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: { period?: string; scope?: string; courseId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/leaderboard");

  const period: Period = isPeriod(searchParams?.period) ? (searchParams!.period as Period) : "weekly";
  const scope: Scope = searchParams?.scope === "course" ? "course" : "global";
  const courseId = scope === "course" ? searchParams?.courseId ?? null : null;
  if (scope === "course" && !courseId) notFound();

  const course = courseId
    ? await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, slug: true, title: true },
      })
    : null;
  if (scope === "course" && !course) notFound();

  const board = await getLeaderboard({
    scope,
    period,
    courseId,
    viewerId: session.user.id,
    limit: 100,
  });

  const meInTop = board.entries.some((e) => e.isYou);
  const linkFor = (p: Period) => {
    const params = new URLSearchParams({ period: p });
    if (scope === "course" && courseId) {
      params.set("scope", "course");
      params.set("courseId", courseId);
    }
    return `/leaderboard?${params.toString()}`;
  };

  const top3 = board.entries.slice(0, 3);
  const rest = board.entries.slice(3);
  // Podium order: 2nd, 1st, 3rd
  const podium = [top3[1], top3[0], top3[2]];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 relative">
      {/* Decorative gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden">
        <div className="mx-auto h-64 max-w-3xl rounded-full bg-gradient-to-r from-amber-200/40 via-brand-200/40 to-accent-200/40 blur-3xl" />
      </div>

      {/* Hero */}
      <div className="text-center sm:text-left">
        <span className="chip-accent inline-flex items-center gap-1.5">
          <TrophyIcon className="h-3.5 w-3.5" /> Gamification
        </span>
        <h1 className="mt-3 h-display bg-gradient-to-r from-amber-500 via-orange-500 to-brand-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          {course ? `BXH — ${course.title}` : "Bảng xếp hạng"}
        </h1>
        <p className="mt-3 text-muted">
          {course ? (
            <>
              Xếp hạng trong khóa{" "}
              <Link href={`/learn/${course.slug}`} className="link">
                {course.title}
              </Link>
              .{" "}
              <Link href="/leaderboard" className="link">
                Xem BXH toàn nền tảng →
              </Link>
            </>
          ) : (
            <>Top học viên theo XP đạt được.</>
          )}
        </p>
      </div>

      {/* Period tabs */}
      <nav
        className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-token bg-[rgb(var(--surface-muted))] p-1"
        aria-label="Khoảng thời gian"
      >
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Link
              key={p}
              href={linkFor(p)}
              className={
                active
                  ? "rounded-full bg-gradient-to-r from-amber-500 to-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-md"
                  : "rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-brand-700"
              }
              aria-current={active ? "page" : undefined}
              prefetch={false}
            >
              {PERIOD_LABELS[p]}
            </Link>
          );
        })}
      </nav>

      <p className="mt-3 text-xs text-faint">
        Kỳ: <span className="font-mono">{board.periodKey}</span> · Tổng{" "}
        <span className="font-semibold text-brand-700">{board.totalParticipants}</span> người tham gia
      </p>

      {/* Opt-out toggle (inline, replaces trip to Settings) */}
      <LeaderboardOptOutToggle initialOptedOut={board.selfOptedOut} />

      {/* Self-rank banner when outside top */}
      {board.selfOptedOut ? null : board.me && !meInTop ? (
        <div className="mt-6 rounded-2xl border-2 border-brand-300 bg-gradient-to-r from-brand-50 to-amber-50 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-brand-700">🎯 Vị trí của bạn</span>
            <RankBadge rank={board.me.rank} delta={board.me.delta} xp={board.me.xp} highlight />
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {board.entries.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-token bg-gradient-to-b from-[rgb(var(--surface-muted))] to-transparent p-12 text-center">
          <div className="mx-auto mb-3 text-5xl">🏆</div>
          <p className="text-lg font-semibold text-strong">Chưa ai có XP trong {PERIOD_LABELS[period].toLowerCase()}</p>
          <p className="mt-1 text-sm text-muted">Hãy là người đầu tiên leo lên đỉnh bảng!</p>
        </div>
      ) : (
        <>
          {/* Podium top-3 */}
          {top3.length > 0 && (
            <section className="mt-8" aria-label="Top 3">
              <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
                {podium.map((entry, idx) => {
                  if (!entry) return <div key={idx} />;
                  return <PodiumCard key={entry.userId} entry={entry} position={entry.rank as 1 | 2 | 3} />;
                })}
              </div>
            </section>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Bảng xếp hạng</h2>
              <ul className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
                {rest.map((e) => (
                  <Row key={e.userId} entry={e} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M5 4h14v2h2a2 2 0 0 1 2 2v2a4 4 0 0 1-4 4h-.3a7 7 0 0 1-4.7 4.9V20h3v2H7v-2h3v-1.1A7 7 0 0 1 5.3 14H5a4 4 0 0 1-4-4V8a2 2 0 0 1 2-2h2V4Zm0 4H3v2a2 2 0 0 0 2 2V8Zm14 0v4a2 2 0 0 0 2-2V8h-2Z" />
    </svg>
  );
}

function PodiumCard({ entry, position }: { entry: BoardEntry; position: 1 | 2 | 3 }) {
  const style = {
    1: {
      height: "h-44 sm:h-52",
      gradient: "from-amber-300 via-yellow-400 to-amber-500",
      ring: "ring-amber-400",
      shadow: "shadow-[0_10px_40px_-10px_rgba(245,158,11,0.6)]",
      crown: "👑",
      medal: "🥇",
      badge: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
      order: "order-2",
      scale: "scale-100",
    },
    2: {
      height: "h-36 sm:h-40",
      gradient: "from-slate-200 via-slate-300 to-slate-400",
      ring: "ring-slate-300",
      shadow: "shadow-[0_8px_30px_-10px_rgba(100,116,139,0.5)]",
      crown: "",
      medal: "🥈",
      badge: "bg-gradient-to-br from-slate-400 to-slate-500 text-white",
      order: "order-1",
      scale: "scale-95",
    },
    3: {
      height: "h-32 sm:h-36",
      gradient: "from-amber-700/60 via-orange-700/60 to-amber-800/60",
      ring: "ring-orange-400",
      shadow: "shadow-[0_8px_30px_-10px_rgba(180,83,9,0.5)]",
      crown: "",
      medal: "🥉",
      badge: "bg-gradient-to-br from-orange-600 to-amber-700 text-white",
      order: "order-3",
      scale: "scale-90",
    },
  }[position];

  return (
    <div className={`flex flex-col items-center ${style.scale}`}>
      {/* Avatar + crown */}
      <div className="relative">
        {position === 1 && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl drop-shadow-md sm:text-4xl">
            {style.crown}
          </div>
        )}
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.avatarUrl}
            alt=""
            className={`h-16 w-16 rounded-full object-cover ring-4 ${style.ring} sm:h-20 sm:w-20 ${
              entry.isYou ? "ring-offset-2 ring-offset-brand-50" : ""
            }`}
          />
        ) : (
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-accent-100 text-2xl font-bold text-brand-700 ring-4 ${style.ring} sm:h-20 sm:w-20`}
          >
            {entry.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-bold ${style.badge}`}
        >
          #{position}
        </div>
      </div>

      {/* Name */}
      <div className="mt-4 max-w-full text-center">
        <p className="truncate text-sm font-bold text-strong sm:text-base">
          {entry.displayName}
          {entry.isYou && <span className="ml-1 text-brand-600">(Bạn)</span>}
        </p>
        <p className="text-xs text-muted">{entry.xp.toLocaleString("vi-VN")} XP</p>
      </div>

      {/* Podium block */}
      <div
        className={`mt-3 flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b ${style.gradient} ${style.height} ${style.shadow} pt-3`}
      >
        <span className="text-3xl drop-shadow sm:text-4xl">{style.medal}</span>
      </div>
    </div>
  );
}

function Row({ entry }: { entry: BoardEntry }) {
  const medal =
    entry.rank === 1 ? "" : entry.rank === 2 ? "" : entry.rank === 3 ? "" : null;
  return (
    <li
      className={
        entry.isYou
          ? "flex items-center gap-3 border-b border-token bg-brand-50 px-4 py-3 last:border-b-0"
          : "flex items-center gap-3 border-b border-token px-4 py-3 last:border-b-0 hover:bg-[rgb(var(--surface-muted))]"
      }
    >
      <span className="w-10 text-center font-mono text-sm font-semibold tabular-nums text-faint">
        {medal ?? `#${entry.rank}`}
      </span>
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.avatarUrl}
          alt=""
          className="h-9 w-9 rounded-full border border-token object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
          {entry.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="flex-1 truncate text-sm font-medium">
        {entry.displayName}
        {entry.isYou && <span className="ml-2 chip-brand text-xs">Bạn</span>}
      </span>
      <DeltaPill delta={entry.delta} />
      <span className="w-20 text-right font-mono text-sm font-semibold tabular-nums text-brand-700">
        {entry.xp.toLocaleString("vi-VN")} XP
      </span>
    </li>
  );
}

function RankBadge({
  rank,
  delta,
  xp,
  highlight,
}: {
  rank: number;
  delta: number | null;
  xp: number;
  highlight?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={
          highlight
            ? "font-mono text-base font-bold tabular-nums text-brand-700"
            : "font-mono text-sm font-semibold tabular-nums"
        }
      >
        #{rank}
      </span>
      <DeltaPill delta={delta} />
      <span className="font-mono text-sm font-semibold tabular-nums text-brand-700">
        {xp.toLocaleString("vi-VN")} XP
      </span>
    </span>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="w-10 text-right text-xs text-faint">✨</span>;
  }
  if (delta === 0) {
    return <span className="w-10 text-right text-xs text-faint">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={
        up
          ? "w-10 text-right text-xs font-semibold text-success-600"
          : "w-10 text-right text-xs font-semibold text-danger-600"
      }
      title={up ? `Tăng ${delta} bậc` : `Giảm ${-delta} bậc`}
    >
      {up ? `▲${delta}` : `▼${-delta}`}
    </span>
  );
}
