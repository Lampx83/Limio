"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Award,
  Star,
  Settings,
  Compass,
  Trophy,
  BarChart3,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";

export const STUDENT_MENU_TOGGLE_EVENT = "fbm:student-menu:toggle";

type Item = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type Group = {
  id: string;
  label: string;
  items: Item[];
};

const GROUPS: Group[] = [
  {
    id: "learning",
    label: "Học tập",
    items: [
      { label: "Khoá học của tôi", href: "/me/enrollments", icon: BookOpen },
      { label: "Kỹ năng", href: "/me/skills", icon: Brain },
      { label: "Huy hiệu", href: "/me/badges", icon: Award },
    ],
  },
  {
    id: "feedback",
    label: "Phản hồi",
    items: [
      { label: "Đánh giá của tôi", href: "/me/reviews", icon: Star },
    ],
  },
  {
    id: "explore",
    label: "Khám phá",
    items: [
      { label: "Catalog khoá học", href: "/catalog", icon: Compass },
      { label: "Tournament", href: "/tournaments", icon: Trophy },
      { label: "Bảng xếp hạng", href: "/leaderboard", icon: BarChart3 },
    ],
  },
  {
    id: "account",
    label: "Tài khoản",
    items: [
      { label: "Cài đặt", href: "/me/settings", icon: Settings },
    ],
  },
];

const LS_KEY = "fbm-student-menu-collapsed";

export default function StudentLeftMenu({
  desktopSidebar = true,
}: {
  desktopSidebar?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = () => setDrawerOpen((v) => !v);
    window.addEventListener(STUDENT_MENU_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(STUDENT_MENU_TOGGLE_EVENT, handler);
  }, []);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/me/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const nav = (
    <nav className="flex flex-col gap-1 py-5">
      <div className="mb-3 px-4">
        <Link
          href="/me/dashboard"
          aria-current={isActive("/me/dashboard") ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
            isActive("/me/dashboard")
              ? "border-emerald-300 bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-sm dark:border-emerald-700/60 dark:from-emerald-950/50 dark:to-emerald-950/20"
              : "border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:from-emerald-100 hover:to-emerald-50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-emerald-950/10 dark:hover:from-emerald-950/50"
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
            <LayoutDashboard size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Workspace
            </div>
            <div className="truncate text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Học viên
            </div>
          </div>
        </Link>
      </div>

      {GROUPS.map((g, idx) => {
        const isCollapsed = !!collapsed[g.id];
        return (
          <div key={g.id} className="px-3">
            {idx > 0 && <div className="mx-1 my-2 h-px bg-token" />}
            <button
              type="button"
              onClick={() => toggle(g.id)}
              className="group flex w-full items-center gap-2 px-1 pt-3 pb-1.5 text-left"
            >
              <span className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-400">
                {g.label}
              </span>
              <ChevronRight
                size={12}
                className={`text-brand-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              />
            </button>
            {!isCollapsed && (
              <ul className="mt-1 space-y-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  return (
                    <li key={it.label}>
                      <Link
                        href={it.href}
                        className={`group/item relative flex items-center gap-2.5 rounded-lg pl-3 pr-2 py-2 text-sm transition-colors ${
                          active
                            ? "bg-emerald-50 font-semibold text-emerald-700 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                        }`}
                      >
                        {active && (
                          <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-emerald-500" />
                        )}
                        <Icon
                          size={16}
                          className={`shrink-0 ${active ? "text-emerald-600 dark:text-emerald-300" : ""}`}
                          strokeWidth={active ? 2.5 : 2}
                        />
                        <span className="flex-1 truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {drawerOpen && (
        <div
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm ${desktopSidebar ? "lg:hidden" : ""}`}
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Đóng menu"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))]"
            >
              <X size={16} />
            </button>
            {nav}
          </aside>
        </div>
      )}

      {desktopSidebar && (
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] lg:block">
          {nav}
        </aside>
      )}
    </>
  );
}
