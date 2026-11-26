import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BundleView } from "@feedbackme/core-lms";
import BookCover from "@/components/BookCover";
import { PriceBlock } from "@/components/PriceTag";
import { formatPrice } from "@/lib/formatPrice";
import { bundleDurationText } from "@/lib/space/hskBundles";
import type { SpaceLang } from "@/lib/space/types";

const UI = {
  vi: {
    title: "Mua trọn bộ, tiết kiệm hơn",
    sub: "Học đủ cả giáo trình: một lần thanh toán, mở mọi quyển, giá thấp hơn mua lẻ từng quyển.",
    buy: "Xem trọn bộ",
    books: (n: number) => `Gồm ${n} khoá`,
    saving: (v: string) => `Tiết kiệm ${v} so với mua lẻ`,
  },
  en: {
    title: "Buy the full set and save",
    sub: "Get the whole curriculum in one payment: every book unlocked, priced below buying them one by one.",
    buy: "View the full set",
    books: (n: number) => `${n} courses`,
    saving: (v: string) => `Save ${v} compared with buying separately`,
  },
} as const;

/**
 * Khối "Trọn bộ" ở trang chủ space (dùng cho cả giao diện Limio và giao diện space thường). Màu lấy từ biến --sp* của
 * thẻ ngoài cùng. Không vẽ gì khi không có combo nào.
 */
export default function SpaceBundles({ bundles, lang, rounded = "rounded-3xl" }: { bundles: BundleView[]; lang: SpaceLang; rounded?: string }) {
  if (bundles.length === 0) return null;
  const t = UI[lang];
  return (
    <section id="combo" className="scroll-mt-4 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
      <h2 className="flex items-center gap-3 text-3xl font-extrabold leading-tight tracking-tight text-[color:var(--sp)] sm:text-4xl">
        <span className="h-8 w-1.5 shrink-0 rounded-full bg-[var(--sp-accent)]" aria-hidden />
        {t.title}
      </h2>
      <p className="mt-3 max-w-2xl text-slate-600">{t.sub}</p>
      <ul className="mt-8 grid gap-5">
        {bundles.map((b) => (
          <BundleCard key={b.id} bundle={b} lang={lang} rounded={rounded} />
        ))}
      </ul>
      </div>
    </section>
  );
}

function BundleCard({ bundle, lang, rounded }: { bundle: BundleView; lang: SpaceLang; rounded: string }) {
  const t = UI[lang];
  return (
    <li>
      <Link
        href={`/combo/${bundle.slug}`}
        prefetch={false}
        className={`group grid gap-6 overflow-hidden border border-[color:var(--sp-soft)] bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--sp)] hover:shadow-card-hover lg:grid-cols-[1fr_auto] lg:items-center lg:p-8 ${rounded}`}
      >
        <div className="min-w-0">
          <p className="inline-flex rounded-full bg-[var(--sp-soft)] px-3 py-1 text-xs font-bold text-[color:var(--sp)]">{t.books(bundle.courses.length)}</p>
          <h3 className="mt-3 text-2xl font-extrabold leading-snug text-slate-900">{bundle.title}</h3>
          <ul className="mt-5 grid max-w-xl grid-cols-5 gap-2 sm:gap-3" aria-label={t.books(bundle.courses.length)}>
            {bundle.courses.slice(0, 10).map((c, i) => (
              <li key={c.id} className="min-w-0">
                <BookCover
                  src={c.coverUrl}
                  alt={c.title}
                  fallback={<span className="text-lg font-extrabold text-[color:var(--sp)]">{i + 1}</span>}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4 lg:min-w-[15rem] lg:items-end">
          <PriceBlock
            align="left"
            originalCents={bundle.originalPriceCents}
            saleCents={bundle.priceCents}
            currency={bundle.currency}
            note={bundleDurationText(bundle.durationMonths, lang)}
          />
          {bundle.savingsCents !== null && (
            <p className="text-sm font-semibold text-emerald-700">{t.saving(formatPrice(bundle.savingsCents, bundle.currency))}</p>
          )}
          <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--sp)] px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform group-hover:translate-x-0.5">
            {t.buy}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}
