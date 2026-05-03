"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type RoleBadge = {
  label: string;
  className: string;
};

const ROLE_BADGES: Record<string, RoleBadge> = {
  learner: {
    label: "Học viên",
    className: "bg-brand-50 text-brand-700",
  },
  instructor: {
    label: "Giảng viên",
    className: "bg-amber-50 text-amber-700",
  },
  admin: {
    label: "Quản trị",
    className: "bg-rose-50 text-rose-700",
  },
  mentor: {
    label: "Mentor",
    className: "bg-emerald-50 text-emerald-700",
  },
};

export default function UserMenu({
  name,
  email,
  roles,
}: {
  name: string;
  email: string;
  roles: string[];
}) {
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

  const isInstructor = roles.includes("instructor");
  const isAdmin = roles.includes("admin");
  const close = () => setOpen(false);

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
        <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] shadow-card-hover animate-fade-in-up">
          <div className="border-b border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{email}</p>
            {roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {roles.map((role) => {
                  const badge = ROLE_BADGES[role];
                  if (!badge) return null;
                  return (
                    <span
                      key={role}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <Section label="Tài khoản">
            <MenuItem href="/me/dashboard" onClick={close}>
              Bảng điều khiển
            </MenuItem>
            <MenuItem href="/me/enrollments" onClick={close}>
              Khóa học của tôi
            </MenuItem>
            <MenuItem href="/me/skills" onClick={close}>
              Skill profile
            </MenuItem>
            <MenuItem href="/me/badges" onClick={close}>
              Huy hiệu
            </MenuItem>
            <MenuItem href="/me/settings" onClick={close}>
              Cài đặt tài khoản
            </MenuItem>
          </Section>

          {isInstructor && (
            <Section label="Giảng dạy" divider>
              <MenuItem href="/instructor/dashboard" onClick={close}>
                Tổng quan
              </MenuItem>
              <MenuItem href="/instructor/courses" onClick={close}>
                Khóa giảng dạy
              </MenuItem>
              <MenuItem href="/instructor/assignments" onClick={close}>
                Bài tập & chấm điểm
              </MenuItem>
              <MenuItem href="/instructor/tournaments" onClick={close}>
                Cuộc thi (Tournament)
              </MenuItem>
              <MenuItem href="/instructor/feedback-generator" onClick={close}>
                Tạo feedback AI
              </MenuItem>
              <MenuItem href="/instructor/feedback-templates" onClick={close}>
                Mẫu feedback
              </MenuItem>
            </Section>
          )}

          {isAdmin && (
            <Section label="Quản trị" divider>
              <MenuItem href="/admin/dashboard" onClick={close}>
                Tổng quan
              </MenuItem>
              <MenuItem href="/admin/lti-tools" onClick={close}>
                Tích hợp LTI
              </MenuItem>
              <MenuItem href="/admin/integrations" onClick={close}>
                Tích hợp & thanh toán
              </MenuItem>
            </Section>
          )}

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

function Section({
  label,
  children,
  divider,
}: {
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div className={divider ? "border-t border-token" : undefined}>
      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </p>
      <div className="pb-1">{children}</div>
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
