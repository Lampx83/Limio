"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
import { useEffect, useRef, useState } from "react";
import RoleSwitcher from "./RoleSwitcher";
import { useEffectiveRole } from "./useEffectiveRole";

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  learner:    { label: "Học viên",   className: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
  instructor: { label: "Giảng viên", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  admin:      { label: "Quản trị",   className: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  mentor:     { label: "Mentor",     className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

export default function UserMenu({
  name,
  email,
  avatarUrl,
  roles,
  activeRole: cookieRole,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  roles?: string[];
  activeRole?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeRole = useEffectiveRole(cookieRole, roles);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = name
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ""))
    .filter((p) => p.length > 0)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  const close = () => setOpen(false);
  const activeBadge = activeRole ? ROLE_BADGES[activeRole] : undefined;

  const smallAvatar = avatarUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={avatarUrl}
      alt=""
      className="h-7 w-7 rounded-full object-cover shadow-sm"
    />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-sm">
      {initials || "?"}
    </span>
  );

  const largeAvatar = avatarUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={avatarUrl}
      alt=""
      className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm"
    />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-sm">
      {initials || "?"}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-token bg-[rgb(var(--surface))] py-1 pl-1 pr-3 text-sm transition-shadow hover:shadow-card"
        aria-label="Tài khoản"
      >
        {smallAvatar}
        <span className="hidden font-medium sm:inline">{name}</span>
        <span className="text-faint" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] shadow-card-hover animate-fade-in-up">
          {/* Profile header */}
          <div className="flex items-center gap-3 border-b border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
            {largeAvatar}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{name}</p>
              <p className="truncate text-xs text-muted">{email}</p>
              {activeBadge && (
                <span className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${activeBadge.className}`}>
                  {activeBadge.label}
                </span>
              )}
            </div>
          </div>

          {/* Account links */}
          <div className="py-1">
            <Item href="/me/dashboard" onClick={close}>Tổng quan của tôi</Item>
            <Item href="/me/settings" onClick={close}>Cài đặt tài khoản</Item>
          </div>

          {/* Role switcher */}
          {roles && roles.length > 1 && activeRole && (
            <div className="border-t border-token px-4">
              <RoleSwitcher roles={roles} activeRole={activeRole} variant="switch" />
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: `${BASE}/` })}
            className="block w-full border-t border-token px-4 py-2.5 text-left text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 dark:hover:bg-danger-950/30"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function Item({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
    >
      {children}
    </Link>
  );
}
