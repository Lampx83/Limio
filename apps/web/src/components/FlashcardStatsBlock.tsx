"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import type { FlashcardStats } from "@feedbackme/core-feedback";
import { reviewableToday } from "@/lib/flashcardSession";
import { useT } from "@/lib/i18n/client";

/**
 * LANG G4 — khối "Từ vựng" trên hồ sơ: ba số đếm và phân bố Mới / Đang học / Nhớ lâu.
 * Chỉ có số đếm — không phần trăm, không điểm. Khoá không có thẻ nào thì không dựng.
 */
export default function FlashcardStatsBlock({ slug, stats }: { slug: string; stats: FlashcardStats }) {
  const t = useT();
  if (stats.total === 0) return null;
  const { new: fresh, learning, mature } = stats.distribution;
  const n = reviewableToday(stats);

  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" aria-labelledby="fc-stats">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fc-stats" className="text-h4 flex items-center gap-2">
          <Layers size={18} aria-hidden />
          {t("practice.fc.stats.title")}
        </h2>
        {n > 0 ? (
          <Link href={`/learn/${slug}/flashcards`} className="btn-primary">{t("practice.fc.stats.review", { n })}</Link>
        ) : (
          <p className="text-meta">{t("practice.fc.stats.allDone")}</p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        {(
          [
            [t("practice.fc.stats.learned"), stats.learned],
            [t("practice.fc.stats.due"), stats.dueToday],
            [t("practice.fc.stats.struggling"), stats.struggling],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[rgb(var(--surface-muted))] p-3">
            <dt className="text-caption">{label}</dt>
            <dd className="text-xl font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div
        role="img"
        aria-label={t("practice.fc.stats.distAria", { a: fresh, b: learning, c: mature })}
        className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      >
        <div style={{ flex: fresh }} className="bg-gray-300" />
        <div style={{ flex: learning }} className="bg-brand-500" />
        <div style={{ flex: mature }} className="bg-success-500" />
      </div>
      <p className="text-caption mt-2 flex flex-wrap gap-x-4">
        <span>{t("practice.fc.stats.new", { n: fresh })}</span>
        <span>{t("practice.fc.stats.learning", { n: learning })}</span>
        <span>{t("practice.fc.stats.mature", { n: mature })}</span>
      </p>
    </section>
  );
}
