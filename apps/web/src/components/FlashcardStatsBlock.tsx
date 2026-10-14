import Link from "next/link";
import { Layers } from "lucide-react";
import type { FlashcardStats } from "@feedbackme/core-feedback";
import { reviewableToday } from "@/lib/flashcardSession";

/**
 * LANG G4 — khối "Từ vựng" trên hồ sơ: ba số đếm và phân bố Mới / Đang học / Nhớ lâu.
 * Chỉ có số đếm — không phần trăm, không điểm. Khoá không có thẻ nào thì không dựng.
 */
export default function FlashcardStatsBlock({ slug, stats }: { slug: string; stats: FlashcardStats }) {
  if (stats.total === 0) return null;
  const { new: fresh, learning, mature } = stats.distribution;
  const n = reviewableToday(stats);

  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" aria-labelledby="fc-stats">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fc-stats" className="text-h4 flex items-center gap-2">
          <Layers size={18} aria-hidden />
          Từ vựng
        </h2>
        {n > 0 ? (
          <Link href={`/learn/${slug}/flashcards`} className="btn-primary">{`Ôn ${n} thẻ`}</Link>
        ) : (
          <p className="text-meta">Hôm nay bạn đã ôn xong.</p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        {(
          [
            ["Đã học", stats.learned],
            ["Đến hạn hôm nay", stats.dueToday],
            ["Hay quên", stats.struggling],
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
        aria-label={`Mới ${fresh}, Đang học ${learning}, Nhớ lâu ${mature}`}
        className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      >
        <div style={{ flex: fresh }} className="bg-gray-300" />
        <div style={{ flex: learning }} className="bg-brand-500" />
        <div style={{ flex: mature }} className="bg-success-500" />
      </div>
      <p className="text-caption mt-2 flex flex-wrap gap-x-4">
        <span>{`Mới · ${fresh}`}</span>
        <span>{`Đang học · ${learning}`}</span>
        <span>{`Nhớ lâu · ${mature}`}</span>
      </p>
    </section>
  );
}
