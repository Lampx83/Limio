"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type View = "edit" | "preview";

export default function ViewModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current: View = search.get("view") === "preview" ? "preview" : "edit";

  function setView(next: View) {
    if (next === current) return;
    const params = new URLSearchParams(search.toString());
    if (next === "preview") params.set("view", "preview");
    else params.delete("view");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const items: Array<{ value: View; label: string }> = [
    { value: "edit", label: "Sửa" },
    { value: "preview", label: "Xem trước" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Chế độ xem"
      data-view-keep
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-0.5"
    >
      {items.map((it) => {
        const active = current === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            data-view-keep
            aria-checked={active}
            onClick={() => setView(it.value)}
            className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-gradient text-white shadow-sm"
                : "text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
