"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users,
  Network,
  Plug,
  Wrench,
  Mail,
  Settings,
  History,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

type Item = {
  label: string;
  href?: string;
  icon: LucideIcon;
  note?: string;
};

type Group = {
  id: string;
  label: string;
  items: Item[];
  /** Tailwind classes for icon circle bg + fg. Áp dụng cho mọi item trong nhóm để menu không bị "rainbow". */
  iconBg: string;
  iconFg: string;
};

// Admin palette = pink (limio brand pink) — phân biệt rõ với Instructor (amber).
const PINK_BG = "bg-pink-100 dark:bg-pink-950/40";
const PINK_FG = "text-pink-600 dark:text-pink-300";

const GROUPS: Group[] = [
  {
    id: "users",
    label: "Người dùng & Skill",
    iconBg: PINK_BG,
    iconFg: PINK_FG,
    items: [
      { label: "Người dùng", href: "/admin/users", icon: Users },
      { label: "Hoạt động giảng viên", href: "/admin/instructor-activity", icon: History },
      { label: "Skill taxonomy", href: "/admin/skills", icon: Network },
    ],
  },
  {
    id: "integrations",
    label: "Tích hợp",
    iconBg: PINK_BG,
    iconFg: PINK_FG,
    items: [
      { label: "Integrations", href: "/admin/integrations", icon: Plug },
      { label: "LTI tools", href: "/admin/lti-tools", icon: Wrench },
      { label: "Email templates", href: "/admin/emails", icon: Mail },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    iconBg: PINK_BG,
    iconFg: PINK_FG,
    items: [
      { label: "Cài đặt", href: "/admin/settings", icon: Settings },
      { label: "Changelog", href: "/admin/changelog", icon: History },
    ],
  },
];

const LS_KEY = "fbm-admin-menu-collapsed";

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/admin/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const nav = (
    <nav className="flex flex-col gap-1 py-5">
      {/* Workspace + Dashboard entry */}
      <div className="mb-3 px-4">
        <Link
          href="/admin/dashboard"
          aria-current={isActive("/admin/dashboard") ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
            isActive("/admin/dashboard")
              ? "border-pink-300 bg-gradient-to-br from-pink-100 to-pink-50 shadow-sm dark:border-pink-700/60 dark:from-pink-950/50 dark:to-pink-950/20"
              : "border-pink-200/60 bg-gradient-to-br from-pink-50 to-pink-100/50 hover:from-pink-100 hover:to-pink-50 dark:border-pink-900/40 dark:from-pink-950/30 dark:to-pink-950/10 dark:hover:from-pink-950/50"
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500 text-white shadow-sm">
            <ShieldCheck size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-pink-700 dark:text-pink-300">
              Workspace
            </div>
            <div className="truncate text-sm font-semibold text-pink-900 dark:text-pink-100">
              Quản trị hệ thống
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
              <span className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-pink-700 dark:text-pink-400">
                {g.label}
              </span>
              <ChevronRight
                size={12}
                className={`text-pink-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              />
            </button>
            {!isCollapsed && (
              <ul className="mt-1 space-y-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  const baseRow =
                    "group/item relative flex items-center gap-2.5 rounded-full pl-1.5 pr-3 py-1 text-sm transition-colors";
                  const iconCircle = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${g.iconBg}`;

                  if (!it.href) {
                    return (
                      <li key={it.label}>
                        <div
                          className={`${baseRow} cursor-not-allowed text-faint`}
                          title={it.note ?? "Đang phát triển"}
                          aria-disabled
                        >
                          <span className={iconCircle + " opacity-50"}>
                            <Icon size={14} className={g.iconFg} />
                          </span>
                          <span className="flex-1 truncate">{it.label}</span>
                          <span
                            className="shrink-0 rounded-full bg-pink-100/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-pink-700 dark:bg-pink-950/40 dark:text-pink-300"
                            title={it.note ?? "Đang phát triển"}
                          >
                            Soon
                          </span>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={it.label}>
                      <Link
                        href={it.href}
                        className={`${baseRow} ${
                          active
                            ? "bg-pink-50 font-semibold text-pink-700 shadow-sm dark:bg-pink-950/40 dark:text-pink-200"
                            : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                        }`}
                      >
                        {active && (
                          <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-pink-500" />
                        )}
                        <span className={iconCircle}>
                          <Icon
                            size={14}
                            className={g.iconFg}
                            strokeWidth={active ? 2.5 : 2}
                          />
                        </span>
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
      {/* Floating menu toggle — mobile only. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Mở menu quản trị"
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-transform hover:scale-105 lg:hidden"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Drawer — mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] lg:block">
        {nav}
      </aside>
    </>
  );
}
