"use client";

import { useEffect, useState } from "react";
import BlueprintEditor from "./BlueprintEditor";

interface LessonNode {
  id: string;
  title: string;
  bankCount: number;
}
interface ModuleNode {
  id: string;
  title: string;
  lessons: LessonNode[];
}
interface InitialBlueprint {
  mode: "skill_matrix" | "topic_only";
  lessonIds: string[];
  cells: Array<{
    cognitiveLevel?: "remember_understand" | "apply" | "analyze_plus";
    difficulty?: number;
    topic?: string;
    count: number;
  }>;
  totalCount: number;
}

/**
 * Vỏ bọc quanh BlueprintEditor (900 dòng, giữ nguyên không đổi) để nhúng vào
 * BankPickerModal như 1 trong 3 tab ngang hàng của "Từ ngân hàng" (chọn thủ
 * công / theo tiêu chí / theo ma trận) — trước đây là tab riêng ở trang đề
 * thi, dữ liệu (lessonTree + blueprint đã lưu) do trang server tải sẵn; giờ
 * mở từ modal nên phải tự fetch client-side lúc mở.
 */
export default function BlueprintPanel({
  examId,
  onDone,
}: {
  examId: string;
  onDone?: () => void;
}) {
  const [lessonTree, setLessonTree] = useState<ModuleNode[] | null>(null);
  const [initialBlueprint, setInitialBlueprint] = useState<InitialBlueprint | null | undefined>(
    undefined,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/exams/${examId}/blueprint/lesson-tree`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch(`/api/exams/${examId}/blueprint`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
    ])
      .then(([lt, bp]) => {
        if (cancelled) return;
        setLessonTree((lt as { lessonTree: ModuleNode[] }).lessonTree ?? []);
        setInitialBlueprint((bp as { blueprint: InitialBlueprint | null }).blueprint ?? null);
      })
      .catch(() => !cancelled && setErr("Không tải được dữ liệu thiết kế đề."));
    return () => {
      cancelled = true;
    };
  }, [examId]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>}

      {!err && (lessonTree === null || initialBlueprint === undefined) && (
        <div className="py-10 text-center text-sm text-faint">Đang tải...</div>
      )}

      {!err && lessonTree !== null && initialBlueprint !== undefined && (
        <BlueprintEditor
          examId={examId}
          lessonTree={lessonTree}
          initialBlueprint={initialBlueprint}
          onDone={onDone}
        />
      )}
    </div>
  );
}
