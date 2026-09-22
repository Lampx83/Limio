"use client";

import Link from "next/link";
import { ExternalLink, ListChecks } from "lucide-react";
import { usePathname } from "next/navigation";
import { QuizActionButtons } from "./QuizHeader";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  isHidden: boolean;
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    points: number;
    orderIndex: number;
    explanation: string | null;
    extra: unknown;
    options: Array<{
      id: string;
      label: string;
      isCorrect: boolean;
      orderIndex: number;
      misconceptionId: string | null;
      misconception: { id: string; code: string; name: string } | null;
      extra: unknown;
    }>;
    skillTags: Array<{
      skillId: string;
      skill: { code: string; name: string };
    }>;
  }>;
}

export default function QuizSection({
  quiz,
  // Không còn dùng trong file này từ khi bỏ AiQuestionGenerator (nút "Tạo câu
  // hỏi bằng AI" — sinh câu MỚI từ chủ đề) khỏi giao diện. Giữ prop vì
  // ActivitySection.tsx (đang có phiên khác chỉnh sửa) vẫn truyền vào.
  lessonId: _lessonId,
}: {
  quiz: Quiz;
  lessonId: string;
}) {
  const pathname = usePathname();

  // Không còn bấm-để-mở-rộng-soạn-tại-chỗ nữa (từng dùng <details>/<summary> +
  // AddQuestionForm inline) — soạn câu hỏi giờ CHỈ qua "Mở trình soạn" (trang
  // riêng, /quizzes/[quizId]/edit). Hàng này chỉ còn là dòng tóm tắt tĩnh —
  // cùng khuôn với ContentItemRow (icon tròn + chip loại + nhóm action) để
  // Quiz nhận ra được ngay giữa danh sách hoạt động nhiều loại khác nhau.
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        quiz.isHidden
          ? "border-danger-200 bg-danger-50/50"
          : "border-token bg-[rgb(var(--surface))] hover:border-brand-200"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-700">
        <ListChecks className="h-5 w-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-brand">Quiz</span>
          {quiz.isHidden && <span className="chip-danger">Đang ẩn</span>}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-default">{quiz.title}</p>
        <p className="text-xs text-muted">
          {quiz.questions.length} câu · độ khó {quiz.difficulty ?? "—"}
        </p>
      </div>

      <Link
        href={`${pathname}/quizzes/${quiz.id}/edit`}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        Mở trình soạn
        <ExternalLink className="h-3 w-3" aria-hidden />
      </Link>
      <QuizActionButtons quiz={quiz} />
    </div>
  );
}
