import Link from "next/link";
import { Eye } from "lucide-react";
import { LIBRARY_FOCUS_LABEL, type LibraryFocusTag } from "@feedbackme/shared-types";
import type { LibraryCard as Card } from "@feedbackme/core-lms";
import { libraryByline, libraryPriceLabel } from "@/lib/libraryView";
import LibrarySaveButton from "./LibrarySaveButton";

/** Bìa giáo trình; khoá chưa có `coverUrl` thì ô thay thế mang chữ cái đầu (không ảnh vỡ). */
export function LibraryCover({ card, className = "" }: { card: Pick<Card, "title" | "coverUrl">; className?: string }) {
  return card.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={card.coverUrl} alt="" loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-lime-100 text-3xl font-bold text-lime-700 ${className}`}
    >
      {card.title.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

export function FocusChips({ tags }: { tags: LibraryFocusTag[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <li key={t} className="chip-brand">
          {LIBRARY_FOCUS_LABEL[t]}
        </li>
      ))}
    </ul>
  );
}

/** Nơi tên thẻ dẫn tới: đã ghi danh vào học, chưa thì trang giới thiệu/mua của khoá (nơi duy nhất cấp quyền). */
export function libraryCardHref(card: Pick<Card, "slug" | "enrolled">): string {
  return card.enrolled ? `/learn/${card.slug}` : `/catalog/${card.slug}`;
}

/**
 * Thẻ giáo trình trong lưới "Khám phá thêm". Thẻ KHÔNG cấp quyền học: "Học" chỉ hiện khi đã ghi danh còn hiệu lực;
 * chưa thì "Preview" (nếu có bài xem thử) và tên thẻ dẫn sang `/catalog/[slug]`.
 */
export default function LibraryCard({ card, paymentEnabled }: { card: Card; paymentEnabled: boolean }) {
  const byline = libraryByline(card);
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))]">
      <div className="p-4">
        <div className="flex gap-3">
          <LibraryCover card={card} className="h-28 w-20 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            {card.levelBand && <div className="text-xs font-semibold text-muted">{card.levelBand}</div>}
            <h3 className="text-h4 mt-0.5">
              <Link href={libraryCardHref(card)} className="hover:underline">
                {card.title}
              </Link>
            </h3>
            {byline && <p className="text-caption mt-0.5 text-muted">{byline}</p>}
          </div>
        </div>
        {card.excerpt && <p className="text-meta mt-3 line-clamp-3">{card.excerpt}</p>}
        <div className="mt-2">
          <FocusChips tags={card.focusTags} />
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-token px-4 py-3">
        <span className="mr-auto text-sm font-semibold text-muted">{card.enrolled ? "Đã ghi danh" : libraryPriceLabel(card, paymentEnabled)}</span>
        <LibrarySaveButton courseId={card.id} initialSaved={card.saved} />
        {card.enrolled ? (
          <Link href={`/learn/${card.slug}`} className="btn-primary btn-sm">
            Học
          </Link>
        ) : card.previewLessonId ? (
          <Link href={`/learn/${card.slug}/lessons/${card.previewLessonId}`} className="btn-ghost btn-sm inline-flex items-center gap-1.5">
            Preview <Eye size={14} aria-hidden />
          </Link>
        ) : (
          <Link href={`/catalog/${card.slug}`} className="btn-ghost btn-sm">
            Xem chi tiết
          </Link>
        )}
      </div>
    </li>
  );
}
