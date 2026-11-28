"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, pathInTab, type AdminSectionId } from "./adminNav";

/** Thanh tab ở đầu các trang cùng một khu của menu admin. Mỗi tab là một trang riêng nên dữ liệu chỉ tải khi mở. */
export default function AdminSectionTabs({ section }: { section: AdminSectionId }) {
  const pathname = usePathname();
  const { label, tabs } = ADMIN_SECTIONS[section];
  return (
    <nav
      aria-label={label}
      className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-token px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((t) => {
        const active = pathInTab(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-600 text-brand-700 dark:text-brand-300"
                : "border-transparent text-muted hover:border-[rgb(var(--border))] hover:text-[rgb(var(--text))]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
