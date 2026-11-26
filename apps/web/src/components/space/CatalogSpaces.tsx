import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import BookCover from "@/components/BookCover";
import { DiscountBadge, PriceStrike } from "@/components/PriceTag";
import { formatPrice } from "@/lib/formatPrice";
import type { CatalogSpaceCard } from "@/lib/space/catalogSpaces";

/**
 * Dải "Không gian học liệu" ở đầu /catalog: mỗi space đang bật là một thẻ gồm đầu thẻ (logo, tên, số khoá, "Xem tất cả" → trang chủ space)
 * và một hàng vài khoá tiêu biểu để xem trước (bìa sách, tên, giá). Trên điện thoại hàng khoá cuộn ngang. Không vẽ gì khi chưa có space nào.
 */
export default function CatalogSpaces({
  spaces,
  title,
  sub,
  openLabel,
  viewAllLabel,
  freeLabel,
}: {
  spaces: CatalogSpaceCard[];
  title: string;
  sub: string;
  /** Hàm dựng chữ "{n} khoá đang mở" theo ngôn ngữ giao diện. */
  openLabel: (n: number) => string;
  viewAllLabel: string;
  freeLabel: string;
}) {
  if (spaces.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="catalog-spaces-title">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1.5 shrink-0 rounded-full bg-brand-gradient" aria-hidden />
        <h2 id="catalog-spaces-title" className="h-display text-h3">
          {title}
        </h2>
      </div>
      <p className="mt-1 text-meta">{sub}</p>
      <ul className="mt-4 grid gap-4">
        {spaces.map((s) => (
          <li key={s.slug} className="rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <div className="flex items-center gap-3 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-soft">
                {s.limioBrand ? (
                  <LimeSliceIcon className="h-9 w-9" />
                ) : s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <span className="text-lg font-extrabold text-brand-700" aria-hidden>
                    {s.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block text-xs text-muted">{openLabel(s.openCount)}</span>
              </span>
              <Link
                href={s.href}
                prefetch={false}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-3.5 py-1.5 text-sm font-bold text-brand-700 hover:bg-brand-100"
              >
                {viewAllLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {s.previews.length > 0 && (
              <ul className="flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-5 md:overflow-visible" aria-label={s.name}>
                {s.previews.map((c) => (
                  <li key={c.slug} className="w-32 shrink-0 snap-start md:w-auto">
                    <Link href={`/catalog/${c.slug}`} prefetch={false} className="group block">
                      <BookCover src={c.coverUrl} alt="" />
                      <span className="mt-2 block line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand-600">{c.title}</span>
                      <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted">
                        {c.priceCents > 0 ? (
                          <>
                            <PriceStrike originalCents={c.originalPriceCents} saleCents={c.priceCents} currency={c.currency} />
                            <span className="font-semibold text-[rgb(var(--text))]">{formatPrice(c.priceCents, c.currency)}</span>
                            <DiscountBadge originalCents={c.originalPriceCents} saleCents={c.priceCents} />
                          </>
                        ) : (
                          <span className="font-semibold text-success-700">{freeLabel}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
