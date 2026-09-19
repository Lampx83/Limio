"use client";

import Link from "next/link";
import { ChevronDown, ClipboardCheck, FileText, HelpCircle } from "lucide-react";
import ModuleHeader from "./ModuleHeader";
import AddLessonForm from "./AddLessonForm";

export interface OverviewLesson {
  id: string;
  title: string;
  isHidden: boolean;
  isLocked: boolean;
  noSkill: boolean;
  contentCount: number;
  quizCount: number;
  assignmentCount: number;
}

export default function ModuleOverviewCard({
  courseId,
  module,
  order,
  collapsed,
  onToggle,
  filtering,
}: {
  courseId: string;
  module: {
    id: string;
    title: string;
    orderIndex: number;
    isHidden: boolean;
    isLocked: boolean;
    lessons: OverviewLesson[];
  };
  order: number;
  collapsed: boolean;
  onToggle: () => void;
  /** Đang lọc theo từ khoá: chỉ hiện bài khớp, ẩn ô "Thêm bài". */
  filtering: boolean;
}) {
  return (
    <div className="border-b border-token last:border-b-0">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Mở module" : "Gập module"}
          className="flex h-10 w-10 shrink-0 items-center justify-center text-muted transition-colors hover:text-[rgb(var(--text))]"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            aria-hidden
          />
        </button>
        <div className="min-w-0 flex-1">
          <ModuleHeader
            moduleId={module.id}
            title={module.title}
            order={order}
            orderIndex={module.orderIndex}
            isHidden={module.isHidden}
            isLocked={module.isLocked}
            lessonCount={module.lessons.length}
          />
        </div>
      </div>

      {!collapsed && (
        <div className={module.isHidden ? "opacity-60" : undefined}>
          <ul>
            {module.lessons.length === 0 && (
              <li className="border-t border-token px-4 py-4 text-center text-sm text-muted">
                {filtering ? "Không có bài khớp." : "Module này chưa có bài."}
              </li>
            )}
            {/* prefetch={false}: xem chú thích trong EditorTabs.tsx. */}
            {module.lessons.map((l, i) => (
              <li key={l.id} className="border-t border-token">
                <Link
                  href={`/instructor/courses/${courseId}?tab=content&lesson=${l.id}`}
                  prefetch={false}
                  className="flex items-center gap-3 py-2 pl-10 pr-4 transition-colors hover:bg-[rgb(var(--surface-muted))]"
                >
                  <span className="w-9 shrink-0 text-xs font-medium tabular-nums text-faint">
                    {order}.{i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  {l.noSkill && <span className="chip-accent text-xs">chưa tag skill</span>}
                  {l.isHidden && <span className="chip-danger text-xs">Ẩn</span>}
                  {!l.isHidden && (l.isLocked || module.isLocked) && (
                    <span className="chip-accent text-xs">Khoá</span>
                  )}
                  <span className="hidden items-center gap-3 text-xs text-muted sm:flex">
                    {l.contentCount > 0 && (
                      <span className="inline-flex items-center gap-1" title={`${l.contentCount} khối nội dung`}>
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        {l.contentCount}
                      </span>
                    )}
                    {l.quizCount > 0 && (
                      <span className="inline-flex items-center gap-1" title={`${l.quizCount} quiz`}>
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                        {l.quizCount}
                      </span>
                    )}
                    {l.assignmentCount > 0 && (
                      <span className="inline-flex items-center gap-1" title={`${l.assignmentCount} assignment`}>
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                        {l.assignmentCount}
                      </span>
                    )}
                  </span>
                  <span className="text-faint">›</span>
                </Link>
              </li>
            ))}
          </ul>

          {!filtering && (
            <div className="border-t border-token py-2 pl-10 pr-4">
              <AddLessonForm moduleId={module.id} nextOrderIndex={module.lessons.length} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
