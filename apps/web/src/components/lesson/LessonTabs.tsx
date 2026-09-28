"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export type TabKey = "tasks" | "forum";

type Tab = {
  key: TabKey;
  label: string;
  icon: string;
  count?: number;
};

export default function LessonTabs({
  tabs,
  defaultTab,
  children,
}: {
  tabs: Tab[];
  defaultTab: TabKey;
  children: Partial<Record<TabKey, React.ReactNode>>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp.get("tab");
  const active: TabKey = useMemo(() => {
    if (raw && tabs.some((t) => t.key === raw)) return raw as TabKey;
    return defaultTab;
  }, [raw, tabs, defaultTab]);

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", key);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label="Hoạt động của bài học"
        className="-mx-2 flex gap-2 overflow-x-auto border-b border-token px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-base font-semibold transition-colors sm:text-lg ${
                isActive
                  ? "text-brand-700 dark:text-brand-300"
                  : "text-[rgb(var(--text))] hover:text-brand-600 dark:hover:text-brand-300"
              }`}
            >
              <span aria-hidden className="text-xl">
                {t.icon}
              </span>
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-bold ${
                    isActive
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-200"
                      : "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))]"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-6">
        {tabs.map((t) =>
          t.key === active ? (
            <div key={t.key} role="tabpanel">
              {children[t.key]}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
