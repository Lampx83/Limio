import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBundleBySlug, isAdmin, ownedCourseIdsInBundle } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SafeHtml from "@/components/SafeHtml";
import { DiscountBadge, PriceBlock, PriceStrike } from "@/components/PriceTag";
import { formatPrice } from "@/lib/formatPrice";

export const dynamic = "force-dynamic";

/** Trang công khai của combo (docs/tieu-chi/combo-khoa-hoc.md, AC3). */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = await getBundleBySlug(params.slug);
  return { title: b ? `${b.title} | Limio` : "Combo | Limio" };
}

function durationText(months: number | null): string {
  if (months === null) return "Truy cập vĩnh viễn";
  if (months % 12 === 0) return `Truy cập ${months / 12} năm`;
  return `Truy cập ${months} tháng`;
}

export default async function BundlePage({ params }: { params: { slug: string } }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const admin = userId ? await isAdmin(userId) : false;

  const bundle = await getBundleBySlug(params.slug, { allowDraft: admin });
  if (!bundle) notFound();

  const owned = userId ? await ownedCourseIdsInBundle(userId, bundle.id) : [];
  const ownedSet = new Set(owned);
  const isDraft = bundle.status !== "published";
  const reason = !bundle.purchasable ? "Combo chưa mở bán: còn khoá chưa xuất bản." : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <Link href="/catalog" className="link text-sm">
        ← Danh mục khoá học
      </Link>

      <header className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {isDraft && <span className="mb-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Nháp (chỉ admin thấy)</span>}
          <h1 className="h-display text-2xl font-bold sm:text-3xl">{bundle.title}</h1>
          {bundle.description && <SafeHtml html={bundle.description} className="prose-sm mt-3 max-w-none text-muted" />}
        </div>

        <aside className="card self-start lg:sticky lg:top-6" aria-label="Giá combo">
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
          <div className="mt-4 space-y-2">
            {bundle.purchasable && bundle.currency === "VND" ? (
              <>
                <Link href={`/checkout/combo/${bundle.slug}`} prefetch={false} className="btn btn-primary w-full text-center" id="bundle-buy">
                  Mua trọn bộ
                </Link>
                <Link href={`/checkout/combo/${bundle.slug}#ma-kich-hoat`} prefetch={false} className="block text-xs text-muted underline-offset-2 hover:underline">
                  Đã có mã kích hoạt?
                </Link>
              </>
            ) : (
              <p className="text-xs text-muted">{reason ?? "Combo tạm thời chưa mua được."}</p>
            )}
          </div>
          {owned.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Bạn đã có {owned.length}/{bundle.courses.length} khoá trong combo; mua combo sẽ gia hạn thêm thời hạn cho các khoá đó.
            </p>
          )}
        </aside>
      </header>

      <section className="mt-10" aria-labelledby="bundle-courses">
        <h2 id="bundle-courses" className="text-xl font-semibold">
          Gồm {bundle.courses.length} khoá
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundle.courses.map((c) => (
            <li key={c.id} className="card flex flex-col gap-3 p-4">
              {c.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverUrl} alt="" className="aspect-[190/260] w-full rounded-lg object-cover" loading="lazy" />
              )}
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">
                  <Link href={`/catalog/${c.slug}`} className="hover:underline">
                    {c.title}
                  </Link>
                </h3>
                <p className="mt-1 text-xs text-faint">{c.lessonCount} bài học</p>
              </div>
              <div className="mt-auto flex items-center justify-between text-sm">
                {c.retailCents > 0 && c.retailCurrency === bundle.currency ? (
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-faint" data-testid="bundle-course-price">
                    <PriceStrike originalCents={c.originalPriceCents} saleCents={c.retailCents} currency={c.retailCurrency} />
                    <span>Mua lẻ {formatPrice(c.retailCents, c.retailCurrency)}</span>
                    <DiscountBadge originalCents={c.originalPriceCents} saleCents={c.retailCents} />
                  </span>
                ) : (
                  <span />
                )}
                {ownedSet.has(c.id) && <span className="rounded bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">Đã có</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
