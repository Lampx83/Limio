"use client";

import Link from "next/link";
import { FLASHCARD_RATINGS, type FlashcardRating } from "@feedbackme/shared-types";
import { useT } from "@/lib/i18n/client";

/**
 * LANG G4 — màn tổng kết cuối phiên. Chỉ số đếm theo mức tự đánh giá; không điểm,
 * không phần trăm.
 */
export default function FlashcardSummary({
  slug,
  summary,
  onMore,
}: {
  slug: string;
  summary: { total: number } & Record<FlashcardRating, number>;
  /** Có thì hiện nút "Ôn tiếp" (còn thẻ trong ngày). */
  onMore?: () => void;
}) {
  const t = useT();
  return (
    <section className="space-y-5 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center" aria-labelledby="fc-done">
      <h2 id="fc-done" className="text-h3">{t("practice.fc.sum.done", { n: summary.total })}</h2>
      <ul className="grid grid-cols-4 gap-2">
        {FLASHCARD_RATINGS.map((r) => (
          <li key={r} className="rounded-xl border border-token px-2 py-3">
            <p className="text-xl font-medium">{summary[r]}</p>
            <p className="text-caption">{t(`practice.fc.rating.${r}`)}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-2">
        {onMore && (
          <button type="button" onClick={onMore} className="btn-primary">
            {t("practice.fc.sum.more")}
          </button>
        )}
        <Link href={`/learn/${slug}`} className="btn-secondary">
          {t("practice.fc.sum.back")}
        </Link>
      </div>
    </section>
  );
}
