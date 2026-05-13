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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div>
        <span className="chip-accent">Gamification</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {course ? `BXH — ${course.title}` : "Bảng xếp hạng"}
        </h1>
        <p className="mt-2 text-muted">
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
            <>
              Top học viên theo XP đạt được. Bạn có thể{" "}
              <Link href="/me/settings" className="link">
                ẩn mình khỏi bảng xếp hạng
              </Link>{" "}
              trong Cài đặt.
            </>
          )}
        </p>
      </div>

      {/* Period tabs */}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Khoảng thời gian">
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Link
              key={p}
              href={linkFor(p)}
              className={
                active
                  ? "rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-card"
                  : "rounded-full border border-token px-4 py-1.5 text-sm text-muted transition-colors hover:border-brand-200 hover:text-brand-700"
              }
              aria-current={active ? "page" : undefined}
            >
              {PERIOD_LABELS[p]}
            </Link>
          );
        })}
      </nav>

      <p className="mt-4 text-xs text-faint">
        Kỳ: <span className="font-mono">{board.periodKey}</span> · Tổng {board.totalParticipants} người tham gia
      </p>

      {/* Self-rank banner when outside top */}
      {board.selfOptedOut ? (
        <div className="mt-6 rounded-2xl border border-dashed border-token bg-[rgb(var(--surface-muted))] p-4 text-sm text-muted">
          Bạn đang ẩn khỏi bảng xếp hạng. Bật lại trong{" "}
          <Link href="/me/settings" className="link">Cài đặt</Link>.
        </div>
      ) : board.me && !meInTop ? (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-brand-700">Vị trí của bạn</span>
            <RankBadge rank={board.me.rank} delta={board.me.delta} xp={board.me.xp} highlight />
          </div>
        </div>
      ) : null}

      {/* Top-N table */}
      <section className="mt-6">
        {board.entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-token p-10 text-center text-muted">
            Chưa ai có XP trong {PERIOD_LABELS[period].toLowerCase()}. Hãy là người đầu tiên!
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-token">
            {board.entries.map((e) => (
              <Row key={e.userId} entry={e} />
            ))}
          </ul>
        )}
      </section>
    </main>
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
