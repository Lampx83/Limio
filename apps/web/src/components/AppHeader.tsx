import Link from "next/link";
import { auth } from "@/lib/auth";
import { RoleName } from "@feedbackme/shared-types";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";

export default async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  const roles = user?.roles ?? [];
  const isInstructor = roles.includes(RoleName.Instructor);
  const isAdmin = roles.includes(RoleName.Admin);

  return (
    <header className="sticky top-0 z-30 border-b border-token bg-[rgb(var(--surface)/0.85)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface)/0.7)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white font-bold shadow-brand-glow transition-transform group-hover:scale-105">
              F
            </span>
            <span className="text-base font-semibold tracking-tight">
              Feed<span className="text-brand-600">Back</span>Me
            </span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <NavLink href="/catalog">Catalog</NavLink>
            {user && (
              <>
                {isInstructor && (
                  <NavLink href="/instructor/dashboard" accent="amber">
                    Giảng dạy
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink href="/admin/dashboard" accent="rose">
                    Quản trị
                  </NavLink>
                )}
                <NavLink href="/me/enrollments">Khóa của tôi</NavLink>
                {!isInstructor && !isAdmin && (
                  <NavLink href="/me/skills">Skill</NavLink>
                )}
                <NavLink href="/me/badges">Huy hiệu</NavLink>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <UserMenu
              name={user.name ?? "User"}
              email={user.email ?? ""}
              roles={roles}
            />
          ) : (
            <>
              <Link href="/signin" className="btn-ghost btn-sm">
                Đăng nhập
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  accent?: "amber" | "rose";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-700 hover:bg-amber-50"
      : accent === "rose"
        ? "text-rose-700 hover:bg-rose-50"
        : "text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]";
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 transition-colors ${accentClass}`}
    >
      {children}
    </Link>
  );
}
