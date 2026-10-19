import Link from "next/link";
import { Lock } from "lucide-react";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";
import type { LibraryItem } from "@feedbackme/core-lms";
import { PAPER_TYPE_TEXT, levelLabelText, statusLabelText } from "@/lib/practiceLibraryQuery";

const STATUS_TONE: Record<LibraryItem["myStatus"], string> = {
  not_started: "bg-[rgb(var(--surface-muted))] text-muted",
  in_progress: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-800",
  redo: "bg-amber-100 text-amber-800",
};

/**
 * LANG L6.3 — một dòng đề trong thư viện của khoá luyện đề. Hàng GỌN (một đề một dòng) cho vài trăm đề.
 * Hai nút rõ ràng theo đúng cờ của đề: Luyện đề (không giới hạn giờ) và Phòng thi mô phỏng (bấm giờ). Mức gần nhất là
 * NHÃN (Cần ôn / Nên luyện / Vững), không có số điểm. Đề khoá (chưa mua, không học thử): không có nút, chỉ siêu dữ liệu.
 */
export default function PracticeRow({ slug, item }: { slug: string; item: LibraryItem }) {
  const level = levelLabelText(item.lastLevel);
  const skills = item.skills.map((s) => (isLanguageSkill(s) ? LANGUAGE_SKILL_LABEL[s] : s));
  const base = `/learn/${slug}/exams/${item.examId}`;
  return (
    <li
      id={`exam-${item.examId}`}
      aria-disabled={item.locked ? "true" : undefined}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3 ${item.locked ? "opacity-70" : ""}`}
    >
      <span className="w-8 shrink-0 text-center text-sm tabular-nums text-muted" aria-label="Số thứ tự">
        {item.seq ?? "·"}
      </span>
      <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.title}</span>
          {item.freePreview && <span className="rounded-full bg-lime-100 px-2 py-0.5 text-xs font-semibold text-lime-800">Học thử</span>}
          {item.paperType && <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-xs text-muted">{PAPER_TYPE_TEXT[item.paperType]}</span>}
        </div>
        <div className="text-caption mt-0.5 flex flex-wrap items-center gap-x-3 text-muted">
          {item.sourceLabel && <span>{item.sourceLabel}</span>}
          {item.yearLabel && <span>{item.yearLabel}</span>}
          {skills.length > 0 && <span>{skills.join(" · ")}</span>}
          {item.difficulty && (
            <span aria-label={`Độ khó ${item.difficulty}/5`} title={`Độ khó ${item.difficulty}/5`}>
              {"●".repeat(item.difficulty)}
              <span className="opacity-30">{"●".repeat(5 - item.difficulty)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Điện thoại: trạng thái và nút xuống một dòng riêng (thụt vào dưới tên) cho hàng gọn; từ sm nằm cùng hàng. */}
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 pl-12 sm:w-auto sm:pl-0">
        {!item.locked && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[item.myStatus]}`}>{statusLabelText(item.myStatus)}</span>
            {level && <span className="text-xs text-muted">{level}</span>}
            {item.attemptCount > 0 && <span className="text-xs text-muted">{item.attemptCount} lần</span>}
          </div>
        )}

        {item.locked ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Lock size={14} aria-hidden /> Cần mua khoá
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {item.allowPractice && (
              <Link href={`${base}/practice`} className="btn-secondary btn-sm">
                Luyện đề
              </Link>
            )}
            {item.allowMock && (
              <Link href={base} className="btn-primary btn-sm" aria-label="Phòng thi mô phỏng">
                <span className="sm:hidden" aria-hidden>Mô phỏng</span>
                <span className="hidden sm:inline">Phòng thi mô phỏng</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
