import Link from "next/link";
import { LIBRARY_FOCUS_LABEL } from "@feedbackme/shared-types";
import type { LibraryPage } from "@feedbackme/core-lms";
import { hasLibraryFilter, libraryByline, libraryHref } from "@/lib/libraryView";
import EmptyState from "@/components/ui/EmptyState";
import LibraryCard, { FocusChips, LibraryCover } from "./LibraryCard";
import LibraryFilters from "./LibraryFilters";
import LibrarySaveButton from "./LibrarySaveButton";

const SORT_LABEL = { relevant: "Phù hợp nhất", newest: "Mới nhất", name: "Tên A–Z" } as const;

const FIELD = "w-full rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm";

/**
 * LANG đợt 2 — trang "Thư viện giáo trình" (Figma). Thuần trình bày: nhận `LibraryPage` đã tổng hợp, không đọc DB.
 * Bộ lọc là form GET (chạy được khi chưa có JavaScript); mọi trạng thái nằm trong URL.
 */
export default function LibraryView({ data, paymentEnabled }: { data: LibraryPage; paymentEnabled: boolean }) {
  const { query, facets } = data;
  const filtering = hasLibraryFilter(query);
  const featured = data.inProgress;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-h1">Thư viện giáo trình</h1>
        <p className="text-meta mt-1">Tìm giáo trình phù hợp, lưu lại và học theo lộ trình của bạn.</p>
      </header>

      <form method="get" action="/language/thu-vien" role="search" className="mt-5 space-y-3">
        {query.tab === "saved" && <input type="hidden" name="tab" value="saved" />}
        <label className="block">
          <span className="sr-only">Tìm giáo trình</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Tìm tên giáo trình, tác giả hoặc nhà xuất bản..."
            className={FIELD}
          />
        </label>
        <LibraryFilters defaultOpen={filtering || query.sort !== "relevant"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="text-caption text-muted">Nhà xuất bản</span>
              <select name="publisher" defaultValue={query.publisher} className={FIELD}>
                <option value="">Tất cả</option>
                {facets.publishers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-caption text-muted">Trình độ</span>
              <select name="level" defaultValue={query.level} className={FIELD}>
                <option value="">Tất cả</option>
                {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-caption text-muted">Kỹ năng</span>
              <select name="focus" defaultValue={query.focus} className={FIELD}>
                <option value="">Tất cả</option>
                {facets.focus.map((f) => (
                  <option key={f} value={f}>
                    {LIBRARY_FOCUS_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-caption text-muted">Sắp xếp</span>
              <select name="sort" defaultValue={query.sort} className={FIELD}>
                {Object.entries(SORT_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </LibraryFilters>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary btn-sm">
            Tìm
          </button>
          {(filtering || query.sort !== "relevant") && (
            <Link href={libraryHref({ ...query, q: "", publisher: "", level: "", focus: "", sort: "relevant" })} className="btn-ghost btn-sm">
              Xoá bộ lọc
            </Link>
          )}
        </div>
      </form>

      <nav aria-label="Danh sách" className="mt-5 flex gap-1 border-b border-token">
        {(
          [
            ["all", `Tất cả · ${data.totalAll}`],
            ["saved", `Đã lưu · ${data.savedCount}`],
          ] as const
        ).map(([tab, label]) => (
          <Link
            key={tab}
            href={libraryHref(query, { tab })}
            aria-current={query.tab === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              query.tab === tab ? "border-lime-600 font-semibold text-lime-800" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {data.totalAll === 0 ? (
        <div className="mt-6">
          <EmptyState title="Thư viện chưa có giáo trình nào" description="Giáo trình sẽ hiện ở đây khi giảng viên đưa khoá vào thư viện." />
        </div>
      ) : (
        <>
          {featured && (
            <section aria-labelledby="learning-title" className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 sm:p-5">
              <div className="flex gap-4">
                <LibraryCover card={featured.card} className="h-32 w-24 shrink-0 rounded-md sm:h-36 sm:w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip-success" id="learning-title">
                      Đang học
                    </span>
                    <FocusChips tags={featured.card.focusTags} />
                  </div>
                  <h2 className="text-h3 mt-2">{featured.card.title}</h2>
                  {libraryByline(featured.card) && <p className="text-meta">{libraryByline(featured.card)}</p>}
                  <p className="text-caption mt-2 text-muted">
                    {featured.unitTitle} · {featured.lessonTitle}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="min-w-[10rem] flex-1">
                  <div className="text-caption text-muted">
                    {featured.unitTitle} · {featured.unitDone} / {featured.unitTotal} bài
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
                    role="progressbar"
                    aria-valuenow={featured.unitTotal === 0 ? 0 : Math.round((featured.unitDone / featured.unitTotal) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-lime-500"
                      style={{ width: `${featured.unitTotal === 0 ? 0 : Math.round((featured.unitDone / featured.unitTotal) * 100)}%` }}
                    />
                  </div>
                </div>
                <LibrarySaveButton courseId={featured.card.id} initialSaved={featured.card.saved} />
                <Link href={`/learn/${featured.card.slug}/lessons/${featured.lessonId}`} className="btn-primary btn-sm">
                  Tiếp tục học
                </Link>
                <Link href={`/language?course=${encodeURIComponent(featured.card.slug)}`} className="link text-sm">
                  Mở lộ trình giáo trình ↗
                </Link>
              </div>
            </section>
          )}

          <section aria-labelledby="explore-title" className="mt-6">
            <h2 id="explore-title" className="text-h3">
              {featured ? "Khám phá thêm" : query.tab === "saved" ? "Giáo trình đã lưu" : "Giáo trình"}
            </h2>
            {data.cards.length === 0 ? (
              <div className="mt-3">
                {query.tab === "saved" && !filtering ? (
                  <EmptyState title="Bạn chưa lưu giáo trình nào" description="Bấm “Lưu” ở một giáo trình để xem lại nhanh tại đây." />
                ) : featured && !filtering ? (
                  <p className="text-meta">Chưa có giáo trình nào khác để khám phá.</p>
                ) : (
                  <EmptyState
                    title="Không có giáo trình phù hợp"
                    description="Thử bỏ bớt bộ lọc hoặc đổi từ khoá."
                    actions={[{ label: "Xoá bộ lọc", href: libraryHref({ ...query, q: "", publisher: "", level: "", focus: "", tab: "all" }), variant: "primary" }]}
                  />
                )}
              </div>
            ) : (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.cards.map((c) => (
                  <LibraryCard key={c.id} card={c} paymentEnabled={paymentEnabled} />
                ))}
              </ul>
            )}
          </section>

          {data.pageCount > 1 && (
            <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-3 text-sm">
              {query.page > 1 ? (
                <Link href={libraryHref(query, { page: query.page - 1 })} rel="prev" className="btn-ghost btn-sm">
                  ← Trang trước
                </Link>
              ) : (
                <span className="px-3 text-muted">← Trang trước</span>
              )}
              <span className="tabular-nums text-muted">
                Trang {query.page} / {data.pageCount}
              </span>
              {query.page < data.pageCount ? (
                <Link href={libraryHref(query, { page: query.page + 1 })} rel="next" className="btn-ghost btn-sm">
                  Trang sau →
                </Link>
              ) : (
                <span className="px-3 text-muted">Trang sau →</span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
