import Link from "next/link";
import { listPublishedCourses } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { htmlToPlainText } from "@/lib/richText";
import { getPaymentEnabled } from "@/lib/site-settings";
import { EmptyState } from "@/components/ui";

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

const LANG_LABEL: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
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

  // Build active-filter chips so user sees what's filtering even khi drawer đóng.
  const activeChips: Array<{ label: string; clearHref: string }> = [];
  const baseParams = (omit: keyof typeof searchParams) => {
    const p = new URLSearchParams();
    for (const k of ["q", "level", "language", "category"] as const) {
      if (k !== omit && searchParams[k]) p.set(k, searchParams[k]!);
    }
    const qs = p.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  };
  if (searchParams.q) activeChips.push({ label: `"${searchParams.q}"`, clearHref: baseParams("q") });
  if (searchParams.level)
    activeChips.push({ label: LEVEL_LABEL[searchParams.level] ?? searchParams.level, clearHref: baseParams("level") });
  if (searchParams.language)
    activeChips.push({ label: LANG_LABEL[searchParams.language] ?? searchParams.language, clearHref: baseParams("language") });
  if (searchParams.category)
    activeChips.push({ label: searchParams.category, clearHref: baseParams("category") });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-24 lg:pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-brand">Catalog</span>
          <h1 className="mt-3 h-display text-h1">Khám phá khóa học</h1>
          <p className="mt-2 text-meta">
            {items.length > 0
              ? `${items.length} khóa học đang được cộng đồng theo học`
              : "Chưa có khóa học nào được publish."}
          </p>
        </div>
        <Link href="/instructor/courses" className="btn-secondary btn-sm">
          Bạn là instructor? →
        </Link>
      </div>

      {/* Filters — collapsible on mobile via <details>, inline on lg+ */}
      <details
        className="group mt-8 rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card lg:open"
        open
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 lg:cursor-default">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden>🔍</span>
            Bộ lọc
            {activeChips.length > 0 && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-700">
                {activeChips.length}
              </span>
            )}
          </span>
          <span className="text-xs text-faint lg:hidden group-open:rotate-180 transition-transform">▾</span>
        </summary>

        <form className="flex flex-wrap gap-3 border-t border-token p-4" action="/catalog">
          <div className="relative flex-1 min-w-[220px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden>
              🔍
            </span>
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Tìm khóa học theo tên hoặc mô tả..."
              className="input pl-9"
              aria-label="Từ khoá tìm kiếm"
            />
          </div>
          <select
            name="level"
            defaultValue={searchParams.level ?? ""}
            className="select max-w-[160px]"
            aria-label="Cấp độ"
          >
            <option value="">Mọi level</option>
            <option value="beginner">Cơ bản</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </select>
          <select
            name="language"
            defaultValue={searchParams.language ?? ""}
            className="select max-w-[160px]"
            aria-label="Ngôn ngữ"
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
              aria-label="Danh mục"
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
              Xoá lọc
            </Link>
          )}
        </form>
      </details>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" role="list" aria-label="Bộ lọc đang áp dụng">
          {activeChips.map((c, i) => (
            <Link
              key={i}
              href={c.clearHref}
              role="listitem"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              aria-label={`Bỏ lọc ${c.label}`}
            >
              {c.label}
              <span aria-hidden>×</span>
            </Link>
          ))}
        </div>
      )}

      {/* Results */}
      {items.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon="🔎"
            title="Chưa tìm thấy khoá học phù hợp"
            description="Thử bỏ bớt bộ lọc hoặc xem tất cả khoá học đang publish."
            actions={hasFilter ? [{ label: "Xem tất cả khoá học", href: "/catalog" }] : undefined}
          />
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
                  <div
                    className="absolute inset-0 bg-hero-grid opacity-30"
                    style={{ backgroundSize: "16px 16px" }}
                    aria-hidden
                  />
                  <div className="absolute right-3 top-3 flex gap-1.5">
                    {c.language && (
                      <span className="rounded-md bg-white/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
                        {c.language}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-1.5">
                    {c.level && (
                      <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-brand-700 shadow">
                        {LEVEL_LABEL[c.level] ?? c.level}
                      </span>
                    )}
                    {c.category && (
                      <span className="rounded-md bg-white/30 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                        {c.category}
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="text-base font-semibold leading-snug transition-colors group-hover:text-brand-600">
                  {c.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{htmlToPlainText(c.description)}</p>

                <div className="mt-3 flex items-center gap-1.5">
                  {c.personalizationEnabled ? (
                    <span
                      className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"
                      title="AI feedback theo skill"
                    >
                      🤖 AI Feedback
                    </span>
                  ) : (
                    <span
                      className="rounded-md bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-[10px] font-semibold text-muted"
                      title="LMS truyền thống"
                    >
                      📚 Standard LMS
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-token pt-3 text-xs">
                  {paymentEnabled && !isFree(c.priceCents) ? (
                    <span className="font-semibold text-accent-600">
                      {formatPrice(c.priceCents!, c.currency)}
                    </span>
                  ) : (
                    <span className="font-semibold text-success-600">Miễn phí</span>
                  )}
                  <span className="ml-auto font-semibold text-brand-600 group-hover:text-brand-700">
                    Xem chi tiết →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
