import Link from "next/link";
import { auth } from "@/lib/auth";
import UserMenu from "./UserMenu";

export default async function AppHeader() {
  const session = await auth();
  const user = session?.user;

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
            <Link
              href="/catalog"
              className="rounded-md px-3 py-1.5 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] transition-colors"
            >
              Catalog
            </Link>
            {user && (
              <>
                <Link
                  href="/me/enrollments"
                  className="rounded-md px-3 py-1.5 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] transition-colors"
                >
                  Khóa của tôi
                </Link>
                <Link
                  href="/me/skills"
                  className="rounded-md px-3 py-1.5 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] transition-colors"
                >
                  Skill
                </Link>
                <Link
                  href="/me/badges"
                  className="rounded-md px-3 py-1.5 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] transition-colors"
                >
                  Huy hiệu
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu name={user.name ?? "User"} email={user.email ?? ""} />
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
