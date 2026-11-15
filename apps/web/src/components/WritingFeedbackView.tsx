"use client";

import { categoryLabel, criterionLabel, levelLabel } from "@/lib/writingFeedbackText";
import { useT, useUiLang } from "@/lib/i18n/client";

export interface WritingFeedbackBody {
  summary: string;
  criteria: { key: string; level: string; comment: string }[];
  errors: { id: string; category: string; quote: string; correction: string; explanation: string }[];
  nextSteps: string[];
}

/**
 * LANG G6 — hiển thị một bản góp ý bài viết. Mọi chữ (tóm tắt, trích đoạn, bản sửa, giải thích) là text
 * node — React tự thoát HTML. Không bao giờ hiện số điểm (chỉ ba mức).
 */
export default function WritingFeedbackView({
  body,
  review,
  reviewerNote,
}: {
  body: WritingFeedbackBody;
  review: "unreviewed" | "approved";
  reviewerNote?: string | null;
}) {
  const t = useT();
  const lang = useUiLang();
  return (
    <div className="space-y-4" data-testid="writing-feedback-view">
      {review === "unreviewed" ? (
        <p className="banner-warning text-sm" role="note">
          <b>{t("practice.wf.v.unrevB")}</b> {t("practice.wf.v.unrev")}
        </p>
      ) : (
        <p className="banner-success text-sm" role="note">
          <b>{t("practice.wf.v.apprB")}</b> {t("practice.wf.v.appr")}
        </p>
      )}
      {review === "approved" && reviewerNote && (
        <p className="rounded border border-token px-3 py-2 text-sm">
          <span className="font-medium">{t("practice.wf.v.reviewerNote")}</span>
          {reviewerNote}
        </p>
      )}

      {body.summary && <p className="text-body">{body.summary}</p>}

      {body.criteria.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label={t("practice.wf.v.criteriaAria")}>
          {body.criteria.map((c) => {
            const lv = levelLabel(c.level, lang);
            return (
              <li key={c.key} className="rounded border border-token px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{criterionLabel(c.key, lang)}</span>
                  {lv && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lv.cls}`}>{lv.text}</span>}
                </div>
                {c.comment && <p className="text-meta mt-1">{c.comment}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-label={t("practice.wf.v.errorsAria")}>
        <h4 className="text-sm font-semibold">{t("practice.wf.v.errorsTitle", { n: body.errors.length })}</h4>
        {body.errors.length === 0 ? (
          <p className="text-meta mt-1">{t("practice.wf.v.noErrors")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {body.errors.map((e) => (
              <li key={e.id} className="rounded border border-token px-3 py-2 text-sm">
                <span className="mb-1 inline-block rounded bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-xs text-muted">
                  {categoryLabel(e.category, lang)}
                </span>
                <p>
                  <span className="rounded bg-red-50 px-1 text-red-800 line-through decoration-red-400">{e.quote}</span>
                  <span aria-hidden> → </span>
                  <span className="rounded bg-emerald-50 px-1 font-medium text-emerald-800">{e.correction}</span>
                </p>
                {e.explanation && <p className="text-meta mt-1">{e.explanation}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {body.nextSteps.length > 0 && (
        <section aria-label={t("practice.wf.v.next")}>
          <h4 className="text-sm font-semibold">{t("practice.wf.v.next")}</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {body.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
