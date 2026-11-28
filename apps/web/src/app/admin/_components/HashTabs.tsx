"use client";

import { useCallback, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";

export interface HashTab {
  id: string;
  label: string;
  /** Số nhỏ cạnh nhãn (vd số OrgAdmin). */
  badge?: string | number;
  /** Chấm cảnh báo: tab này có việc cần xử lý. */
  warn?: boolean;
  content: ReactNode;
}

/**
 * Chia một trang quản trị thành các tab. Mọi panel đều được dựng sẵn từ server và chỉ ẩn bằng `hidden`,
 * nên form đang gõ dở không mất khi đổi tab. Tab đang mở nằm ở `#hash` để gửi link đúng tab và nút "Quay lại" hoạt động.
 */
export default function HashTabs({
  tabs,
  defaultId,
  label = "Các mục",
}: {
  tabs: HashTab[];
  defaultId?: string;
  /** Nhãn của thanh tab cho trình đọc màn hình. */
  label?: string;
}) {
  const uid = useId();
  const first = defaultId ?? tabs[0]?.id;
  const [active, setActive] = useState(first);

  const fromHash = useCallback(() => {
    const h = window.location.hash.replace(/^#/, "");
    if (h && tabs.some((t) => t.id === h)) setActive(h);
  }, [tabs]);

  useEffect(() => {
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [fromHash]);

  function select(id: string) {
    setActive(id);
    // replaceState: đổi tab không làm đầy lịch sử trình duyệt.
    window.history.replaceState(null, "", `#${id}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    const target = tabs[next];
    if (!target) return;
    e.preventDefault();
    select(target.id);
    document.getElementById(`${uid}-tab-${target.id}`)?.focus();
  }

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label={label}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-token px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`${uid}-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${uid}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand-600 text-brand-700 dark:text-brand-300"
                  : "border-transparent text-muted hover:border-[rgb(var(--border))] hover:text-[rgb(var(--text))]"
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className="rounded-full bg-[rgb(var(--surface-muted))] px-1.5 text-xs tabular-nums text-muted">{t.badge}</span>
              )}
              {t.warn && (
                <span className="h-2 w-2 rounded-full bg-warning-500" aria-label="Cần xử lý" role="img" />
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${uid}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${t.id}`}
          hidden={t.id !== active}
          className="space-y-6 pt-5"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
