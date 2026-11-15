"use client";

import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * Hai phần nhắc học sinh giải ra giấy (docs/tieu-chi/quiz-nhap-ra-giay.md): màn hình chuẩn bị trước câu đầu, và khung che đáp án
 * ở câu cần tính toán. Đây là lời nhắc có cấu trúc, không phải kiểm tra: hệ thống không biết học sinh có nháp thật hay không.
 */

function PaperIllustration() {
  return (
    <svg width="130" height="105" viewBox="0 0 104 84" fill="none" aria-hidden="true" className="text-[rgb(var(--text-muted))]">
      <rect x="8" y="4" width="70" height="76" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 20h70M8 36h70M8 52h70M8 68h70M24 4v76M42 4v76M60 4v76" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M16 15c6-5 9 4 14 0s7-3 11 0M16 31c8-4 12 3 20 0M16 47c7-5 14 3 25-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M94 16 66 62l-3 11 9-7 28-46z" className="fill-[rgb(var(--brand)/0.15)] stroke-[rgb(var(--brand))]" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function WorkOnPaperIntro({ title, questionCount, points, onReady }: { title: string; questionCount: number; points: number; onReady: () => void }) {
  const t = useT();
  return (
    <section className="card mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm text-muted">{title}</p>
      <PaperIllustration />
      <h1 className="text-h3">{t("practice.quiz.paper.title")}</h1>
      <p className="text-sm leading-relaxed text-muted">{t("practice.quiz.paper.body")}</p>
      <p className="text-xs text-faint">
        {t("practice.quiz.paper.meta", { n: questionCount, p: points })}
      </p>
      <button type="button" autoFocus className="btn-primary mt-2 min-h-[44px]" onClick={onReady}>
        {t("practice.quiz.paper.ready")}
      </button>
    </section>
  );
}

export function CoveredOptions({ onReveal }: { onReveal: () => void }) {
  const t = useT();
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-token p-6 text-center">
      <Pencil size={22} className="text-muted" aria-hidden />
      <p className="text-sm leading-relaxed text-muted">{t("practice.quiz.paper.covered")}</p>
      <button type="button" className="btn-primary min-h-[44px]" onClick={onReveal}>
        {t("practice.quiz.paper.reveal")}
      </button>
    </div>
  );
}
