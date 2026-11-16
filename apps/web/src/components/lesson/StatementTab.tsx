"use client";

import LessonRichText from "./LessonRichText";

/**
 * Tab của exercise chỉ có chữ (không có bài luyện, vd 7A, 7B, 8B): cùng khuôn với khối đề bài của bài luyện — tiêu đề là số exercise,
 * rồi câu yêu cầu và phần đi kèm (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC6).
 */
export default function StatementTab({ code, html, title }: { code: string; html: string; /** Tên bài tập rút từ câu yêu cầu: hiện đậm cạnh mã bài ("4A · Which word is stressed…"). */ title?: string }) {
  return (
    <div className="ps-paper-card mt-3 px-4 py-3" data-testid="lp-instruction">
      <h3 className="text-h4">{title ? `${code} · ${title}` : code}</h3>
      <LessonRichText html={html} className="!m-0 !rounded-none !border-0 !bg-transparent !p-0 sm:!p-0 [&_p]:!mb-0 [&_p]:!mt-1 [&_p]:!leading-7" />
    </div>
  );
}
