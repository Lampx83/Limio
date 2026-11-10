import type { ReactNode } from "react";

/**
 * Khung trình bày dùng chung cho phần "N câu hỏi cho đoạn này" và từng "Câu n" ở đề thi (ExamPlayer) và luyện đề (PracticePlayer).
 * Chỉ là vỏ (không có logic): số câu là một thẻ gradient thương hiệu, số điểm là thẻ xám nhạt, mỗi câu là một thẻ riêng.
 */

/** Tiêu đề cột câu hỏi cạnh đoạn văn: số câu trong ô nổi bật + chữ "câu hỏi cho đoạn này". */
export function QuestionSetHeader({ count }: { count: number }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-h4">
      <span className="flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-brand-soft px-2 text-sm font-bold tabular-nums text-brand-700">
        {count}
      </span>
      <span>câu hỏi cho đoạn này</span>
    </h2>
  );
}

/** Đầu một câu: thẻ "Câu n", số điểm, và (bên phải) trạng thái như "Đã trả lời" / "Đúng". */
export function QuestionNumber({ n, points, right }: { n: number | string; points: number; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center rounded-full bg-brand-gradient px-3 text-sm font-bold tabular-nums text-white shadow-sm">Câu {n}</span>
        <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs font-medium text-muted">{points} điểm</span>
      </h3>
      {right}
    </div>
  );
}

/** Thẻ bao một câu hỏi (mỗi câu một thẻ, cách nhau thoáng). */
export const QUESTION_CARD_CLASS = "mb-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-sm last:mb-0";
