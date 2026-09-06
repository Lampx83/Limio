"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type LessonView = "edit" | "preview";

export default function LessonViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current: LessonView =
    search.get("lessonView") === "preview" ? "preview" : "edit";

  function setView(next: LessonView) {
    if (next === current) return;
    const params = new URLSearchParams(search.toString());
    if (next === "preview") params.set("lessonView", "preview");
    else params.delete("lessonView");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const items: Array<{ value: LessonView; label: string }> = [
    { value: "edit", label: "Sửa" },
    { value: "preview", label: "Xem trước" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Chế độ xem bài học"
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
