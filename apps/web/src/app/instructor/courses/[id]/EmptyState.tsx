"use client";

import { useId } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: string;
  title: string;
  description?: string;
  cta?: {
    label: string;
    /**
     * If set, dispatch a CustomEvent on window with this name when clicked.
     * Used to wire empty-state CTAs to LessonAddBar without lifting state.
     */
    eventName?: string;
    eventDetail?: unknown;
    onClick?: () => void;
  };
}) {
  const titleId = useId();
  return (
    <div
      role="region"
      aria-labelledby={titleId}
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-token bg-[rgb(var(--surface-muted))/0.4] px-4 py-6 text-center"
    >
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <p id={titleId} className="text-sm font-semibold text-default">
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-xs text-muted">{description}</p>
      )}
      {cta && (
        <button
          type="button"
          onClick={() => {
            cta.onClick?.();
            if (cta.eventName) {
              window.dispatchEvent(
                new CustomEvent(cta.eventName, { detail: cta.eventDetail }),
              );
            }
          }}
          className="btn-primary btn-sm mt-1"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
