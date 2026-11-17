"use client";

import { readLessonLook } from "@feedbackme/shared-types";
import SafeHtml from "@/components/SafeHtml";
import { lessonStyleVars } from "@/lib/lessonLook";
import { buildFaqDetails } from "@/lib/lessonFaq";
import { buildVocabCards, buildVocabRuby } from "@/lib/lessonVocabRuby";
import { hskGoalsHtml, hskPairHtml } from "@/lib/hskWarmup";
import { hskGrammarHtml, type HskGrammarPoint } from "@/lib/hskGrammar";
import { hskActivityHtml, hskBriefHtml, hskScenarioHtml } from "@/lib/hskActivity";
import { hskDropPageRef, hskDropVocabLabel, hskIntroHtml, hskRecolor, type HskKind } from "@/lib/hskLesson";
import { useCallback } from "react";
import { useT, useUiLang } from "@/lib/i18n/client";
import { buildStepReveal, handleStepRevealClick } from "@/lib/lessonReveal";
import { LESSON_FONT_VARIABLES } from "./lessonFonts";
import "./lessonLook.css";


/**
 * Bài học văn bản ở trang học viên. Bài đã chọn bảng màu + kiểu chữ thì khung
 * bài nhận màu nền, màu chữ và font của bảng đó; bài cũ chưa chọn thì hiện như
 * trước (các khối mới, nếu có, dùng màu Xanh Limio mặc định).
 */
export default function LessonRichText({
  html,
  look: rawLook,
  className = "",
  hskKind,
  hskGrammar,
}: {
  /** Nội dung bổ sung của các điểm ngữ pháp (chỉ khối ngữ pháp bài HSK): xem lib/hskGrammar.ts. */
  hskGrammar?: Record<string, HskGrammarPoint>;
  html: string;
  /** Khối của bài HSK (giao diện HSK): chuẩn bị HTML theo loại khối và bỏ khung thẻ. Không đặt = hành vi cũ. */
  hskKind?: HskKind;
  /** `payload.look` — không tin cậy, đọc lại qua readLessonLook. */
  look?: unknown;
  className?: string;
}) {
  const look = readLessonLook(rawLook);
  const t = useT();
  const lang = useUiLang();
  // Hỏi-đáp gập mở rồi lời giải hiện dần; hai bố cục khác nhau nên không đụng nhau. Nút "Bước tiếp" theo ngôn ngữ
  // giao diện; SafeHtml không theo dõi transform, nên `key={lang}` dựng lại khung khi đổi EN/VI.
  const dress = useCallback(
    (h0: string) => {
      const h = hskKind ? prepareHsk(h0, hskKind, hskGrammar) : h0;
      return buildStepReveal(buildFaqDetails(hskKind === "vocab" ? h : buildVocabRuby(h)), {
        next: t("reader.steps.next"),
        all: t("reader.steps.all"),
        reset: t("reader.steps.reset"),
        count: t("reader.steps.count"),
      });
    },
    [t, hskKind, hskGrammar],
  );
  const base = `prose prose-sm max-w-none rounded-xl border border-token p-4 dark:prose-invert${hskKind ? ` hsk-plain hsk-${hskKind}` : ""}`; // mọi khối bài HSK không khung viền (khung viền kép với thẻ tình huống…)
  if (!look) {
    return (
      <SafeHtml
        key={lang}
        html={html}
        transform={dress}
        onClick={handleStepRevealClick}
        className={`${base} bg-[rgb(var(--surface))] ${className}`}
      />
    );
  }
  return (
    <SafeHtml
      key={lang}
      html={html}
      transform={dress}
      onClick={handleStepRevealClick}
      className={`${base} lesson-look ${LESSON_FONT_VARIABLES} sm:p-6 ${className}`}
      style={lessonStyleVars(look)}
      attrs={{ "data-palette": look.palette, "data-font": look.font }}
    />
  );
}


/** Chuẩn bị HTML nhập sẵn của từng loại khối HSK: đổi màu cam sang màu chính, bỏ dải tiêu đề/nhãn/số trang đã có ở đầu bài và tiêu đề mục. */
function prepareHsk(html: string, kind: HskKind, grammar?: Record<string, HskGrammarPoint>): string {
  const h = hskRecolor(html);
  if (kind === "intro") return hskIntroHtml(h);
  if (kind === "intro-brief") return hskBriefHtml(hskIntroHtml(h));
  if (kind === "vocab") return buildVocabCards(hskDropVocabLabel(hskDropPageRef(h)));
  if (kind === "activity") return hskActivityHtml(hskIntroHtml(h));
  if (kind === "grammar") return hskGrammarHtml(hskDropPageRef(h), grammar);
  if (kind === "goals") return hskGoalsHtml(hskIntroHtml(h)); // bỏ cả dải tên bài (热身) lặp với đầu bài
  if (kind === "pair") return hskPairHtml(hskDropPageRef(h));
  return hskScenarioHtml(hskDropPageRef(h));
}
