"use client";

import { useRouter } from "next/navigation";
import BlueprintEditor from "../../BlueprintEditor";

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
  bankIds?: string[];
  cells: Array<{
    cognitiveLevel?: "remember_understand" | "apply" | "analyze_plus";
    difficulty?: number;
    topic?: string;
    count: number;
  }>;
  totalCount: number;
}

/** Cầu nối server→client: trang cha (server) đã tải sẵn lessonTree + blueprint
 *  đã lưu, component này chỉ lo phần điều hướng sau khi chốt (BlueprintEditor
 *  giữ nguyên không đổi — dùng lại y hệt bản trong BankPickerModal cũ). */
export default function BlueprintEditorClient({
  examId,
  lessonTree,
  initialBlueprint,
  doneHref,
}: {
  examId: string;
  lessonTree: ModuleNode[];
  initialBlueprint: InitialBlueprint | null;
  doneHref: string;
}) {
  const router = useRouter();
  return (
    <BlueprintEditor
      examId={examId}
      lessonTree={lessonTree}
      initialBlueprint={initialBlueprint}
      onDone={() => {
        // BlueprintEditor tự dispatch "fbm:exam-sections-changed" trước khi
        // gọi onDone — chỉ còn việc điều hướng về tab Nội dung ở đây.
        router.push(doneHref);
        router.refresh();
      }}
    />
  );
}
