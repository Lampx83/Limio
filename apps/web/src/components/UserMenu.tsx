"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-token bg-[rgb(var(--surface))] py-1 pl-1 pr-3 text-sm transition-shadow hover:shadow-card"
        aria-label="Tài khoản"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-sm">
          {initials || "?"}
        </span>
        <span className="hidden font-medium sm:inline">{name}</span>
        <span className="text-faint" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] shadow-card-hover animate-fade-in-up">
          <div className="border-b border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="mt-0.5 truncate text-muted" style={{ fontSize: "0.75rem" }}>{email}</p>
          </div>
          <div className="py-1">
            <MenuItem href="/me/dashboard" onClick={() => setOpen(false)}>
              📊 Bảng điều khiển
            </MenuItem>
            <MenuItem href="/me/enrollments" onClick={() => setOpen(false)}>
              Khóa học của tôi
            </MenuItem>
            <MenuItem href="/me/skills" onClick={() => setOpen(false)}>
              Skill profile
            </MenuItem>
            <MenuItem href="/me/badges" onClick={() => setOpen(false)}>
              Huy hiệu
            </MenuItem>
            <MenuItem href="/instructor/dashboard" onClick={() => setOpen(false)}>
              📊 Instructor dashboard
            </MenuItem>
            <MenuItem href="/instructor/courses" onClick={() => setOpen(false)}>
              Khóa của tôi (instructor)
            </MenuItem>
            <MenuItem href="/admin/dashboard" onClick={() => setOpen(false)}>
              📊 Admin dashboard
            </MenuItem>
            <MenuItem href="/me/settings" onClick={() => setOpen(false)}>
              Cài đặt
            </MenuItem>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full border-t border-token px-4 py-2.5 text-left text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
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
      className="block px-4 py-2 text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
