import Link from "next/link";
import { listPublishedCourses } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { getPaymentEnabled } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getDistinctCategories(): Promise<string[]> {
  const rows = await prisma.course.findMany({
    where: { status: "published", category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  });
  return rows
    .map((r) => r.category)
    .filter((c): c is string => !!c)
    .sort();
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { category?: string; level?: string; language?: string; q?: string };
}) {
  const [{ items }, categories, paymentEnabled] = await Promise.all([
    listPublishedCourses({
      category: searchParams.category,
      level: searchParams.level,
      language: searchParams.language,
      q: searchParams.q,
    }),
    getDistinctCategories(),
    getPaymentEnabled(),
  ]);

  const hasFilter =
    !!(searchParams.q || searchParams.level || searchParams.language || searchParams.category);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-brand">Catalog</span>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
            Khám phá khóa học
          </h1>
          <p className="mt-2 text-muted">
            {items.length > 0
              ? `${items.length} khóa học đang được cộng đồng theo học`
              : "Chưa có khóa học nào được publish."}
          </p>
        </div>
        <Link href="/instructor/courses" className="btn-secondary btn-sm">
          Bạn là instructor? →
        </Link>
      </div>

      {/* Filters */}
      <form
        className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card"
        action="/catalog"
      >
        <div className="relative flex-1 min-w-[220px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            
          </span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Tìm khóa học theo tên hoặc mô tả..."
            className="input pl-9"
          />
        </div>
        <select name="level" defaultValue={searchParams.level ?? ""} className="select max-w-[160px]">
          <option value="">Mọi level</option>
          <option value="beginner">Cơ bản</option>
          <option value="intermediate">Trung cấp</option>
          <option value="advanced">Nâng cao</option>
        </select>
        <select
          name="language"
          defaultValue={searchParams.language ?? ""}
          className="select max-w-[160px]"
        >
          <option value="">Mọi ngôn ngữ</option>
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
        {categories.length > 0 && (
          <select
            name="category"
            defaultValue={searchParams.category ?? ""}
            className="select max-w-[180px]"
          >
            <option value="">Mọi danh mục</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <button className="btn-primary">Lọc</button>
        {hasFilter && (
          <Link href="/catalog" className="btn-ghost btn-sm">
            Xóa lọc
          </Link>
        )}
      </form>

      {/* Results */}
      {items.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                      </div>
          <p className="mt-4 text-muted">
            Chưa tìm thấy khóa học phù hợp. Thử điều chỉnh bộ lọc nhé.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, idx) => (
            <li
              key={c.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(idx * 40, 280)}ms` }}
            >
              <Link href={`/catalog/${c.slug}`} className="card-hover group block h-full">
                {/* cover-style header */}
                <div className="relative -m-5 mb-4 h-24 overflow-hidden rounded-t-xl bg-brand-gradient">
                  <div className="absolute inset-0 bg-hero-grid opacity-30" style={{ backgroundSize: "16px 16px" }} aria-hidden />
                  <div className="absolute right-3 top-3 flex gap-1.5">
                    {c.language && (
                      <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">
                        {c.language}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-1.5">
                    {c.level && (
                      <span className="rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        {LEVEL_LABEL[c.level] ?? c.level}
                      </span>
                    )}
                    {c.category && (
                      <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        {c.category}
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="text-base font-semibold leading-snug transition-colors group-hover:text-brand-600">
                  {c.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{c.description}</p>

                <div className="mt-4 flex items-center justify-between border-t border-token pt-3 text-xs text-faint">
                  {paymentEnabled && !isFree(c.priceCents) && (
                    <span className="font-semibold text-accent-600">
                      {formatPrice(c.priceCents!, c.currency)}
                    </span>
                  )}
                  <span className="ml-auto">Khám phá →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
