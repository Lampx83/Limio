"use client";

import type { WritingErrorSummary } from "@feedbackme/core-feedback";
import { categoryLabel } from "@/lib/writingFeedbackText";
import { useT, useUiLang } from "@/lib/i18n/client";

/**
 * LANG G6d — khối "Lỗi hay gặp khi viết" trên hồ sơ 4 kỹ năng. Chỉ tính từ các bản góp ý ĐÃ ĐƯỢC GIẢNG
 * VIÊN DUYỆT trong 8 tuần gần nhất. TÁCH HẲN khỏi nhãn Cần ôn / Nên luyện / Vững.
 */
export default function WritingErrorsBlock({ summary }: { summary: WritingErrorSummary }) {
  const t = useT();
  const lang = useUiLang();
  const frequent = summary.categories.filter((c) => c.frequent).slice(0, 3);
  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" data-testid="writing-errors-block">
      <h2 className="text-h3">{t("practice.wf.errs.title")}</h2>
      <p className="text-meta mt-1">
        {t("practice.wf.errs.meta", { n: summary.feedbackCount })}
      </p>
      {frequent.length === 0 ? (
        <p className="text-meta mt-3">
          {summary.totalErrors === 0 ? t("practice.wf.errs.emptyNone") : t("practice.wf.errs.emptySome")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {frequent.map((c) => (
            <li key={c.category} className="rounded border border-token px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{categoryLabel(c.category, lang)}</span>
                <span className="tabular-nums text-faint">
                  {t("practice.wf.errs.count", { c: c.count, p: Math.round(c.share * 100) })}
                </span>
              </div>
              {c.examples.map((e, i) => (
                <p key={i} className="text-meta mt-1">
                  <span className="line-through decoration-red-400">{e.quote}</span> → <span className="font-medium">{e.correction}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
