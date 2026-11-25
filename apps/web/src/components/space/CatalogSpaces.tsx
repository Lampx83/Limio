import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import type { CatalogSpaceCard } from "@/lib/space/catalogSpaces";

/**
 * Dải "Không gian học liệu" ở đầu /catalog: mỗi space đang bật là một thẻ dẫn sang trang chủ của space.
 * Không vẽ gì khi chưa có space nào.
 */
export default function CatalogSpaces({
  spaces,
  title,
  sub,
  openLabel,
}: {
  spaces: CatalogSpaceCard[];
  title: string;
  sub: string;
  /** Hàm dựng chữ "{n} khoá đang mở" theo ngôn ngữ giao diện. */
  openLabel: (n: number) => string;
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
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.map((s) => (
          <li key={s.slug}>
            <Link
              href={s.href}
              prefetch={false}
              className="group flex items-center gap-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
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
              <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
