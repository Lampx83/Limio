import type { ExamRefIssue, MockExamCard as MockExamCardData } from "@feedbackme/core-lms";
import MockExamCard from "./MockExamCard";
import type { UiLang } from "@/lib/i18n/core";

/**
 * Khối "Đề thi" (exam_ref) trong bài học — docs/tieu-chi/bai-hoc-gan-de-thi.md. Học viên thấy đúng thẻ đề như ở trang khoá; giảng viên ở
 * "Xem như học viên" thấy thẻ (không bấm được) hoặc nhãn nói rõ vì sao học viên chưa thấy khối này.
 */

export function ExamRefLearnerBlock({ slug, exam, title, lang }: { slug: string; exam: MockExamCardData; title?: string; lang?: UiLang }) {
  return (
    <section className="my-6" aria-label={title || exam.title}>
      <MockExamCard slug={slug} exam={exam} titleOverride={title} lang={lang} />
    </section>
  );
}

export const EXAM_REF_ISSUE_TEXT: Record<Exclude<ExamRefIssue, "ok">, string> = {
  not_selected: "Chưa chọn đề — chọn đề ở trình soạn. Học viên chưa thấy khối này.",
  missing: "Đề đã bị xoá — chọn đề khác. Học viên chưa thấy khối này.",
  draft: "Đề chưa xuất bản — học viên chưa thấy khối này.",
  archived: "Đề đã lưu trữ — học viên chưa thấy khối này.",
  other_course: "Đề thuộc khoá khác — chọn đề của khoá này. Học viên chưa thấy khối này.",
  modes_off: "Đề đã tắt cả Thi thử và Luyện đề — học viên chưa thấy khối này.",
};

export function ExamRefPreviewBlock({ slug, exam, issue, title }: { slug: string; exam: MockExamCardData | null; issue: ExamRefIssue; title?: string }) {
  if (issue !== "ok" || !exam) {
    return (
      <section className="my-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" aria-label={title || "Đề thi"}>
        <p className="font-semibold">Khối "Đề thi"{title ? ` · ${title}` : ""}</p>
        <p className="mt-1">{EXAM_REF_ISSUE_TEXT[issue === "ok" ? "missing" : issue]}</p>
      </section>
    );
  }
  return (
    <section className="my-6" aria-label={title || exam.title}>
      <p className="mb-2 text-xs text-faint">Xem trước: học viên bấm được các nút Thi thử và Luyện đề.</p>
      {/* Giảng viên thường không ghi danh khoá của mình nên các nút làm đề sẽ bị chặn: chỉ cho xem. */}
      <div className="pointer-events-none select-none" aria-disabled="true">
        <MockExamCard slug={slug} exam={exam} titleOverride={title} />
      </div>
    </section>
  );
}
