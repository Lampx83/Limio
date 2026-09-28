"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar, Palette, Menu, X, Building2, type LucideIcon } from "lucide-react";

type Item = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// OrgAdmin palette = amber ("vàng cam") — phân biệt với Admin nền tảng (pink).
const ITEMS: Item[] = [
  { label: "Danh mục ca thi", href: "/org-admin/session-templates", icon: Calendar },
  { label: "Thương hiệu trường", href: "/org-admin/settings", icon: Palette },
];

export default function OrgAdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const nav = (
    <nav className="flex flex-col gap-1 py-5">
      {/* Workspace entry */}
      <div className="mb-3 px-4">
        <Link
          href="/org-admin/settings"
          className="flex items-center gap-2.5 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 px-3 py-2.5 transition-colors hover:from-amber-100 hover:to-amber-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-amber-950/10 dark:hover:from-amber-950/50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
            <Building2 size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Workspace
            </div>
            <div className="truncate text-sm font-semibold text-amber-900 dark:text-amber-100">
              Quản trị đơn vị
            </div>
          </div>
        </Link>
      </div>

      <div className="px-3">
        <ul className="mt-1 space-y-0.5">
          {ITEMS.map((it) => {
            const active = isActive(it.href);
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={`group/item relative flex items-center gap-2.5 rounded-full pl-1.5 pr-3 py-1 text-sm transition-colors ${
                    active
                      ? "bg-amber-50 font-semibold text-amber-700 shadow-sm dark:bg-amber-950/40 dark:text-amber-200"
                      : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                  }`}
                  prefetch={false}
                >
                  {active && (
                    <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-amber-500" />
                  )}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
                    <Icon
                      size={14}
                      className="text-amber-600 dark:text-amber-300"
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </span>
                  <span className="flex-1 truncate">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );

  return (
    <>
      {/* Floating menu toggle — mobile only. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Mở menu quản trị đơn vị"
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-105 lg:hidden"
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
