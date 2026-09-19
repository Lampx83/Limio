"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FlaskConical, X, ListTree } from "lucide-react";

interface SidebarLesson {
  id: string;
  title: string;
  isHidden: boolean;
  noSkill: boolean;
  contentCount: number;
  quizCount: number;
  assignmentCount: number;
}

interface SidebarModule {
  id: string;
  title: string;
  isHidden: boolean;
  lessons: SidebarLesson[];
}

export default function EditorSidebar({
  courseId,
  modules,
  activeLessonId,
  view,
}: {
  courseId: string;
  modules: SidebarModule[];
  activeLessonId?: string;
  view: "edit" | "preview";
}) {
  const baseHref = `/instructor/courses/${courseId}`;
  const overviewHref =
    view === "preview"
      ? `${baseHref}?tab=content&view=preview`
      : `${baseHref}?tab=content`;
  const lessonHref = (lessonId: string) =>
    view === "preview"
      ? `${baseHref}?tab=content&view=preview&lesson=${lessonId}`
      : `${baseHref}?tab=content&lesson=${lessonId}`;

  const isOverviewActive = !activeLessonId;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Auto-close drawer when navigation happens (e.g. user picks a lesson).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, searchParams]);

  // Lock body scroll while drawer open (mobile only).
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const activeLesson = activeLessonId
    ? modules.flatMap((m) => m.lessons).find((l) => l.id === activeLessonId)
    : null;
  const triggerLabel = activeLesson?.title ?? "Tổng quan khoá";

  const tree = (
    <>
      <Link
        href={overviewHref}
        className={`block rounded-lg px-3 py-2 font-semibold transition-colors ${
          isOverviewActive
            ? "bg-brand-soft text-brand-700"
            : "hover:bg-[rgb(var(--surface-muted))]"
        }`}
      >
        Tổng quan khóa
      </Link>
      <Link
        href={`${baseHref}/exams`}
        className="block rounded-lg px-3 py-2 text-sm hover:bg-[rgb(var(--surface-muted))]"
      >
        <FlaskConical className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" /> Bài thi
      </Link>

      <div className="mt-2 space-y-1">
        {modules.length === 0 && (
          <p className="px-3 py-4 text-xs text-faint">Chưa có module nào.</p>
        )}
        {modules.map((m, mi) => {
          const moduleHasActive = m.lessons.some(
            (l) => l.id === activeLessonId,
          );
          return (
            <details key={m.id} open={moduleHasActive || mi < 3} className="group">
              <ModuleSummary module={m} index={mi} />
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {m.lessons.length === 0 && (
                  <li className="px-3 py-1.5 text-xs text-faint">— chưa có bài</li>
                )}
                {/* prefetch={false}: xem chú thích trong EditorTabs.tsx — một
                    link mỗi bài, prefetch hết là bắn cả chục render/lần mở trang. */}
                {m.lessons.map((l, li) => {
                  const active = l.id === activeLessonId;
                  return (
                    <li key={l.id}>
                      <Link
                        href={lessonHref(l.id)}
                        prefetch={false}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-brand-soft font-medium text-brand-700"
                            : "text-default hover:bg-[rgb(var(--surface-muted))]"
                        }`}
                      >
                        <span className="text-xs text-faint w-5 flex-shrink-0">
                          {li + 1}.
                        </span>
                        <span className="truncate flex-1">{l.title}</span>
                        {l.noSkill && (
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-500"
                            title="Chưa tag skill"
                          />
                        )}
                        {l.isHidden && (
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger-500"
                            title="Bài ẩn"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: inline sticky sidebar */}
      <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-56 flex-shrink-0 self-start overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 text-sm md:block lg:w-64">
        {tree}
      </aside>

      {/*
        Dưới `md` (768px) thì sidebar thu thành ngăn kéo, và đây là nút mở nó.

        Trước đây nút này là một thanh ngang chiếm hết bề rộng, dính trên đỉnh
        và ghi lại đúng tên bài mà breadcrumb ngay bên dưới đã ghi — hai dòng
        nói cùng một điều, một dòng bám theo suốt lúc cuộn. Giờ là một nút tròn
        ở góc dưới, giống mọi nút nổi khác của sản phẩm: vẫn với tới được ở bất
        kỳ chỗ nào trên trang, mà không lấy mất một dòng ở đầu nội dung.
      */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        title={`Mở menu nội dung — đang xem: ${triggerLabel}`}
        aria-label="Mở menu nội dung khoá"
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface))] text-brand-600 shadow-lg transition-transform hover:scale-105 md:hidden"
      >
        <ListTree className="h-5 w-5" aria-hidden />
      </button>

      {/* Mobile: drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Đóng menu nội dung"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          {/* Panel */}
          <aside className="relative ml-0 flex h-full w-[85%] max-w-xs flex-col bg-[rgb(var(--surface))] shadow-2xl">
            <header className="flex items-center justify-between gap-2 border-b border-token px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Nội dung khoá
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-default"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-3 text-sm">{tree}</div>
          </aside>
        </div>
      )}
    </>
  );
}

function ModuleSummary({ module: m, index }: { module: SidebarModule; index: number }) {
  return (
    <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-[rgb(var(--surface-muted))]">
      <span className="text-faint transition-transform group-open:rotate-90">›</span>
      <span className="truncate" title={m.title}>
        {index + 1}. {m.title}
      </span>
      {m.isHidden && (
        <span
          className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-danger-500"
          title="Module ẩn"
        />
      )}
    </summary>
  );
}
