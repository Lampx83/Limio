import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import RightMenu from "./RightMenu";
import { getActiveRole } from "@/lib/active-role";
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
    ? (
        await prisma.user.findUnique({
          where: { id: user.id },
          select: { avatarUrl: true },
        })
      )?.avatarUrl ?? null
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-token bg-[rgb(var(--surface)/0.85)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface)/0.7)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="group flex items-baseline gap-2.5 shrink-0">
          <LimeSliceIcon className="h-9 w-9 shrink-0 self-center transition-transform group-hover:scale-105 group-hover:rotate-12" />
          <span className="text-lg font-bold tracking-tight">
            Lim<span className="text-pink-500">io</span>
          </span>
          <span className="hidden text-sm font-medium italic text-muted sm:inline">
            — Learn your way
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
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
          <RightMenu roles={roles} activeRole={activeRole} isLoggedIn={!!user} />
        </div>
      </div>
    </header>
  );
}
