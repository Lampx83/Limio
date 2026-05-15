"use client";

import { AlertTriangle } from "lucide-react";

export interface LessonNode {
  id: string;
  title: string;
  bankCount: number;
}
export interface ModuleNode {
  id: string;
  title: string;
  lessons: LessonNode[];
}

interface Props {
  tree: ModuleNode[];
  selected: string[];
  onToggleLesson: (lessonId: string) => void;
  onToggleModule: (lessonIds: string[]) => void;
}

export default function LessonTree({ tree, selected, onToggleLesson, onToggleModule }: Props) {
  const selectedSet = new Set(selected);
  const totalAvailable = tree.flatMap((m) => m.lessons).reduce((a, l) => a + l.bankCount, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-faint">
        {selectedSet.size > 0
          ? `Đã chọn ${selectedSet.size} bài học`
          : "Chưa chọn bài học nào"}
        {totalAvailable > 0 && (
          <span className="ml-2 text-blue-600">
            · {totalAvailable} câu sẵn có trong ngân hàng
          </span>
        )}
      </p>

      {tree.map((mod) => {
        const modLessons = mod.lessons.map((l) => l.id);
        const enabledLessons = mod.lessons.filter((l) => l.bankCount > 0).map((l) => l.id);
        const allSelected = enabledLessons.length > 0 && enabledLessons.every((id) => selectedSet.has(id));

        return (
          <div key={mod.id} className="rounded border border-default">
            {/* Module header row */}
            <label className="flex cursor-pointer items-center gap-2 bg-surface px-3 py-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={enabledLessons.length === 0}
                onChange={() => {
                  if (allSelected) {
                    // Deselect all enabled lessons of this module
                    const toRemove = new Set(modLessons);
                    onToggleModule(selected.filter((id) => !toRemove.has(id)));
                  } else {
                    // Select all enabled lessons (union)
                    const newSelected = [...new Set([...selected, ...enabledLessons])];
                    onToggleModule(newSelected);
                  }
                }}
                className="accent-blue-600"
              />
              <span>{mod.title}</span>
              <span className="ml-auto text-xs text-faint">
                {mod.lessons.reduce((a, l) => a + l.bankCount, 0)} câu
              </span>
            </label>

            {/* Lesson rows */}
            <div className="divide-y divide-default">
              {mod.lessons.map((lesson) => {
                const isChecked = selectedSet.has(lesson.id);
                const hasQuestions = lesson.bankCount > 0;
                return (
                  <label
                    key={lesson.id}
                    className={`flex cursor-pointer items-center gap-2 px-5 py-2 text-sm ${
                      hasQuestions ? "hover:bg-surface" : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!hasQuestions}
                      onChange={() => onToggleLesson(lesson.id)}
                      className="accent-blue-600"
                    />
                    <span className="flex-1">{lesson.title}</span>
                    {hasQuestions ? (
                      <span className="text-xs text-faint">{lesson.bankCount} câu</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="Chưa có câu hỏi trong ngân hàng cho bài này">
                        0 câu <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
