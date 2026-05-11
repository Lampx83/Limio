"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: Array<{ href: string; label: string; icon: string }> = [
  { href: "/admin/dashboard",  label: "Dashboard",    icon: "" },
  { href: "/admin/users",      label: "Người dùng",   icon: "" },
  { href: "/admin/integrations", label: "Integrations", icon: "" },
  { href: "/admin/lti-tools",  label: "LTI tools",    icon: "" },
  { href: "/admin/settings",   label: "Cài đặt",      icon: "" },
  { href: "/admin/changelog",  label: "Changelog",    icon: "📋" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-20">
        <div className="card p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            Quản trị
          </p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors " +
                    (active
                      ? "bg-brand-soft font-medium text-brand-700"
                      : "text-muted hover:bg-base-100 hover:text-fg")
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
