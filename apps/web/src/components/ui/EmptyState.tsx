import type { ReactNode } from "react";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
}

interface EmptyStateProps {
  icon?: ReactNode | string;
  title: string;
  description?: ReactNode;
  actions?: EmptyStateAction[];
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actions,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed border-token bg-[rgb(var(--surface-muted))] px-6 py-12 text-center ${className}`}
      role="status"
    >
      {icon !== undefined && (
        <div className="text-5xl mb-3" aria-hidden>
          {icon}
        </div>
      )}
      <p className="text-h4 mb-2">{title}</p>
      {description && (
        <div className="text-meta max-w-md mx-auto">{description}</div>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions.map((a, i) => {
            const cls = `btn-${a.variant ?? (i === 0 ? "primary" : "secondary")}`;
            return a.href ? (
              <a key={i} href={a.href} className={cls}>
                {a.label}
              </a>
            ) : (
              <button key={i} onClick={a.onClick} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
