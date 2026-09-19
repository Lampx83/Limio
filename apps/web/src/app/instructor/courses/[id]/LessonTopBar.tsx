"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, EyeOff } from "lucide-react";
import LessonViewToggle from "./LessonViewToggle";

interface BarLesson {
  id: string;
  title: string;
  isHidden: boolean;
  noSkill: boolean;
}

interface BarModule {
  id: string;
  title: string;
  isHidden: boolean;
  lessons: BarLesson[];
}

/**
 * Thanh trên của trang sửa bài — thay cho cột outline: quay về tổng quan nội
 * dung, đổi bài qua danh sách thả xuống, và công tắc Sửa/Xem trước.
 */
export default function LessonTopBar({
  courseId,
  modules,
  activeLessonId,
}: {
  courseId: string;
  modules: BarModule[];
  activeLessonId: string;
}) {
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const base = `/instructor/courses/${courseId}`;
  const preview = search.get("lessonView") === "preview" ? "&lessonView=preview" : "";
  const hrefFor = (id: string) => `${base}?tab=content&lesson=${id}${preview}`;

  let activeNumber = "";
  let activeModuleTitle = "";
  modules.forEach((m, mi) =>
    m.lessons.forEach((l, li) => {
      if (l.id === activeLessonId) {
        activeNumber = `${mi + 1}.${li + 1}`;
        activeModuleTitle = m.title;
      }
    }),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`${base}?tab=content`}
        prefetch={false}
        title="Về danh sách nội dung"
        aria-label="Về danh sách nội dung"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-700 transition-colors hover:bg-brand-soft"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Link>

      <div ref={boxRef} className="relative min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          title="Chọn bài khác"
          className="flex max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[rgb(var(--surface-muted))]"
        >
          <span className="hidden truncate text-sm text-muted sm:inline">{activeModuleTitle}</span>
          <span className="hidden text-faint sm:inline" aria-hidden>›</span>
          <span className="shrink-0 text-sm font-semibold">Bài {activeNumber}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full z-30 mt-1 max-h-[70vh] w-80 max-w-[90vw] overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] p-1.5 shadow-xl"
          >
            {modules.map((m, mi) => (
              <div key={m.id}>
                <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <span className="truncate">
                    {mi + 1} · {m.title}
                  </span>
                  {m.isHidden && <EyeOff className="h-3 w-3 shrink-0 text-danger-600" aria-label="Module ẩn" />}
                </p>
                {m.lessons.length === 0 && (
                  <p className="px-2 py-1 text-xs text-faint">— chưa có bài</p>
                )}
                {m.lessons.map((l, li) => {
                  const active = l.id === activeLessonId;
                  return (
                    <Link
                      key={l.id}
                      href={hrefFor(l.id)}
                      prefetch={false}
                      role="option"
                      aria-selected={active}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-soft font-semibold text-brand-700"
                          : "hover:bg-[rgb(var(--surface-muted))]"
                      }`}
                    >
                      <span className="w-8 shrink-0 text-xs text-faint">
                        {mi + 1}.{li + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      {l.isHidden && <span className="shrink-0 text-[11px] text-danger-600">ẩn</span>}
                      {l.noSkill && <span className="shrink-0 text-[11px] text-accent-700">chưa tag</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto">
        <LessonViewToggle />
      </div>
    </div>
  );
}
