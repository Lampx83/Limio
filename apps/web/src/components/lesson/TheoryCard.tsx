"use client";

import LessonRichText from "./LessonRichText";

/**
 * Phần lý thuyết của bài ngoại ngữ là MỘT thẻ (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC8): các khối chữ liền nhau
 * (banner, câu dẫn, hộp quy tắc, mẹo) gộp thành một, bài đọc dài đi kèm nằm trong cùng thẻ chứ không thành thẻ riêng.
 */
export default function TheoryCard({ html, title, children }: { html: string; /** Dòng tên bài (chip kỹ năng + tên) đứng đầu thẻ, thay cho thẻ tên bài riêng. */ title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 sm:p-5" data-testid="lesson-theory">
      {title && <div className="mb-3 border-b border-token pb-3">{title}</div>}
      <LessonRichText html={html} className="pv-hl-bold !m-0 !rounded-none !border-0 !bg-transparent !p-0 sm:!p-0 [&_h2]:!mb-2 [&_h2]:!mt-2 [&_p]:!mb-1 [&_p]:!mt-1" />
      {children && <div className="mt-6 space-y-6 border-t border-token pt-6">{children}</div>}
    </div>
  );
}
