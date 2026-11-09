import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { LessonFrameData, LessonRailItem } from "@feedbackme/core-lms";
import { lessonViewHref, type LessonView } from "@/lib/lessonFrameView";

/**
 * LANG đợt 3a — khung bài học của vỏ Language (Figma "Chi tiết bài học"). Thuần trình bày: nhận dữ liệu đã tổng hợp,
 * không đọc DB. Bọc quanh trang bài hiện có; bài ngoài vỏ Language không đi qua đây.
 */

function ItemIcon({ state }: { state: LessonRailItem["state"] }) {
  if (state === "done")
    return (
      <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime-500 text-white">
        <Check size={11} strokeWidth={3} />
      </span>
    );
  if (state === "locked") return <Lock size={14} aria-hidden className="shrink-0 text-faint" />;
  return (
    <span
      aria-hidden
      className={`h-4 w-4 shrink-0 rounded-full border-2 ${state === "current" ? "border-lime-600 bg-lime-600" : "border-[rgb(var(--border))]"}`}
    />
  );
}

const STATE_TEXT: Record<LessonRailItem["state"], string> = {
  done: "Đã xong",
  current: "Đang xem",
  todo: "Chưa học",
  locked: "Đang khoá",
};

function RailList({ slug, frame }: { slug: string; frame: LessonFrameData }) {
  return (
    <ul className="mt-3 space-y-1">
      {frame.items.map((it) => {
        const row = (
          <>
            <ItemIcon state={it.state} />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm leading-snug ${it.state === "done" ? "text-muted" : ""} ${it.state === "current" ? "font-semibold" : ""}`}>{it.title}</span>
              <span className="text-caption text-muted">
                {[it.minutes ? `${it.minutes} phút` : null, it.state === "done" || it.state === "locked" ? STATE_TEXT[it.state] : null].filter(Boolean).join(" · ")}
              </span>
            </span>
          </>
        );
        const cls = `flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${it.state === "current" ? "bg-lime-50" : ""}`;
        return (
          <li key={it.id}>
            {it.state === "locked" ? (
              <div className={`${cls} opacity-70`} aria-disabled="true">
                {row}
              </div>
            ) : (
              <Link href={lessonViewHref(slug, it.id, "lesson")} aria-current={it.state === "current" ? "page" : undefined} className={`${cls} hover:bg-[rgb(var(--surface-muted))]`}>
                {row}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RailBody({ slug, frame, hasExams }: { slug: string; frame: LessonFrameData; hasExams: boolean }) {
  const pct = frame.unitTotal === 0 ? 0 : Math.round((frame.unitDone / frame.unitTotal) * 100);
  return (
    <div>
      <Link href={`/language?course=${encodeURIComponent(slug)}`} className="link text-sm">
        ← Về lộ trình
      </Link>
      <div className="mt-4 text-xs font-bold uppercase tracking-wider text-lime-700">Unit</div>
      <div className="text-h4 mt-0.5">{frame.unitTitle}</div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-lime-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-caption mt-1 text-muted">
        {frame.unitDone} / {frame.unitTotal} bài hoàn thành
      </p>
      <RailList slug={slug} frame={frame} />
      {hasExams && (
        <div className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
          <div className="text-sm font-bold">Sẵn sàng vận dụng?</div>
          <Link href={`/learn/${slug}#luyen-thi`} className="link mt-1 inline-block text-sm font-semibold">
            Luyện đề ↗
          </Link>
        </div>
      )}
    </div>
  );
}

/** Đường dẫn "Học / Khoá / Unit / Bài" phía trên nội dung. */
export function LessonCrumbs({ slug, courseTitle, unitTitle, lessonTitle }: { slug: string; courseTitle: string; unitTitle: string; lessonTitle: string }) {
  return (
    <nav aria-label="Vị trí bài học" className="text-caption flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted">
      <Link href="/language" className="hover:underline">
        Học
      </Link>
      <span aria-hidden>/</span>
      <Link href={`/learn/${slug}`} className="hover:underline">
        {courseTitle}
      </Link>
      <span aria-hidden>/</span>
      <span>{unitTitle}</span>
      <span aria-hidden>/</span>
      <span aria-current="page" className="font-medium text-[rgb(var(--text))]">
        {lessonTitle}
      </span>
    </nav>
  );
}

/** Tab "Bài học | Từ vựng · n" — chỉ dựng khi bài có từ vựng. */
export function LessonViewTabs({ slug, lessonId, view, vocabCount }: { slug: string; lessonId: string; view: LessonView; vocabCount: number }) {
  if (vocabCount <= 0) return null;
  const tabs: Array<[LessonView, string]> = [
    ["lesson", "Bài học"],
    ["vocab", `Từ vựng · ${vocabCount}`],
  ];
  return (
    <nav aria-label="Nội dung bài" className="mt-6 flex gap-1 border-b border-token">
      {tabs.map(([v, label]) => (
        <Link
          key={v}
          href={lessonViewHref(slug, lessonId, v)}
          aria-current={view === v ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === v ? "border-lime-600 font-semibold text-lime-800" : "border-transparent text-muted hover:text-[rgb(var(--text))]"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Chân trang: bài kế tiếp và nút đi tiếp; hết bài thì về lộ trình. */
export function LessonFooter({ slug, next }: { slug: string; next: LessonFrameData["next"] }) {
  return (
    <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-token pt-4">
      <p className="text-meta min-w-0">{next ? <>Tiếp theo: {next.title}</> : "Bạn đã tới bài cuối của khoá."}</p>
      {next ? (
        <Link href={lessonViewHref(slug, next.id, "lesson")} className="btn-primary btn-sm">
          Bài tập tiếp theo →
        </Link>
      ) : (
        <Link href={`/language?course=${encodeURIComponent(slug)}`} className="btn-primary btn-sm">
          Về lộ trình
        </Link>
      )}
    </footer>
  );
}

/**
 * Bố cục khung: từ `lg` thanh bài nằm bên trái; dưới `lg` thu thành khối mở/đóng "Bài trong unit" trên đầu bài.
 * `children` là chính trang bài hiện có.
 */
export default function LessonFrameLayout({
  slug,
  courseTitle,
  lessonTitle,
  frame,
  hasExams,
  children,
}: {
  slug: string;
  courseTitle: string;
  lessonTitle: string;
  frame: LessonFrameData;
  hasExams: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6 lg:px-6">
      <aside aria-label="Bài trong unit" className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6 pr-1">
          <RailBody slug={slug} frame={frame} hasExams={hasExams} />
        </div>
      </aside>
      <div className="min-w-0">
        <details className="mb-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold">
            Bài trong unit · {frame.unitDone} / {frame.unitTotal}
          </summary>
          <div className="mt-3">
            <RailBody slug={slug} frame={frame} hasExams={hasExams} />
          </div>
        </details>
        <LessonCrumbs slug={slug} courseTitle={courseTitle} unitTitle={frame.unitTitle} lessonTitle={lessonTitle} />
        {children}
      </div>
    </div>
  );
}
