"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { BrandIcon } from "./BrandLogo";

export interface HeaderProps {
  title: string;
  fullName: string;
  role: "student" | "instructor" | "institution_admin" | "system_admin";
  badge?: string;
  pendingReviewCount?: number;
}

const roleLabel: Record<HeaderProps["role"], string> = {
  student: "Sinh viên",
  instructor: "Giảng viên",
  institution_admin: "Quản trị Cơ sở",
  system_admin: "Quản trị Hệ thống",
};

const ROLE_HOME: Record<HeaderProps["role"], string> = {
  student: "/student",
  instructor: "/instructor",
  institution_admin: "/institution-admin",
  system_admin: "/admin",
};

export default function Header({
  title,
  fullName,
  role,
  badge,
  pendingReviewCount,
}: HeaderProps) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="bg-white/70 backdrop-blur border-b border-orange-200/60 dark:bg-stone-900/70 dark:border-stone-800 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={ROLE_HOME[role]}
            className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-100 text-lg shrink-0"
          >
            <BrandIcon className="w-8 h-8 shrink-0" />
            <span>FeedBackMe</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-700 dark:text-slate-200 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          {pendingReviewCount && pendingReviewCount > 0 ? (
            <Link
              href="/instructor/submissions"
              title={`${pendingReviewCount} feedback chờ duyệt`}
              className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
              </span>
            </Link>
          ) : null}
          {badge && <span className="badge-blue">{badge}</span>}
          <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
            {roleLabel[role]}:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {fullName}
            </span>
          </span>
          <ThemeToggle />
          <button onClick={logout} className="btn-secondary text-xs py-1 px-2">
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
