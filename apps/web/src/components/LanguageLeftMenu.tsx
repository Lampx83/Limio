"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Coins,
  FlaskConical,
  Home,
  Languages,
  Layers,
  Brain,
  Dumbbell,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSidebarNav } from "./useSidebarNav";
import { STUDENT_MENU_TOGGLE_EVENT } from "./StudentLeftMenu";
import { apiUrl } from "@/lib/apiUrl";
import { appModeSwitchPath } from "@/lib/appMode";
import {
  isLanguageMenuActive,
  languageMenuGroups,
  type LanguageIconKey,
  type LanguageMenuRole,
} from "@/lib/languageMenu";

const ICONS: Record<LanguageIconKey, LucideIcon> = {
  home: Home,
  courses: BookOpen,
  exams: FlaskConical,
  review: ClipboardCheck,
  coins: Coins,
  practice: Dumbbell,
  skills: Brain,
  cards: Layers,
};

const LS_KEY = "fbm-language-menu-collapsed";

/**
 * LANG L2 — menu trái của vỏ Limio Language (giảng viên và học viên dùng chung bộ khung, khác nội dung).
 * Cùng hành vi với StudentLeftMenu: ngăn kéo dưới `lg` (mở bằng nút ở header qua sự kiện chung), thanh bên từ
 * `lg`, mục vừa bấm sáng ngay. Nút "Về Limio" đổi chế độ và giữ nguyên trang nếu trang đó có ở cả hai vỏ.
 */
export default function LanguageLeftMenu({
  role,
  desktopSidebar = true,
  badges = {},
}: {
  role: LanguageMenuRole;
  desktopSidebar?: boolean;
  badges?: Record<string, { count: number }>;
}) {
  const { pathname, collapsed, toggle, pendingHref, linkProps } = useSidebarNav(LS_KEY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = pendingHref ?? pathname;
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    const handler = () => setDrawerOpen((v) => !v);
    window.addEventListener(STUDENT_MENU_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(STUDENT_MENU_TOGGLE_EVENT, handler);
  }, []);

  // Trang /language/* chỉ có ở vỏ này → về trang chủ; trang dùng chung giữ nguyên.
  const sameOnBoth = !(pathname === "/language" || pathname.startsWith("/language/"));
  const switchHref = apiUrl(appModeSwitchPath("default", sameOnBoth ? pathname : "/"));

  const nav = (
    <nav aria-label="Limio Language" className="flex flex-col gap-1 py-5">
      <div className="mb-3 px-4">
        <Link
          href="/language"
          {...linkProps("/language", closeDrawer)}
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-3 py-2.5 transition-colors hover:from-emerald-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
            <Languages size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">
              {role === "teacher" ? "Giảng viên" : "Học viên"}
            </div>
            <div className="truncate text-sm font-semibold text-emerald-900">Limio Language</div>
          </div>
        </Link>
      </div>

      {languageMenuGroups(role).map((group, idx) => {
        const isCollapsed = !!collapsed[group.id];
        return (
          <div key={group.id} className="px-3">
            {idx > 0 && <div className="mx-1 my-2 h-px bg-token" />}
            <button type="button" onClick={() => toggle(group.id)} className="flex w-full items-center gap-2 px-1 pt-3 pb-1.5 text-left">
              <span className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700">{group.label}</span>
              <ChevronRight size={12} className={`text-brand-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
            </button>
            {!isCollapsed && (
              <ul className="mt-1 space-y-0.5">
                {group.items.map((it) => {
                  const active = isLanguageMenuActive(it.href, current);
                  const Icon = ICONS[it.icon];
                  const badge = badges[it.href];
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        {...linkProps(it.href, closeDrawer)}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-2 text-sm transition-colors ${
                          active
                            ? "bg-emerald-50 font-semibold text-emerald-700 shadow-sm"
                            : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                        }`}
                      >
                        {active && <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-emerald-500" />}
                        <Icon size={16} className={`shrink-0 ${active ? "text-emerald-600" : ""}`} strokeWidth={active ? 2.5 : 2} />
                        <span className="flex-1 truncate">{it.label}</span>
                        {badge && badge.count > 0 && (
                          <span
                            className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white"
                            aria-label={`${badge.count} mục cần xử lý`}
                          >
                            {badge.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      <div className="mx-4 mt-4 border-t border-token pt-3">
        <a
          href={switchHref}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
        >
          <ArrowLeftRight size={16} aria-hidden />
          Về Limio
        </a>
      </div>
    </nav>
  );

  return (
    <>
      {drawerOpen && (
        <div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm ${desktopSidebar ? "lg:hidden" : ""}`} onClick={() => setDrawerOpen(false)}>
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
