"use client";

import type { ModuleNode } from "../components/LessonTree";
import LessonTree from "../components/LessonTree";
import type { WizardState } from "../useWizardState";
import type { Dispatch } from "react";

interface Props {
  state: WizardState;
  dispatch: Dispatch<{ type: string; [k: string]: unknown }>;
  lessonTree: ModuleNode[];
  onNext: () => void;
}

export default function Step1Content({ state, dispatch, lessonTree, onNext }: Props) {
  const allLessons = lessonTree.flatMap((m) => m.lessons.filter((l) => l.bankCount > 0).map((l) => l.id));
  const hasSelection = state.selectedLessonIds.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Bước 1/3 — Chọn nội dung cần kiểm tra</h2>
        <p className="mt-1 text-sm text-faint">Chọn bài học nào sẽ có trong đề này.</p>
      </div>

      {lessonTree.length === 0 ? (
        <div className="rounded border border-dashed border-default px-4 py-8 text-center text-sm text-faint">
          Khoá học này chưa có bài học nào.{" "}
          <a href={`/instructor/courses/${state.courseId}`} className="text-blue-600 underline">
            Thêm bài học
          </a>
        </div>
      ) : (
        <LessonTree
          tree={lessonTree}
          selected={state.selectedLessonIds}
          onToggleLesson={(id) => dispatch({ type: "TOGGLE_LESSON", lessonId: id })}
          onToggleModule={(ids) => dispatch({ type: "SET_ALL_LESSONS", lessonIds: ids })}
        />
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={allLessons.length > 0}
          onClick={() => dispatch({ type: "SET_ALL_LESSONS", lessonIds: allLessons })}
          className="text-xs text-blue-600 hover:underline disabled:invisible"
        >
          Chọn tất cả
        </button>
        <div className="flex items-center gap-3">
          {!hasSelection && (
            <p className="text-xs text-red-500">Chọn ít nhất 1 bài học</p>
          )}
          <button
            type="button"
            disabled={!hasSelection}
            onClick={onNext}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </div>
  );
}
