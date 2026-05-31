import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import UserMenu from "./UserMenu";
import StudentMenuTrigger from "./StudentMenuTrigger";
import NotificationBell from "./NotificationBell";
import { getUnreadCount, getLastSeenIso, type Role } from "@/lib/notifications";
import { getActiveRole } from "@/lib/active-role";
import { getGlobalStreak } from "@feedbackme/core-gamification";
import { LimeSliceIcon } from "./BrandIcons";

export default async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  const roles = user?.roles ?? [];
  const activeRole = getActiveRole(roles);

  // Fetch avatar separately — JWT session doesn't refresh after upload, so
  // reading from DB on each request keeps the header always fresh. Cheap
  // single-row PK lookup on Postgres.
  const avatarUrl = user?.id
    ? await prisma.user
        .findUnique({ where: { id: user.id }, select: { avatarUrl: true } })
        .then((r) => r?.avatarUrl ?? null)
        .catch(() => null)
    : null;

  // Pre-fetch unread + last-seen for the *active role* so the bell renders
  // the right badge immediately and switching roles re-fetches via Next nav.
  const bellRole: Role =
    activeRole === "instructor" || activeRole === "admin" || activeRole === "mentor"
      ? activeRole
      : "learner";
  let notiUnread = 0;
  let notiLastSeen: string | null = null;
  let streakDays = 0;
  let longestStreak = 0;
  if (user?.id) {
    try {
      const [c, iso, streak] = await Promise.all([
        getUnreadCount(user.id, bellRole),
        getLastSeenIso(user.id, bellRole),
        getGlobalStreak(user.id),
      ]);
      notiUnread = c;
      notiLastSeen = iso;
      streakDays = streak.currentStreak;
      longestStreak = streak.longestStreak;
    } catch {}
  }

  return (
    <header className="sticky top-0 z-30 border-b border-token bg-[rgb(var(--surface)/0.85)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface)/0.7)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2 shrink-0">
        <StudentMenuTrigger variant="header" />
        <Link href="/" className="group flex items-baseline gap-2.5 shrink-0">
          <LimeSliceIcon className="h-9 w-9 shrink-0 self-center transition-transform group-hover:scale-105 group-hover:rotate-12" />
          <span className="text-lg font-bold tracking-tight">
            Lim<span className="text-pink-500">io</span>
          </span>
          <span className="hidden text-sm font-medium italic text-muted sm:inline">
            — Learn your way
          </span>
        </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Tournament CTA — always visible in header */}
          <Link
            href="/tournaments"
            className="relative hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-amber-300/50 transition-all hover:from-amber-500 hover:to-orange-600 hover:shadow-md hover:shadow-amber-300/60 hover:-translate-y-px dark:shadow-amber-900/40"
          >
            {/* Live pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            🏆 Đấu trường
          </Link>

          {user && streakDays > 0 && (
            <Link
              href="/me/dashboard"
              title={`Chuỗi học hiện tại: ${streakDays} ngày · Dài nhất: ${longestStreak} ngày`}
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-sm font-bold text-orange-600 ring-1 ring-orange-200 transition-colors hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/50"
              aria-label={`Chuỗi học ${streakDays} ngày`}
            >
              🔥 {streakDays}
            </Link>
          )}
          {user && (
            <NotificationBell
              initialUnread={notiUnread}
              initialLastSeen={notiLastSeen}
              role={bellRole}
            />
          )}
          {user ? (
            <UserMenu
              name={user.name ?? "User"}
              email={user.email ?? ""}
              avatarUrl={avatarUrl}
              roles={roles}
              activeRole={activeRole}
            />
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/signin" className="btn-ghost btn-sm">
                Đăng nhập
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
