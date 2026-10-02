import Link from "next/link";
import { Suspense } from "react";
import { prisma, type Prisma } from "@feedbackme/db";
import UserAvatar from "@/components/ui/UserAvatar";
import EmptyState from "@/components/ui/EmptyState";
import {
  formatDateTime,
  formatDayKey,
  formatRelative,
  formatTime,
  toDayKey,
} from "@/lib/datetime";
import ActivityFilters from "./ActivityFilters";
import {
  CATEGORIES,
  categoryOf,
  describeAction,
  isCategoryId,
  type CategoryId,
} from "./activity";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 3600 * 1000;
const DEFAULT_RANGE = "30";
const PAGE_SIZE = 100;
const MAX_LIMIT = 500;

type SearchParams = {
  instructor?: string;
  cat?: string;
  range?: string;
  limit?: string;
};

function categoryWhere(cat: CategoryId): Prisma.AuditLogWhereInput {
  if (cat === "other") {
    const all = CATEGORIES.flatMap((c) => c.prefixes);
    return { NOT: { OR: all.map((p) => ({ action: { startsWith: p } })) } };
  }
  const c = CATEGORIES.find((x) => x.id === cat)!;
  return { OR: c.prefixes.map((p) => ({ action: { startsWith: p } })) };
}

function Stat({
  label,
  value,
  sub,
  tone,
  small,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone: string;
  small?: boolean;
}) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
      <div
        className={`h-display font-bold tabular-nums leading-tight ${tone} ${
          small ? "text-base sm:text-2xl" : "text-xl sm:text-2xl"
        }`}
      >
        {value}
      </div>
      <p className="mt-1 text-xs leading-snug text-muted">{label}</p>
      {sub && <p className="mt-0.5 hidden text-[11px] text-faint sm:block">{sub}</p>}
    </div>
  );
}

