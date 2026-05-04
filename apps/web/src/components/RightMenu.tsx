"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string };

const NAV: Record<string, NavItem[]> = {
  guest: [
    { href: "/catalog", label: "Catalog" },
  ],
  learner: [
    { href: "/catalog", label: "Catalog" },
    { href: "/me/enrollments", label: "Khóa của tôi" },
    { href: "/tournaments", label: "🏆 Đấu trường thi đấu" },
    { href: "/me/skills", label: "Skill" },
    { href: "/me/badges", label: "Huy hiệu" },
    { href: "/me/dashboard", label: "Tổng quan" },
  ],
  instructor: [
    { href: "/catalog", label: "Catalog" },
    { href: "/instructor/courses", label: "Khoá học" },
    { href: "/instructor/assignments", label: "Bài tập" },
    { href: "/instructor/tournaments", label: "🏆 Đấu trường thi đấu" },
    { href: "/instructor/feedback-generator", label: "Feedback AI" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/users", label: "Người dùng" },
    { href: "/admin/settings", label: "Cài đặt" },
    { href: "/admin/integrations", label: "Tích hợp" },
  ],
};

const ROLE_STYLE = {
  learner: {
    label: "Học viên",
    badge: "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
    active: "bg-brand-50 text-brand-700 font-medium dark:bg-brand-950/40 dark:text-brand-300",
    hover: "hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]",
    dot: "bg-brand-500",
  },
  instructor: {
    label: "Giảng viên",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    active: "bg-amber-50 text-amber-700 font-medium dark:bg-amber-950/40 dark:text-amber-300",
    hover: "hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/20 dark:hover:text-amber-300",
    dot: "bg-amber-500",
  },
  admin: {
    label: "Quản trị",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    active: "bg-rose-50 text-rose-700 font-medium dark:bg-rose-950/40 dark:text-rose-300",
    hover: "hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/20 dark:hover:text-rose-300",
    dot: "bg-rose-500",
  },
  mentor: {
    label: "Mentor",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    active: "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-300",
    hover: "hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-300",
    dot: "bg-emerald-500",
  },
} as const;

export default function RightMenu({
  roles,
  activeRole,
  isLoggedIn,
}: {
  roles: string[];
  activeRole: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const navKey = !isLoggedIn ? "guest" : (activeRole in NAV ? activeRole : "learner");
  const items = NAV[navKey] ?? [];
  const style = ROLE_STYLE[activeRole as keyof typeof ROLE_STYLE] ?? ROLE_STYLE.learner;

  const close = () => setOpen(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
      >
        <HamburgerIcon />
      </button>

      {/* Backdrop */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-token bg-[rgb(var(--surface))] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-token px-4 py-3">
          {isLoggedIn ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
              {style.label}
            </span>
          ) : (
            <span className="text-sm font-semibold">Menu</span>
          )}
          <button
            onClick={close}
            aria-label="Đóng menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive ? style.active : `text-muted ${style.hover}`
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition-opacity ${
                        isActive ? style.dot : "opacity-0"
                      }`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Guest sign-in prompt */}
        {!isLoggedIn && (
          <div className="border-t border-token p-4 space-y-2">
            <Link
              href="/signin"
              onClick={close}
              className="btn-primary btn-sm block w-full text-center"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              onClick={close}
              className="btn-ghost btn-sm block w-full text-center"
            >
              Đăng ký
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="2.5" y1="5" x2="15.5" y2="5" />
      <line x1="2.5" y1="9" x2="15.5" y2="9" />
      <line x1="2.5" y1="13" x2="15.5" y2="13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}
