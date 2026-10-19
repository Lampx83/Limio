import type { ReactNode } from "react";

/** LANG L3 — khung chung của các trang Limio Language: tiêu đề, mô tả ngắn, nút hành động. */
export default function PageFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1">{title}</h1>
          {description && <p className="text-meta mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="mt-6 space-y-6">{children}</div>
    </main>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: "default" | "warn";
}) {
  const body = (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-token bg-[rgb(var(--surface))]"}`}>
      <div className="text-meta">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-caption mt-1 text-muted">{hint}</div>}
    </div>
  );
  return href ? (
    <a href={href} className="block transition-shadow hover:shadow-md">
      {body}
    </a>
  ) : (
    body
  );
}
