import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { LessonFrameData, LessonRailItem } from "@feedbackme/core-lms";
import { lessonViewHref, type LessonView } from "@/lib/lessonFrameView";
import LessonFrameShell from "./LessonFrameShell";

/**
 * Khung bài học 3 cột (Figma "Chi tiết bài học"): thanh bài trong unit/module · nội dung · panel AI trợ giảng + Ghi chú. Làm ở
 * LANG đợt 3a, mở cho MỌI khoá (docs/tieu-chi/limio-language-bai-hoc-3-cot.md). Thuần trình bày: nhận dữ liệu đã tổng hợp,
 * không đọc DB. Bọc quanh trang bài hiện có; điều kiện dùng khung ở `lib/lessonFramePolicy.ts`.
 */

function ItemIcon({ state }: { state: LessonRailItem["state"] }) {
  if (state === "done")
    return (
      <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
        <Check size={11} strokeWidth={3} />
      </span>
    );
  if (state === "locked") return <Lock size={14} aria-hidden className="shrink-0 text-faint" />;
  return (
    <span
      aria-hidden
      className={`h-4 w-4 shrink-0 rounded-full border-2 ${state === "current" ? "border-brand-600 bg-brand-600" : "border-[rgb(var(--border))]"}`}
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
        const cls = `flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${it.state === "current" ? "bg-brand-50" : ""}`;
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

function RailBody({ slug, frame, hasExams, levelLabel }: { slug: string; frame: LessonFrameData; hasExams: boolean; levelLabel: string }) {
  const pct = frame.unitTotal === 0 ? 0 : Math.round((frame.unitDone / frame.unitTotal) * 100);
  return (
    <div>
      <Link href={`/learn/${slug}`} className="link text-sm">
        ← Về khoá học
      </Link>
      <div className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-700">{levelLabel}</div>
      <div className="text-h4 mt-0.5">{frame.unitTitle}</div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-caption mt-1 text-muted">
        {frame.unitDone} / {frame.unitTotal} bài hoàn thành
      </p>
      <RailList slug={slug} frame={frame} />
      {hasExams && (
        <div className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
          <div className="text-sm font-bold">Sẵn sàng vận dụng?</div>
          <Link href={`/learn/${slug}#luyen-thi`} className="link mt-1 inline-block text-sm font-semibold">
            Thi thử ↗
          </Link>
        </div>
      )}
    </div>
  );
}

/** Đường dẫn "Học / Khoá / Unit|Module / Bài" phía trên nội dung (`levelLabel` chỉ dùng cho tên truy cập; chữ hiển thị là tên cấp trên). */
export function LessonCrumbs({ slug, courseTitle, unitTitle, lessonTitle }: { slug: string; courseTitle: string; unitTitle: string; lessonTitle: string }) {
  return (
    <nav aria-label="Vị trí bài học" className="text-caption flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted">
      <Link href="/me/dashboard" className="hover:underline">
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
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === v ? "border-brand-600 font-semibold text-brand-800" : "border-transparent text-muted hover:text-[rgb(var(--text))]"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Rút gọn tên bài để vừa thanh điều hướng. */
function short(t: string, n = 38): string {
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Thanh "← Bài trước / Bài tiếp theo →" cố định ở đáy cột nội dung (thầy chốt 10/11/2026): theo thứ tự bài trong khoá, bỏ qua
 * bài khoá; bài đầu không có "Bài trước"; bài cuối thay "Bài tiếp theo" bằng "Về khoá học". Không đánh dấu hoàn thành.
 */
export function LessonNavBar({ slug, prev, next }: { slug: string; prev: LessonFrameData["prev"]; next: LessonFrameData["next"] }) {
  return (
    <nav
      aria-label="Chuyển bài"
      className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-token bg-[rgb(var(--surface)/0.94)] px-4 py-2 backdrop-blur lg:mx-0 lg:rounded-t-xl"
    >
      {prev ? (
        <Link href={lessonViewHref(slug, prev.id, "lesson")} className="btn-ghost btn-sm inline-flex min-w-0 items-center gap-1.5" title={prev.title}>
          <span aria-hidden>←</span>
          <span className="shrink-0">Bài trước</span>
          <span className="hidden min-w-0 truncate text-muted md:inline">· {short(prev.title)}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <Link href={lessonViewHref(slug, next.id, "lesson")} className="btn-primary btn-sm inline-flex min-w-0 items-center gap-1.5" title={next.title}>
          <span className="shrink-0">Bài tiếp theo</span>
          <span className="hidden min-w-0 truncate opacity-90 md:inline">· {short(next.title)}</span>
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <Link href={`/learn/${slug}`} className="btn-primary btn-sm">
          Về khoá học
        </Link>
      )}
    </nav>
  );
}

/**
 * Bố cục khung: từ `lg` thanh bài nằm bên trái; dưới `lg` thu thành khối mở/đóng "Bài trong unit|module" trên đầu bài. Cột phải
 * (AI trợ giảng + Ghi chú) và thanh Bài trước/Bài tiếp theo do `LessonFrameShell` dựng. `children` là chính trang bài hiện có.
 */
export default function LessonFrameLayout({
  slug,
  lessonId,
  courseTitle,
  lessonTitle,
  frame,
  hasExams,
  levelLabel,
  notesCount,
  children,
}: {
  slug: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  frame: LessonFrameData;
  hasExams: boolean;
  /** "Unit" (khoá ngoại ngữ) hoặc "Module" (khoá khác). */
  levelLabel: string;
  /** Số ghi chú của học viên cho bài này (hiện ở tab "Ghi chú · n" trước khi mở panel). */
  notesCount: number;
  children: React.ReactNode;
}) {
  const levelLower = levelLabel.toLowerCase();
  return (
    <LessonFrameShell
      lessonId={lessonId}
      notesCount={notesCount}
      rail={<RailBody slug={slug} frame={frame} hasExams={hasExams} levelLabel={levelLabel} />}
      railLabel={`Bài trong ${levelLower}`}
      railSummary={`Bài trong ${levelLower} · ${frame.unitDone} / ${frame.unitTotal}`}
      crumbs={<LessonCrumbs slug={slug} courseTitle={courseTitle} unitTitle={frame.unitTitle} lessonTitle={lessonTitle} />}
      nav={<LessonNavBar slug={slug} prev={frame.prev} next={frame.next} />}
    >
      {children}
    </LessonFrameShell>
  );
}
