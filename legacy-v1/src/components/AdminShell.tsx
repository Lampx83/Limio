import Link from "next/link";
import Header from "./Header";
import type { HeaderProps } from "./Header";

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export default function AdminShell({
  title,
  fullName,
  role,
  badge,
  nav,
  children,
  pendingReviewCount,
}: {
  title: string;
  fullName: string;
  role: HeaderProps["role"];
  badge?: string;
  nav: NavItem[];
  children: React.ReactNode;
  pendingReviewCount?: number;
}) {
  return (
    <div className="min-h-screen">
      <Header
        title={title}
        fullName={fullName}
        role={role}
        badge={badge}
        pendingReviewCount={pendingReviewCount}
      />

      {/* Mobile horizontal scroll nav */}
      <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <nav className="flex gap-1 px-3 py-2 whitespace-nowrap">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-sm rounded-md ${
                item.active
                  ? "bg-brand-600 text-white"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 md:flex md:gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="sticky top-4 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${
                  item.active
                    ? "bg-brand-600 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 mt-1">
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  empty = "Chưa có dữ liệu.",
}: {
  columns: { key: string; header: string; render: (row: T) => React.ReactNode; className?: string }[];
  rows: T[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">{empty}</div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 text-xs uppercase font-medium text-slate-500 ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 align-top ${c.className ?? ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
