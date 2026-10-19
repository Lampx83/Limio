import Link from "next/link";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin, userHasLanguageCourses } from "@feedbackme/core-lms";
import { getRegisterEnabled } from "@/lib/site-settings";
import UserMenu from "./UserMenu";
import StudentMenuTrigger from "./StudentMenuTrigger";
import NotificationBell from "./NotificationBell";
import ScanExamQrButton from "./ScanExamQrButton";
import { getUnreadCount, getLastSeenIso, type Role } from "@/lib/notifications";
import { getActiveRole, switchableRoles } from "@/lib/active-role";
import { LimeSliceIcon } from "./BrandIcons";
import HeaderTagline from "./HeaderTagline";
import { getAppMode } from "@/lib/appMode.server";

// Header render trên MỌI trang — cache isAnyOrgAdmin 60s/userId để không query
// OrganizationAdmin mỗi request, cùng cách admin/layout.tsx cache isAdmin.
const getIsAnyOrgAdminCached = unstable_cache(
  async (userId: string) => isAnyOrgAdmin(userId),
  ["header-is-any-org-admin"],
  { revalidate: 60, tags: ["user-roles"] },
);

// LANG L1.3 — có khoá ngoại ngữ nào (dạy/học) không: quyết định hiện lối "Limio Language" ở vỏ thường.
const getHasLanguageCoursesCached = unstable_cache(
  async (userId: string) => userHasLanguageCourses(userId),
  ["header-has-language-courses"],
  { revalidate: 60, tags: ["user-roles"] },
);

export default async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  // LANG L2.1 — vỏ Limio Language: đổi tên/tagline, bỏ lối tắt Đấu trường; mọi thứ khác (tài khoản, thông báo) giữ nguyên.
  const languageMode = getAppMode() === "language";
  const roles = switchableRoles(user?.roles ?? []);
  const activeRole = getActiveRole(roles);
  // Chỉ cần cho nhánh guest bên dưới — bỏ qua query khi đã đăng nhập.
  const registerEnabled = user ? true : await getRegisterEnabled();

  // Lối vào vỏ Limio Language (L1.3): giảng viên hoặc người có khoá ngoại ngữ; chỉ ở vỏ thường.
  const showLanguageEntry =
    !languageMode &&
    !!user?.id &&
    (roles.includes("instructor") || roles.includes("admin") || (await getHasLanguageCoursesCached(user.id).catch(() => false)));
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
  if (user?.id) {
    try {
      const [c, iso] = await Promise.all([
        getUnreadCount(user.id, bellRole),
        getLastSeenIso(user.id, bellRole),
      ]);
      notiUnread = c;
      notiLastSeen = iso;
    } catch {}
  }

  return (
    <header className="border-b border-token bg-[rgb(var(--surface)/0.85)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface)/0.7)]">
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 shrink-0">
        <StudentMenuTrigger variant="header" languageMode={languageMode} />
        <Link href={languageMode ? "/language" : "/"} className="group flex items-baseline gap-2 shrink-0">
          <LimeSliceIcon className="h-11 w-11 shrink-0 self-center transition-transform group-hover:scale-105 group-hover:rotate-12" />
          <span className="text-3xl font-bold tracking-tight">
            Lim<span className="text-pink-500">io</span>
          </span>
          {languageMode && (
            <span className="self-center rounded-md bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-800">Language</span>
          )}
          <HeaderTagline activeRole={activeRole} roles={roles} guest={!user} languageMode={languageMode} />
        </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Tournament CTA — always visible in header. Instructor đang active
              role đó thì đưa về khu quản lý tournament của họ thay vì trang
              tham gia dành cho học viên. */}
          {!languageMode && <Link
            href={activeRole === "instructor" ? "/instructor/tournaments" : "/tournaments"}
            className="relative hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-amber-300/50 transition-all hover:from-amber-500 hover:to-orange-600 hover:shadow-md hover:shadow-amber-300/60 hover:-translate-y-px dark:shadow-amber-900/40"
          >
            {/* Live pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            🏆 Đấu trường
          </Link>}

          {showLanguageEntry && (
            <a
              href={`${basePath}/api/app-mode?to=language`}
              className="hidden items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 sm:inline-flex"
            >
              Limio Language
            </a>
          )}
          {user && activeRole === "learner" && <ScanExamQrButton />}
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
              isResearcher={(user.roles ?? []).includes("researcher")}
              isOrgAdmin={user.id ? await getIsAnyOrgAdminCached(user.id).catch(() => false) : false}
            />
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link href="/signin" className="btn-primary btn-sm">
                Đăng nhập
              </Link>
              {registerEnabled && (
                <Link href="/register" className="btn-ghost btn-sm">
                  Đăng ký
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
