import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  Star,
  CheckCircle2,
  MessageSquare,
  Trophy,
  XCircle,
  Award,
  TrendingUp,
  ArrowUpRight,
  Inbox,
  PenLine,
  Eye,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getActiveRole } from "@/lib/active-role";
import { formatDate } from "@/lib/datetime";
import {
  getUserNotifications,
  markNotificationsSeen,
  getLastSeenIso,
  NOTIFICATION_TYPE_LABELS,
  type NotificationType,
  type Role,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const ICON: Record<string, { Icon: LucideIcon; cls: string }> = {
  review:          { Icon: Star,         cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  graded:          { Icon: CheckCircle2, cls: "bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300" },
  reply:           { Icon: MessageSquare,cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  mission_ok:      { Icon: Trophy,       cls: "bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300" },
  mission_fail:    { Icon: XCircle,      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  badge:           { Icon: Award,        cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  level_up:        { Icon: ArrowUpRight, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  rank:            { Icon: TrendingUp,   cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  inbox:           { Icon: Inbox,        cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  essay:           { Icon: PenLine,      cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  mission_review:  { Icon: Eye,          cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  question:        { Icon: HelpCircle,   cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
};

function relative(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} ngày trước`;
  return formatDate(d);
}

const LEARNER_TYPES: NotificationType[] = [
  "peer_review.assigned",
  "assignment.graded",
  "forum.reply",
  "mission.passed",
  "badge.earned",
  "level.up",
  "leaderboard.rank",
];

const INSTRUCTOR_TYPES: NotificationType[] = [
  "instructor.assignment.submitted",
  "instructor.essay.pending",
  "instructor.mission.review_needed",
  "instructor.forum.new_thread",
];

export default async function NotificationsPage({
  searchParams,
  forceRole,
}: {
  searchParams: { type?: string; role?: string };
  forceRole?: Role;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/me/notifications");
  const roles = (session?.user?.roles ?? []) as string[];

  // forceRole (when imported from /instructor/notifications) wins; else
  // ?role= query (rare); else the cookie-driven active role.
  const requestedRole = (forceRole ?? searchParams.role ?? getActiveRole(roles)) as string;
  const role: Role =
    requestedRole === "instructor" || requestedRole === "admin" || requestedRole === "mentor"
      ? requestedRole
      : "learner";

  const prevIso = await getLastSeenIso(userId, role);
  const prevSeenMs = prevIso ? new Date(prevIso).getTime() : 0;

  const all = await getUserNotifications(userId, role, 200);
  await markNotificationsSeen(userId, role);

  const activeType = (searchParams.type ?? "all") as NotificationType | "all";
  const filtered =
    activeType === "all" ? all : all.filter((n) => n.type === activeType);

  const counts: Record<string, number> = { all: all.length };
  for (const n of all) counts[n.type] = (counts[n.type] ?? 0) + 1;

  const typeOrder: (NotificationType | "all")[] = [
    "all",
    ...(role === "instructor" ? INSTRUCTOR_TYPES : LEARNER_TYPES),
  ];

  const basePath = role === "instructor" ? "/instructor/notifications" : "/me/notifications";
  const roleLabel = role === "instructor" ? "Giảng viên" : "Học viên";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
          <Bell size={18} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="h-display text-2xl font-bold">Thông báo</h1>
            <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-muted">
            {role === "instructor"
              ? "Việc cần xử lý trong khoá bạn dạy — chấm bài, review, câu hỏi mới."
              : "Cập nhật học tập — bài chấm, phản hồi forum, mission, huy hiệu."}
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {typeOrder.map((t) => {
          const label =
            t === "all" ? "Tất cả" : NOTIFICATION_TYPE_LABELS[t as NotificationType];
          const cnt = counts[t] ?? 0;
          const isActive = activeType === t;
          if (t !== "all" && cnt === 0) return null;
          const href = t === "all" ? basePath : `${basePath}?type=${t}`;
          return (
            <Link
              key={t}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "border border-token text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
              }`}
            >
              {label}
              {cnt > 0 && (
                <span
                  className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))]"
                  }`}
                >
                  {cnt}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-token py-16 text-center">
          <div className="text-4xl">🔕</div>
          <p className="mt-3 font-medium">
            {activeType === "all"
              ? "Chưa có thông báo nào"
              : `Không có thông báo loại "${NOTIFICATION_TYPE_LABELS[activeType as NotificationType]}"`}
          </p>
          <p className="mt-1 text-sm text-muted">
            Tin mới sẽ hiện ở đây khi có hoạt động liên quan.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {filtered.map((n) => {
            const ic = ICON[n.iconKey] ?? ICON.review!;
            const Icon = ic.Icon;
            const isNew = n.createdAt.getTime() > prevSeenMs;
            return (
              <li key={n.id}>
                <Link
                  href={n.link}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-sm ${
                    isNew
                      ? "border-brand-200 bg-brand-soft/40 dark:border-brand-800/60"
                      : "border-token bg-[rgb(var(--surface))]"
                  }`}
                  prefetch={false}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ic.cls}`}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-faint">
                      {relative(n.createdAt)} ·{" "}
                      <span className="text-[rgb(var(--text-muted))]">
                        {NOTIFICATION_TYPE_LABELS[n.type]}
                      </span>
                    </p>
                  </div>
                  {isNew && (
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                      title="Mới"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
