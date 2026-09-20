"use client";

import { SHOWCASE_MODES, type ShowcaseMode } from "@feedbackme/core-gamification";

// Khi nào người ngoài đội xem được bài nộp của các đội (trang showcase) và bình chọn.
export default function ShowcaseModePicker({
  value,
  onChange,
}: {
  value: ShowcaseMode;
  onChange: (v: ShowcaseMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Khi nào xem được bài của các đội" className="space-y-2">
      <p className="text-sm font-medium">Khi nào xem được bài của các đội</p>
      {SHOWCASE_MODES.map((m) => {
        const on = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m.id)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
              on ? "border-brand-400 bg-brand-50 dark:bg-brand-900/30" : "border-token bg-[rgb(var(--surface))] hover:border-brand-400"
            }`}
          >
            <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${on ? "border-brand-600 bg-brand-600" : "border-token"}`} aria-hidden />
            <span>
              <span className="block font-medium">{m.label}</span>
              <span className="block text-sm text-muted">{m.description}</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-muted">
        Chỉ áp dụng cho các nhiệm vụ nộp chung theo đội. Bình chọn chỉ mở khi mọi đội xem được bài của nhau. Người tạo giải luôn xem được tất cả.
      </p>
    </div>
  );
}
