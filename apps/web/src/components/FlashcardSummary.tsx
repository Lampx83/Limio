import Link from "next/link";
import { FLASHCARD_RATINGS, FLASHCARD_RATING_LABEL, type FlashcardRating } from "@feedbackme/shared-types";

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
  return (
    <section className="space-y-5 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center" aria-labelledby="fc-done">
      <h2 id="fc-done" className="text-h3">{`Bạn đã ôn ${summary.total} thẻ`}</h2>
      <ul className="grid grid-cols-4 gap-2">
        {FLASHCARD_RATINGS.map((r) => (
          <li key={r} className="rounded-xl border border-token px-2 py-3">
            <p className="text-xl font-medium">{summary[r]}</p>
            <p className="text-caption">{FLASHCARD_RATING_LABEL[r]}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-2">
        {onMore && (
          <button type="button" onClick={onMore} className="btn-primary">
            Ôn tiếp
          </button>
        )}
        <Link href={`/learn/${slug}`} className="btn-secondary">
          Về trang khoá học
        </Link>
      </div>
    </section>
  );
}
