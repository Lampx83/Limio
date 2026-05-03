"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribe, type Toast } from "@/lib/toast";

const VARIANT_STYLES: Record<
  Toast["variant"],
  { container: string; icon: string; iconBg: string }
> = {
  success: {
    container: "border-success-200 bg-success-50 text-success-700",
    icon: "✓",
    iconBg: "bg-success-500 text-white",
  },
  error: {
    container: "border-danger-100 bg-danger-50 text-danger-700",
    icon: "✕",
    iconBg: "bg-danger-500 text-white",
  },
  info: {
    container: "border-brand-200 bg-brand-soft text-brand-700",
    icon: "ℹ",
    iconBg: "bg-brand-600 text-white",
  },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Thông báo"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-card-hover backdrop-blur animate-fade-in-up ${style.container}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style.iconBg}`}
              aria-hidden
            >
              {style.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{t.message}</p>
              {t.description && (
                <p className="mt-0.5 text-xs opacity-80">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded-md text-current opacity-50 transition-opacity hover:opacity-100"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
