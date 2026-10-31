"use client";

import { readLessonLook } from "@feedbackme/shared-types";
import SafeHtml from "@/components/SafeHtml";
import { lessonStyleVars } from "@/lib/lessonLook";
import { buildFaqDetails } from "@/lib/lessonFaq";
import { buildStepReveal, handleStepRevealClick } from "@/lib/lessonReveal";
import { LESSON_FONT_VARIABLES } from "./lessonFonts";
import "./lessonLook.css";

/** Hỏi-đáp gập mở rồi lời giải hiện dần; hai bố cục khác nhau nên không đụng nhau. Hàm thuần cấp module. */
const dress = (h: string) => buildStepReveal(buildFaqDetails(h));

/**
 * Bài học văn bản ở trang học viên. Bài đã chọn bảng màu + kiểu chữ thì khung
 * bài nhận màu nền, màu chữ và font của bảng đó; bài cũ chưa chọn thì hiện như
 * trước (các khối mới, nếu có, dùng màu Xanh Limio mặc định).
 */
export default function LessonRichText({
  html,
  look: rawLook,
  className = "",
}: {
  html: string;
  /** `payload.look` — không tin cậy, đọc lại qua readLessonLook. */
  look?: unknown;
  className?: string;
}) {
  const look = readLessonLook(rawLook);
  const base = "prose prose-sm max-w-none rounded-xl border border-token p-4 dark:prose-invert";
  if (!look) {
    return (
      <SafeHtml
        html={html}
        transform={dress}
        onClick={handleStepRevealClick}
        className={`${base} bg-[rgb(var(--surface))] ${className}`}
      />
    );
  }
  return (
    <SafeHtml
      html={html}
      transform={dress}
      onClick={handleStepRevealClick}
      className={`${base} lesson-look ${LESSON_FONT_VARIABLES} sm:p-6 ${className}`}
      style={lessonStyleVars(look)}
      attrs={{ "data-palette": look.palette, "data-font": look.font }}
    />
  );
}
