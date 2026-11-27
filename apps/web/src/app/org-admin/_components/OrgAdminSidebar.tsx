"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { OrgKind } from "@feedbackme/core-lms";
import { Calendar, ClipboardCheck, GanttChart, GraduationCap, LayoutDashboard, Palette, Menu, X, Building2, Users, Mail, BarChart3, Ticket, Receipt, type LucideIcon } from "lucide-react";

type Item = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Đường dẫn khác cũng coi là đang ở mục này (trang lớp nằm ở khu giảng viên nhưng thuộc mục "Lớp và giáo viên"). */
  alsoActive?: RegExp;
};
type Group = { title: string | null; items: Item[]; /** Chỉ hiện khi người này quản trị tổ chức thuộc một trong các loại này; không đặt = mọi loại. */ kinds?: OrgKind[] };

// OrgAdmin palette = brand lime — màu thương hiệu chuẩn của nền tảng.
// Nhóm "Trung tâm" chỉ hiện khi người này quản trị một trường đã bật tính năng trung tâm; trường học thông thường không thấy
// các mục lịch lớp (trang của chúng cũng chỉ báo "Chưa bật tính năng trung tâm").
const GROUPS: Group[] = [
  {
    title: "Trung tâm",
    kinds: ["center"],
    items: [
      { label: "Tổng quan trung tâm", href: "/org-admin/tong-quan", icon: LayoutDashboard },
      { label: "Điều phối lịch", href: "/org-admin/dieu-phoi", icon: GanttChart },
      { label: "Đối chiếu lịch dạy", href: "/org-admin/doi-chieu", icon: ClipboardCheck },
    ],
  },
  {
    title: "Nhà xuất bản",
    kinds: ["publisher"],
    items: [
      { label: "Báo cáo nhà xuất bản", href: "/org-admin/bao-cao", icon: BarChart3 },
      { label: "Mã kích hoạt", href: "/org-admin/ma-kich-hoat", icon: Ticket },
      { label: "Đơn hàng và hoàn tiền", href: "/org-admin/don-hang", icon: Receipt },
    ],
  },
  {
    title: "Người",
    kinds: ["publisher"],
    items: [
      { label: "Thành viên trường", href: "/org-admin/members", icon: Users },
      { label: "Mẫu email", href: "/org-admin/emails", icon: Mail },
    ],
  },
  {
    title: "Người, lớp và thi cử",
    kinds: ["school", "center"],
    items: [
      { label: "Thành viên trường", href: "/org-admin/members", icon: Users },
      { label: "Lớp và giáo viên", href: "/org-admin/lop-hoc", icon: GraduationCap, alsoActive: /^\/instructor\/courses\/[^/]+\/sections(\/|$)/ },
      { label: "Danh mục ca thi", href: "/org-admin/session-templates", icon: Calendar },
      { label: "Mẫu email", href: "/org-admin/emails", icon: Mail },
    ],
  },
  {
    title: "Thiết lập",
    items: [{ label: "Thương hiệu & kỳ học", href: "/org-admin/settings", icon: Palette }],
  },
];

export default function OrgAdminSidebar({ kinds = [] }: { kinds?: OrgKind[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (it: Item) => pathname === it.href || pathname.startsWith(it.href + "/") || !!it.alsoActive?.test(pathname);
  // Người quản trị tổ chức khác loại thấy hợp các nhóm; một mục chỉ hiện một lần.
  const seen = new Set<string>();
  const groups = GROUPS.filter((g) => !g.kinds || g.kinds.some((k) => kinds.includes(k)))
    .map((g) => ({ ...g, items: g.items.filter((it) => (seen.has(it.href) ? false : (seen.add(it.href), true))) }))
    .filter((g) => g.items.length > 0);

  const nav = (
    <nav className="flex flex-col gap-1 py-5">
      {/* Workspace entry */}
      <div className="mb-3 px-4">
        <Link
          href="/org-admin"
          className="flex items-center gap-2.5 rounded-xl border border-brand-200/60 bg-gradient-to-br from-brand-50 to-brand-100/50 px-3 py-2.5 transition-colors hover:from-brand-100 hover:to-brand-50 dark:border-brand-900/40 dark:from-brand-950/30 dark:to-brand-950/10 dark:hover:from-brand-950/50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm">
            <Building2 size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">
              Workspace
            </div>
            <div className="truncate text-sm font-semibold text-brand-900 dark:text-brand-100">
              Quản trị đơn vị
            </div>
          </div>
        </Link>
      </div>

      {groups.map((g) => (
        <div key={g.title ?? "_"} className="px-3">
          {g.title && <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={`group/item relative flex items-center gap-2.5 rounded-full pl-1.5 pr-3 py-1 text-sm transition-colors ${
                      active
                        ? "bg-brand-50 font-semibold text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-200"
                        : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                    }`}
                    prefetch={false}
                  >
                    {active && <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-brand-500" />}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950/40">
                      <Icon size={14} className="text-brand-600 dark:text-brand-300" strokeWidth={active ? 2.5 : 2} />
                    </span>
                    <span className="flex-1 truncate">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Floating menu toggle — mobile only. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Mở menu quản trị đơn vị"
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:scale-105 lg:hidden"
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
