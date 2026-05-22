"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Network,
  Plug,
  Wrench,
  Mail,
  Settings,
  History,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  iconBg: string;
  iconFg: string;
};

const NAV: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    iconBg: "bg-indigo-100",
    iconFg: "text-indigo-600",
  },
  {
    href: "/admin/users",
    label: "Người dùng",
    Icon: Users,
    iconBg: "bg-pink-100",
    iconFg: "text-pink-600",
  },
  {
    href: "/admin/skills",
    label: "Skill taxonomy",
    Icon: Network,
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-600",
  },
  {
    href: "/admin/integrations",
    label: "Integrations",
    Icon: Plug,
    iconBg: "bg-purple-100",
    iconFg: "text-purple-600",
  },
  {
    href: "/admin/lti-tools",
    label: "LTI tools",
    Icon: Wrench,
    iconBg: "bg-sky-100",
    iconFg: "text-sky-600",
  },
  {
    href: "/admin/emails",
    label: "Email templates",
    Icon: Mail,
    iconBg: "bg-orange-100",
    iconFg: "text-orange-600",
  },
  {
    href: "/admin/settings",
    label: "Cài đặt",
    Icon: Settings,
    iconBg: "bg-blue-100",
    iconFg: "text-blue-600",
  },
  {
    href: "/admin/changelog",
    label: "Changelog",
    Icon: History,
    iconBg: "bg-amber-100",
    iconFg: "text-amber-700",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-20">
        <h2 className="px-2 pb-4 text-xl font-medium tracking-tight">
          <span className="font-semibold">Quản</span>{" "}
          <span className="text-muted">trị hệ thống</span>
        </h2>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon, iconBg, iconFg }) => {
            const active =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={
                  "group flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-sm transition-colors " +
                  (active
                    ? "bg-white text-fg shadow-sm ring-1 ring-base-200"
                    : "text-fg hover:bg-base-100")
                }
              >
                <span
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
                    iconBg
                  }
                >
                  <Icon className={"h-4.5 w-4.5 " + iconFg} size={18} />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