export default async function InstructorActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Mọi tài khoản có quyền giảng viên (mọi scope).
  const roleRows = await prisma.userRole.findMany({
    where: { role: { name: "instructor" } },
    select: {
      userId: true,
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });
  const instructorMap = new Map(roleRows.map((r) => [r.userId, r.user]));
  const instructors = [...instructorMap.values()];
  const instructorIds = instructors.map((i) => i.id);

  const filterId =
    searchParams.instructor && instructorMap.has(searchParams.instructor)
      ? searchParams.instructor
      : null;
  const cat = isCategoryId(searchParams.cat) ? searchParams.cat : null;
  const range = searchParams.range === "7" || searchParams.range === "all" ? searchParams.range : DEFAULT_RANGE;
  const since = range === "all" ? null : new Date(Date.now() - Number(range) * DAY_MS);
  const limit = Math.min(MAX_LIMIT, Math.max(PAGE_SIZE, Number(searchParams.limit) || PAGE_SIZE));

  // Điều kiện chung cho số liệu tổng quan + xếp hạng (không theo giảng viên đang chọn,
  // để chọn một người không làm mất bức tranh của cả nhóm).
  const scope: Prisma.AuditLogWhereInput = {
    actorUserId: { in: instructorIds },
    ...(since ? { occurredAt: { gte: since } } : {}),
    ...(cat ? categoryWhere(cat) : {}),
  };

  const [grouped, latest, rows] = instructorIds.length
    ? await Promise.all([
        prisma.auditLog.groupBy({
          by: ["actorUserId"],
          where: scope,
          _count: { _all: true },
        }),
        prisma.auditLog.aggregate({ where: scope, _max: { occurredAt: true } }),
        prisma.auditLog.findMany({
          where: { AND: [scope, filterId ? { actorUserId: filterId } : {}] },
          orderBy: { occurredAt: "desc" },
          take: limit + 1,
          include: {
            actor: { select: { displayName: true, email: true, avatarUrl: true } },
            target: { select: { displayName: true, email: true } },
          },
        }),
      ])
    : [[], { _max: { occurredAt: null } }, []];

  const hasMore = rows.length > limit;
  const logs = hasMore ? rows.slice(0, limit) : rows;

  const countBy = new Map<string, number>();
  for (const g of grouped) if (g.actorUserId) countBy.set(g.actorUserId, g._count._all);
  const totalActions = [...countBy.values()].reduce((a, b) => a + b, 0);
  const activeCount = countBy.size;
  const ranking = [...countBy.entries()]
    .map(([id, n]) => ({ id, n, user: instructorMap.get(id)! }))
    .filter((r) => r.user)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const maxN = ranking[0]?.n ?? 1;

  const options = instructors
    .map((i) => ({
      id: i.id,
      label: i.displayName || i.email,
      count: countBy.get(i.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));

  // Giữ nguyên bộ lọc khi bấm link trong trang.
  function href(over: Partial<SearchParams>): string {
    const q = new URLSearchParams();
    const merged = { instructor: filterId ?? undefined, cat: cat ?? undefined, range: range !== DEFAULT_RANGE ? range : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/admin/instructor-activity?${s}` : "/admin/instructor-activity";
  }

  // Nhóm theo ngày (giờ Việt Nam).
  const todayKey = toDayKey(new Date());
  const yesterdayKey = toDayKey(Date.now() - DAY_MS);
  const days: { key: string; items: typeof logs }[] = [];
  for (const l of logs) {
    const key = toDayKey(l.occurredAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(l);
    else days.push({ key, items: [l] });
  }
  const dayLabel = (k: string) =>
    k === todayKey ? "Hôm nay" : k === yesterdayKey ? "Hôm qua" : formatDayKey(k);

  const rangeLabel = range === "all" ? "toàn thời gian" : `${range} ngày qua`;
  const filteredName = filterId
    ? (instructorMap.get(filterId)?.displayName || instructorMap.get(filterId)?.email)
    : null;

  return (
    <main>
      <header>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
          Quản trị
        </span>
        <h1 className="mt-3 h-display text-2xl font-bold sm:text-3xl">Hoạt động giảng viên</h1>
        <p className="mt-1 text-sm text-muted">
          Nhật ký thao tác của các tài khoản có quyền giảng viên: tạo và xuất bản khoá,
          đổi quyền, can thiệp kỳ thi.
        </p>
      </header>

      {/* Tổng quan: một dải 3 số, gọn cả trên mobile */}
      <section
        className="card mt-6 grid grid-cols-3 divide-x divide-token !p-0"
        aria-label="Tổng quan"
      >
        <Stat
          label={`Hành động · ${rangeLabel}`}
          value={totalActions.toLocaleString("vi-VN")}
          tone="text-brand-600"
        />
        <Stat
          label="Giảng viên có hoạt động"
          value={
            <>
              {activeCount}
              <span className="text-sm font-medium text-faint"> / {instructors.length}</span>
            </>
          }
          tone="text-sky-600"
        />
        <Stat
          label="Gần nhất"
          value={latest._max.occurredAt ? formatRelative(latest._max.occurredAt) : "—"}
          sub={latest._max.occurredAt ? formatDateTime(latest._max.occurredAt) : undefined}
          tone="text-accent-600"
          small
        />
      </section>

      <div className="mt-6">
        <Suspense fallback={<div className="h-9" />}>
          <ActivityFilters
            instructors={options}
            categories={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            defaultRange={DEFAULT_RANGE}
          />
        </Suspense>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {/* Dòng thời gian */}
        <section className="card" aria-label="Dòng thời gian hoạt động">
          {filteredName && (
            <p className="mb-3 text-sm text-muted">
              Đang xem riêng <span className="font-semibold text-[rgb(var(--text))]">{filteredName}</span>
            </p>
          )}
          {logs.length === 0 ? (
            <EmptyState
              title={
                instructors.length === 0
                  ? "Chưa có tài khoản giảng viên nào"
                  : "Không có hoạt động nào khớp bộ lọc"
              }
              description={
                instructors.length === 0
                  ? undefined
                  : "Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc."
              }
              actions={
                instructors.length > 0 && (filterId || cat || range !== DEFAULT_RANGE)
                  ? [{ label: "Xoá lọc", href: "/admin/instructor-activity", variant: "secondary" }]
                  : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {days.map((d) => (
                <div key={d.key}>
                  <h2 className="mb-1 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
                    {dayLabel(d.key)}
                    <span className="font-normal normal-case tracking-normal">
                      {d.items.length} hành động
                    </span>
                  </h2>
                  <ul className="divide-y divide-token">
                    {d.items.map((l) => {
                      const c = categoryOf(l.action);
                      const Icon = c.icon;
                      const actorName = l.actor?.displayName || l.actor?.email || "—";
                      const targetName = l.target?.displayName || l.target?.email || null;
                      const { label, detail } = describeAction(l.action, l.payload, targetName);
                      return (
                        <li key={l.id} className="flex items-start gap-3 py-3">
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.tone}`}
                            title={c.label}
                          >
                            <Icon size={15} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug">
                              <span className="font-semibold">{actorName}</span>{" "}
                              <span className="text-muted" title={l.action}>
                                {label.charAt(0).toLowerCase() + label.slice(1)}
                              </span>
                            </p>
                            {detail && (
                              <p className="mt-0.5 truncate text-sm text-muted" title={detail}>
                                {detail}
                              </p>
                            )}
                          </div>
                          <time
                            dateTime={l.occurredAt.toISOString()}
                            title={formatDateTime(l.occurredAt)}
                            className="shrink-0 pt-0.5 text-xs tabular-nums text-faint"
                          >
                            {formatTime(l.occurredAt, { hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {hasMore && (
                <div className="text-center">
                  <Link
                    href={href({ limit: String(Math.min(MAX_LIMIT, limit + PAGE_SIZE)) })}
                    className="btn-secondary btn-sm"
                    prefetch={false}
                  >
                    Xem thêm
                  </Link>
                </div>
              )}
              {!hasMore && limit >= MAX_LIMIT && (
                <p className="text-center text-xs text-faint">
                  Đã hiện {MAX_LIMIT} hành động gần nhất. Thu hẹp bộ lọc để xem cụ thể hơn.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Ai hoạt động nhiều nhất — bấm để xem riêng người đó */}
        {ranking.length > 0 && (
          <aside className="card lg:sticky lg:top-20" aria-label="Giảng viên hoạt động nhiều nhất">
            <h2 className="text-sm font-semibold">Hoạt động nhiều nhất</h2>
            <p className="mt-0.5 text-xs text-faint">{rangeLabel}</p>
            <ul className="mt-3 space-y-1">
              {ranking.map((r) => {
                const name = r.user.displayName || r.user.email;
                const selected = filterId === r.id;
                return (
                  <li key={r.id}>
                    <Link
                      href={href({ instructor: selected ? undefined : r.id, limit: undefined })}
                      prefetch={false}
                      aria-current={selected ? "true" : undefined}
                      className={`block rounded-lg px-2 py-1.5 transition-colors ${
                        selected
                          ? "bg-brand-50"
                          : "hover:bg-[rgb(var(--surface-muted))]"
                      }`}
                      title={r.user.email}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar name={name} imageUrl={r.user.avatarUrl} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                        <span className="text-xs font-semibold tabular-nums text-muted">{r.n}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(4, Math.round((r.n / maxN) * 100))}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}
