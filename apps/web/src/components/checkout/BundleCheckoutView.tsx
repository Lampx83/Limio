import Link from "next/link";
import type { BundleView } from "@feedbackme/core-lms";
import { PriceBlock } from "@/components/PriceTag";
import { formatPrice } from "@/lib/formatPrice";
import BookCover from "@/components/BookCover";
import TransferInstructions from "@/components/TransferInstructions";
import BundleBuyButton from "@/app/combo/[slug]/BundleBuyButton";
import BundleRedeemBox from "@/app/combo/[slug]/BundleRedeemBox";

function durationText(months: number | null): string {
  if (months === null) return "Truy cập vĩnh viễn";
  if (months % 12 === 0) return `Truy cập ${months / 12} năm`;
  return `Truy cập ${months} tháng`;
}

/** Giao diện trang thanh toán combo (docs/tieu-chi/trang-thanh-toan.md, AC2). Thuần trình bày. */
export default function BundleCheckoutView({
  bundle,
  ownedCount,
  gateways,
  transferInstructions,
}: {
  bundle: BundleView;
  /** Số khoá trong combo mà người mua đã có quyền. */
  ownedCount: number;
  gateways: Array<"vnpay" | "sepay" | "sepay_pg">;
  transferInstructions: string | null;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-16 lg:px-6">
      <Link href={`/combo/${bundle.slug}`} className="link text-sm">
        ← {bundle.title}
      </Link>
      <h1 className="h-display mt-4 text-2xl font-bold sm:text-3xl">Thanh toán</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start">
        <section className="card" aria-label="Tóm tắt đơn">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Bạn đang mua</h2>
          <h3 className="mt-3 text-lg font-bold leading-snug">{bundle.title}</h3>
          <p className="mt-1 text-sm text-muted">Gồm {bundle.courses.length} khoá, {durationText(bundle.durationMonths).toLowerCase()}.</p>
          <ul className="mt-4 grid grid-cols-5 gap-2 sm:gap-3" aria-label="Các khoá trong combo">
            {bundle.courses.map((c) => (
              <li key={c.id} className="min-w-0">
                {c.coverUrl ? (
                  <BookCover src={c.coverUrl} alt={c.title} />
                ) : (
                  <span className="block truncate text-xs">{c.title}</span>
                )}
              </li>
            ))}
          </ul>
          {ownedCount > 0 && (
            <p className="mt-4 text-xs text-muted">
              Bạn đã có {ownedCount}/{bundle.courses.length} khoá trong combo; mua combo sẽ gia hạn thêm thời hạn cho các khoá đó.
            </p>
          )}
        </section>

        <section className="card lg:sticky lg:top-6" aria-label="Thanh toán">
          <PriceBlock
            align="left"
            originalCents={bundle.originalPriceCents}
            saleCents={bundle.priceCents}
            currency={bundle.currency}
            note={durationText(bundle.durationMonths)}
          />
          {bundle.savingsCents !== null && (
            <p className="mt-3 text-sm font-semibold text-success-600" data-testid="bundle-savings">
              Tiết kiệm {formatPrice(bundle.savingsCents, bundle.currency)} so với mua lẻ từng quyển
            </p>
          )}
          <div className="mt-4 space-y-4">
            {gateways.length > 0 ? (
              <BundleBuyButton bundleId={bundle.id} slug={bundle.slug} providers={gateways} returnPath={`/checkout/combo/${bundle.slug}`} />
            ) : (
              <TransferInstructions text={transferInstructions} />
            )}
            <div id="ma-kich-hoat" className="scroll-mt-24">
              <BundleRedeemBox slug={bundle.slug} returnPath={`/checkout/combo/${bundle.slug}`} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
