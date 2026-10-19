import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { ExamError, getPracticeLibrarySummary, listPracticeLibrary } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import { formatPrice } from "@/lib/formatPrice";
import { PAPER_TYPE_TEXT, libraryQueryString, parseLibraryParams } from "@/lib/practiceLibraryQuery";
import EmptyState from "@/components/ui/EmptyState";
import PracticeLibraryList from "@/components/practice/PracticeLibraryList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thư viện đề", ...NOINDEX };

const STATUS_OPTIONS = [
  ["", "Mọi trạng thái"],
  ["not_started", "Chưa làm"],
  ["in_progress", "Đang làm"],
  ["done", "Đã làm"],
  ["redo", "Nên làm lại"],
] as const;
const SORT_OPTIONS = [
  ["seq", "Theo thứ tự"],
  ["unstarted", "Chưa làm trước"],
  ["newest", "Mới nhất"],
] as const;

/**
 * LANG L6 — trang của khoá luyện đề (practice_bank): thư viện vài trăm đề. Người chưa mua vẫn xem được danh sách và
 * làm các đề học thử miễn phí; đề còn lại khoá kèm nút mua. Bộ lọc nằm trong URL (form GET), trang đầu dựng ở máy chủ.
 */
export default async function PracticeLibraryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}/practice`);
  const course = await prisma.course.findUnique({ where: { slug: params.slug }, select: { id: true, kind: true, title: true, slug: true } });
  if (!course) notFound();
  // Khoá thường không có thư viện: về trang khoá như trước.
  if (course.kind !== "practice_bank") redirect(`/learn/${params.slug}`);

  const filters = parseLibraryParams(searchParams);
  let summary, page;
  try {
    [summary, page] = await Promise.all([
      getPracticeLibrarySummary(session.user.id, course.id),
      listPracticeLibrary(session.user.id, course.id, filters),
    ]);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }
  const { cursor: _c, ...base } = filters;
  const queryString = libraryQueryString(base);
  const withParam = (k: string, v: string) => {
    const p = new URLSearchParams(queryString);
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("cursor");
    const s = p.toString();
    return `/learn/${params.slug}/practice${s ? `?${s}` : ""}`;
  };
  const pct = summary.totalExams > 0 ? Math.round((summary.doneExams / summary.totalExams) * 100) : 0;
  const price = summary.course.priceCents ? formatPrice(summary.course.priceCents, summary.course.currency) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-h1">{summary.course.title}</h1>
        <p className="text-meta mt-1">
          {summary.totalExams} đề · mỗi đề làm được theo hai chế độ: <b>Luyện đề</b> (không giới hạn thời gian) và <b>Phòng thi mô phỏng</b> (bấm giờ như thi thật).
        </p>
      </header>

      {!summary.enrolled && (
        <section className="mt-5 rounded-xl border border-lime-300 bg-lime-50 p-4" aria-label="Mua khoá">
          <p className="font-medium">Bạn đang xem thư viện.</p>
          <p className="text-sm text-muted">
            {summary.previewExams > 0 ? `${summary.previewExams} đề học thử miễn phí làm được ngay; ` : ""}các đề còn lại mở khi bạn mua khoá{price ? ` (${price})` : ""}.
          </p>
          <Link href={`/catalog/${params.slug}`} className="btn-primary btn-sm mt-3 inline-block">
            Xem khoá và đăng ký
          </Link>
        </section>
      )}

      {summary.enrolled && (
        <section className="mt-5 rounded-xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Tiến độ">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">Tiến độ khoá</span>
            <span className="tabular-nums text-sm text-muted">Đã làm {summary.doneExams}/{summary.totalExams} đề</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ làm đề">
            <div className="h-full rounded-full bg-brand-700" style={{ width: `${pct}%` }} />
          </div>
          {summary.redoExams > 0 && (
            <p className="mt-3 border-t border-token pt-3 text-sm">
              Gợi ý: có <b>{summary.redoExams}</b> đề bạn đã làm nhưng còn ở mức “Cần ôn” —{" "}
              <Link className="link" href={`/learn/${params.slug}/practice?s=redo`}>xem các đề nên làm lại</Link>.
            </p>
          )}
          {summary.inProgress.length > 0 && (
            <div className="mt-3 border-t border-token pt-3">
              <div className="text-sm font-medium">Tiếp tục</div>
              <ul className="mt-1 space-y-1 text-sm">
                {summary.inProgress.map((x) => (
                  <li key={`${x.kind}-${x.refId}`}>
                    <Link className="link" href={`/learn/${params.slug}/exams/${x.examId}${x.kind === "practice" ? "/practice" : ""}`}>
                      {x.title}
                    </Link>{" "}
                    <span className="text-muted">— {x.kind === "practice" ? "đang luyện" : "đang thi thử"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {summary.collections.length + (summary.unassigned.count > 0 ? 1 : 0) > 1 && (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Bộ đề">
          <Chip href={withParam("c", "")} active={!filters.collectionId}>Tất cả ({summary.totalExams})</Chip>
          {summary.collections.map((c) => (
            <Chip key={c.id} href={withParam("c", c.id)} active={filters.collectionId === c.id}>
              {c.title} ({c.count}{summary.enrolled ? ` · ${c.done} đã làm` : ""})
            </Chip>
          ))}
          {summary.unassigned.count > 0 && (
            <Chip href={withParam("c", "none")} active={filters.collectionId === "none"}>Khác ({summary.unassigned.count})</Chip>
          )}
        </nav>
      )}

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3" aria-label="Lọc đề">
        {filters.collectionId && <input type="hidden" name="c" value={filters.collectionId} />}
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="text-caption block text-muted">Tìm đề</span>
          <input name="q" defaultValue={filters.q ?? ""} className="input mt-1 w-full" placeholder="Tên, nguồn, tag…" />
        </label>
        <Select name="t" label="Loại" value={filters.paperType ?? ""} options={[["", "Mọi loại"], ...Object.entries(PAPER_TYPE_TEXT)]} />
        {summary.enrolled && <Select name="s" label="Của tôi" value={filters.status ?? ""} options={STATUS_OPTIONS.map(([v, l]) => [v, l])} />}
        <Select name="d" label="Độ khó" value={filters.difficulty ? String(filters.difficulty) : ""} options={[["", "Mọi độ khó"], ...[1, 2, 3, 4, 5].map((n) => [String(n), `${n}/5`])]} />
        <Select name="sort" label="Sắp xếp" value={filters.sort ?? "seq"} options={SORT_OPTIONS.map(([v, l]) => [v, l])} />
        <button type="submit" className="btn-primary btn-sm">Lọc</button>
        {queryString && <Link href={`/learn/${params.slug}/practice`} className="btn-ghost btn-sm">Xoá lọc</Link>}
      </form>

      <div className="mt-4">
        {page.items.length === 0 ? (
          <EmptyState
            title={summary.totalExams === 0 ? "Chưa có đề nào" : "Không có đề phù hợp"}
            description={summary.totalExams === 0 ? "Giảng viên chưa mở đề nào trong khoá này." : "Thử bỏ bớt bộ lọc hoặc đổi từ khoá."}
          />
        ) : (
          // key theo bộ lọc: đổi bộ lọc ⇒ dựng lại danh sách (không giữ các trang đã nối của bộ lọc cũ).
          <PracticeLibraryList key={queryString} slug={params.slug} courseId={course.id} initial={page} queryString={queryString} />
        )}
      </div>
    </main>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${active ? "border-brand-600 bg-brand-100 font-medium text-brand-800" : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"}`}
    >
      {children}
    </Link>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: ReadonlyArray<readonly string[]> }) {
  return (
    <label className="text-sm">
      <span className="text-caption block text-muted">{label}</span>
      <select name={name} defaultValue={value} className="select mt-1">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
