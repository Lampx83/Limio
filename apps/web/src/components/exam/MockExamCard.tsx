import Link from "next/link";
import type { MockExamCard as MockExamCardData } from "@feedbackme/core-lms";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";
import { mockStatusText, practiceButtonLabel, practiceHref, practiceStatusText } from "@/lib/courseHomeView";

/**
 * Thẻ một đề thi thử cho học viên: tên, "n phần · m phút", chip kỹ năng, hai cột Thi thử / Luyện đề với trạng thái và nút riêng (hai chế độ
 * lưu ở bảng riêng). Dùng chung ở khối "Thi thử" của trang khoá và ở khối "Đề thi" trong bài học (docs/tieu-chi/bai-hoc-gan-de-thi.md) để hai nơi
 * luôn giống nhau. Thuần trình bày: nhận dữ liệu của `listMockExamsForLearner`.
 */
export default function MockExamCard({ slug, exam: e, titleOverride }: { slug: string; exam: MockExamCardData; titleOverride?: string }) {
  const a = e.attempt;
  const inProgress = a?.status === "in_progress";
  const href = `/learn/${slug}/exams/${e.examId}`;
  // Hai chế độ lưu ở bảng riêng nên trạng thái và nút riêng, hiện thành hai cột.
  const showMock = e.allowMock || inProgress;
  const showPractice = e.allowPractice;
  const colClass = "flex flex-col gap-2 rounded-lg border border-token p-3";
  const btnBase = "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm";
  return (
    <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" data-testid="mock-exam-card">
      <div>
        <p className="text-body font-semibold">{titleOverride || e.title}</p>
        <p className="text-meta">
          {e.sections.length} phần · {e.totalMinutes} phút
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {e.sections.map((sec, i) => (
          <li key={i} className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs text-muted">
            {sec.languageSkill && isLanguageSkill(sec.languageSkill) && LANGUAGE_SKILL_LABEL[sec.languageSkill] !== sec.title
              ? `${LANGUAGE_SKILL_LABEL[sec.languageSkill]} · `
              : ""}
            {sec.title} · {sec.durationMin}′
          </li>
        ))}
      </ul>
      <div className={`mt-4 grid gap-3 ${showMock && showPractice ? "sm:grid-cols-2" : ""}`}>
        {showMock && (
          <div className={colClass} data-testid="exam-col-mock">
            <p className="text-sm font-semibold">Thi thử</p>
            <p className="text-caption text-muted">Mô phỏng thi thật</p>
            <p className="text-meta">{mockStatusText({ attempt: a, attemptCount: e.attemptCount })}</p>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              {a && !inProgress && (
                <Link href={`${href}/${a.attemptId}/result`} className={`${btnBase} border border-token hover:bg-brand-soft`}>
                  Xem kết quả
                </Link>
              )}
              <Link
                href={a && !inProgress ? `${href}?retake=1` : href}
                className={`${btnBase} bg-brand-600 font-medium text-white hover:bg-brand-700`}
              >
                {!a ? "Thi thử" : inProgress ? "Tiếp tục thi" : "Thi lại"}
              </Link>
            </div>
          </div>
        )}
        {showPractice && (
          <div className={colClass} data-testid="exam-col-practice">
            <p className="text-sm font-semibold">Luyện đề</p>
            <p className="text-caption text-muted">Không bấm giờ, xem đáp án ngay</p>
            <p className="text-meta">{practiceStatusText(e.practice)}</p>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              <Link
                href={practiceHref(slug, e.examId, e.practice)}
                className={`${btnBase} border border-brand-300 bg-brand-soft font-medium text-brand-800 hover:bg-brand-100`}
              >
                {practiceButtonLabel(e.practice)}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
