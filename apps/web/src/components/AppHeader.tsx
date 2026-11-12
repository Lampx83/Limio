import TournamentCta from "./TournamentCta";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { getRegisterEnabled } from "@/lib/site-settings";
import UserMenu from "./UserMenu";
import StudentMenuTrigger from "./StudentMenuTrigger";
import NotificationBell from "./NotificationBell";
import HeaderCalendar from "./HeaderCalendar";
import { getUnreadCount, getLastSeenIso, type Role } from "@/lib/notifications";
import { getActiveRole, switchableRoles } from "@/lib/active-role";
import { LimeSliceIcon } from "./BrandIcons";
import type { SpaceBrand } from "@/lib/space/types";
import HeaderTagline from "./HeaderTagline";
import { isLearnerRole } from "@/lib/learnerRole";

// Header render trên MỌI trang — cache isAnyOrgAdmin 60s/userId để không query
// OrganizationAdmin mỗi request, cùng cách admin/layout.tsx cache isAdmin.
const getIsAnyOrgAdminCached = unstable_cache(
  async (userId: string) => isAnyOrgAdmin(userId),
  ["header-is-any-org-admin"],
  { revalidate: 60, tags: ["user-roles"] },
);

export default async function AppHeader({ space = null }: { space?: SpaceBrand | null } = {}) {
  const session = await auth();
  const user = session?.user;
  const roles = switchableRoles(user?.roles ?? []);
  const activeRole = getActiveRole(roles);
  // Chỉ cần cho nhánh guest bên dưới — bỏ qua query khi đã đăng nhập.
  const registerEnabled = user ? true : await getRegisterEnabled();
  // /language/* có menu học viên cho người đã đăng nhập bằng vai học viên (khách chỉ thấy trang giới thiệu).
  const languagePages = !!user?.id && isLearnerRole(activeRole);

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
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 short:py-1">
        <div className="flex items-center gap-2 shrink-0">
        <StudentMenuTrigger variant="header" languagePages={languagePages} />
        {space ? (
          // Trang thuộc một space (trường/dự án): logo của space thay logo Limio, bấm về trang chủ space.
          <Link
            href={space.homeHref}
            aria-label={space.name}
            className="flex shrink-0 items-center gap-3 rounded bg-white px-2 py-1"
          >
            {space.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={space.logoUrl} alt={space.logoAlt} className="h-8 w-auto max-w-[200px] sm:h-10 sm:max-w-none" />
            )}
            {space.logoUrl && space.partnerLogoUrl && <span className="h-8 w-px bg-[#B2B2B2] sm:h-10" aria-hidden />}
            {space.partnerLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={space.partnerLogoUrl} alt={space.partnerLogoAlt} className="h-9 w-auto sm:h-11" />
            )}
            {!space.logoUrl && !space.partnerLogoUrl && (
              <span className="text-xl font-bold tracking-tight">{space.name}</span>
            )}
          </Link>
        ) : (
        <Link href="/" className="group flex items-baseline gap-2 shrink-0">
          <LimeSliceIcon className="h-11 w-11 shrink-0 self-center short:h-8 short:w-8 transition-transform group-hover:scale-105 group-hover:rotate-12" />
          <span className="text-3xl font-bold tracking-tight short:text-2xl">
            Lim<span className="text-pink-500">io</span>
          </span>
          <HeaderTagline activeRole={activeRole} roles={roles} guest={!user} />
        </Link>
        )}
        </div>

        <div className="flex items-center gap-2">
          {/* Nút Đấu trường: ẩn khi đang thi (xem TournamentCta). */}
          <TournamentCta activeRole={activeRole} />

          {/* Nút quét QR của học viên đang ẩn (ScanQrButton); bật lại bằng cách render nó ở đây. */}
          {user && activeRole === "instructor" && <HeaderCalendar />}
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
