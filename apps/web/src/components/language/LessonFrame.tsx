import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { LessonFrameData, LessonRailItem } from "@feedbackme/core-lms";
import { lessonViewHref, previewHref, type LessonView } from "@/lib/lessonFrameView";
import LessonFrameShell from "./LessonFrameShell";
import LessonTocDrawer from "@/components/lesson/LessonTocDrawer";
import { tFor } from "@/lib/i18n/tFor";
import LessonVideoBadge from "@/components/ui/LessonVideoBadge";
import type { LessonVideoInfo } from "@/lib/lessonVideo";
import type { UiLang } from "@/lib/i18n/core";

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

const STATE_KEY = {
  done: "learn.rail.state.done",
  current: "learn.rail.state.current",
  todo: "learn.rail.state.todo",
  locked: "learn.rail.state.locked",
} as const satisfies Record<LessonRailItem["state"], string>;

function RailList({ slug, frame, preview, lang, videos }: { slug: string; frame: LessonFrameData; preview?: boolean; lang?: UiLang; videos?: ReadonlyMap<string, LessonVideoInfo> }) {
  const t = tFor(lang);
  return (
    <ul className="mt-3 space-y-1">
      {frame.items.map((it) => {
        const row = (
          <>
            <ItemIcon state={it.state} />
            <span className="min-w-0 flex-1">
              {/* Mọi dòng CÙNG độ đậm: thanh bên hẹp, chữ đậm rộng hơn nên bài đang xem xuống dòng khác các bài còn lại và danh sách "nhảy"
                  mỗi khi đổi bài. Bài đang xem phân biệt bằng nền, chấm đặc và vạch trái (không đổi bề rộng chữ). */}
              <span className={`block text-sm font-medium leading-snug ${it.state === "done" ? "text-muted" : ""}`}>
                {it.title}
                {videos?.has(it.id) && <LessonVideoBadge label={t("learn.video.has")} className="ml-1.5 align-middle" />}
              </span>
              <span className="text-caption text-muted">
                {[it.minutes ? t("learn.minutes", { n: it.minutes }) : null, it.state === "done" || it.state === "locked" ? t(STATE_KEY[it.state]) : null].filter(Boolean).join(" · ")}
              </span>
            </span>
          </>
        );
        const cls = `flex items-start gap-2.5 rounded-lg border-l-2 px-2.5 py-2 ${it.state === "current" ? "border-brand-600 bg-brand-50" : "border-transparent"}`;
        return (
          <li key={it.id}>
            {it.state === "locked" ? (
              <div className={`${cls} opacity-70`} aria-disabled="true">
                {row}
              </div>
            ) : (
              <Link href={lessonViewHref(slug, it.id, "lesson", preview)} aria-current={it.state === "current" ? "page" : undefined} className={`${cls} hover:bg-[rgb(var(--surface-muted))]`}>
                {row}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type TocModules = React.ComponentProps<typeof LessonTocDrawer>["modules"];

/**
 * Đầu thanh bên: có ảnh bìa giáo trình thì hiện bìa nhỏ, liên kết "← Về khoá học" nằm DƯỚI bìa trên một dòng (bấm bìa cũng về trang khoá; không ghi tên
 * sách, bìa đã đủ nhận diện); chưa có bìa thì chỉ còn liên kết như cũ. Ảnh trang trí nên alt rỗng.
 */
export function RailCourseHeader({ slug, coverUrl, preview, lang }: { slug: string; coverUrl: string | null; preview?: boolean; lang?: UiLang }) {
  const t = tFor(lang);
  const href = previewHref(`/learn/${slug}`, preview);
  if (!coverUrl) {
    return (
      <Link href={href} className="link text-sm">
        {t("learn.backToCourse")}
      </Link>
    );
  }
  return (
    <div data-testid="rail-cover">
      <Link href={href} tabIndex={-1} aria-hidden className="block w-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="h-auto w-full rounded-sm object-cover shadow-md ring-1 ring-black/10" />
      </Link>
      <Link href={href} className="link mt-2 inline-block whitespace-nowrap text-sm">
        {t("learn.backToCourse")}
      </Link>
    </div>
  );
}

function RailBody({ slug, frame, hasExams, levelLabel, preview, coverUrl, lang, videos }: { slug: string; frame: LessonFrameData; hasExams: boolean; levelLabel: string; preview?: boolean; coverUrl: string | null; lang?: UiLang; videos?: ReadonlyMap<string, LessonVideoInfo> }) {
  const t = tFor(lang);
  const pct = frame.unitTotal === 0 ? 0 : Math.round((frame.unitDone / frame.unitTotal) * 100);
  return (
    <div>
      <RailCourseHeader slug={slug} coverUrl={coverUrl} preview={preview} lang={lang} />
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
        {t("learn.rail.unitProgress", { done: frame.unitDone, total: frame.unitTotal })}
      </p>
      <RailList slug={slug} frame={frame} preview={preview} lang={lang} videos={videos} />
      {hasExams && (
        <div className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
          <div className="text-sm font-bold">{t("learn.rail.readyToApply")}</div>
          <Link href={previewHref(`/learn/${slug}#luyen-thi`, preview)} className="link mt-1 inline-block text-sm font-semibold">
            {t("learn.rail.mockExam")}
          </Link>
        </div>
      )}
    </div>
  );
}

/** Đường dẫn "Học / Khoá / Unit|Module / Bài" phía trên nội dung (`levelLabel` chỉ dùng cho tên truy cập; chữ hiển thị là tên cấp trên). */
export function LessonCrumbs({ slug, courseTitle, unitTitle, lessonTitle, preview, lang }: { slug: string; courseTitle: string; unitTitle: string; lessonTitle: string; preview?: boolean; lang?: UiLang }) {
  const t = tFor(lang);
  return (
    <nav aria-label={t("learn.crumbs.aria")} className="text-caption flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted">
      <Link href="/me/dashboard" className="hover:underline">
        {t("learn.crumbs.home")}
      </Link>
      <span aria-hidden>/</span>
      <Link href={previewHref(`/learn/${slug}`, preview)} className="hover:underline">
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
export function LessonViewTabs({ slug, lessonId, view, vocabCount, preview, lang }: { slug: string; lessonId: string; view: LessonView; vocabCount: number; preview?: boolean; lang?: UiLang }) {
  if (vocabCount <= 0) return null;
  const t = tFor(lang);
  const tabs: Array<[LessonView, string]> = [
    ["lesson", t("learn.viewTabs.lesson")],
    ["vocab", t("learn.viewTabs.vocab", { n: vocabCount })],
  ];
  return (
    <nav aria-label={t("learn.viewTabs.aria")} className="mt-6 flex gap-1 border-b border-token">
      {tabs.map(([v, label]) => (
        <Link
          key={v}
          href={lessonViewHref(slug, lessonId, v, preview)}
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
export function LessonNavBar({ slug, prev, next, preview, lang }: { slug: string; prev: LessonFrameData["prev"]; next: LessonFrameData["next"]; preview?: boolean; lang?: UiLang }) {
  const t = tFor(lang);
  return (
    <nav
      aria-label={t("learn.nav.aria")}
      className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-token bg-[rgb(var(--surface)/0.94)] px-4 py-2 backdrop-blur lg:mx-0 lg:rounded-t-xl"
    >
      {prev ? (
        <Link href={lessonViewHref(slug, prev.id, "lesson", preview)} className="btn-ghost btn-sm inline-flex min-w-0 items-center gap-1.5" title={prev.title}>
          <span aria-hidden>←</span>
          <span className="shrink-0">{t("learn.nav.prev")}</span>
          <span className="hidden min-w-0 truncate text-muted md:inline">· {short(prev.title)}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <Link href={lessonViewHref(slug, next.id, "lesson", preview)} className="btn-primary btn-sm inline-flex min-w-0 items-center gap-1.5" title={next.title}>
          <span className="shrink-0">{t("learn.nav.next")}</span>
          <span className="hidden min-w-0 truncate opacity-90 md:inline">· {short(next.title)}</span>
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <Link href={previewHref(`/learn/${slug}`, preview)} className="btn-primary btn-sm">
          {t("learn.nav.toCourse")}
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
  coverUrl = null,
  lessonTitle,
  frame,
  hasExams,
  levelLabel,
  notesCount,
  tocModules,
  videos,
  preview,
  accent = null,
  lang,
  children,
}: {
  slug: string;
  lessonId: string;
  courseTitle: string;
  /** Ảnh bìa giáo trình của khoá (`Course.coverUrl`); null thì thanh bên không có bìa. */
  coverUrl?: string | null;
  lessonTitle: string;
  frame: LessonFrameData;
  hasExams: boolean;
  /** "Unit" (khoá ngoại ngữ) hoặc "Module" (khoá khác). */
  levelLabel: string;
  /** Số ghi chú của học viên cho bài này (hiện ở tab "Ghi chú · n" trước khi mở panel). */
  notesCount: number;
  /** Các module/bài của cả khoá cho nút "Mục lục khoá học" ở thanh bên; không truyền thì không có nút. */
  tocModules?: TocModules;
  /** Bài → video (đã lọc khối ẩn): dấu "Có video" cạnh tên bài trong thanh bài. */
  videos?: ReadonlyMap<string, LessonVideoInfo>;
  /** Giảng viên đang "xem như học viên": mọi liên kết trong khung giữ `preview=1`. */
  preview?: boolean;
  /** Màu nhấn của bộ sách (`Course.themeColor`). */
  accent?: string | null;
  /** Ngôn ngữ giao diện (trang cha lấy bằng `await getUiLang()`); mặc định "vi". */
  lang?: UiLang;
  children: React.ReactNode;
}) {
  const t = tFor(lang);
  const levelLower = levelLabel.toLowerCase();
  return (
    <LessonFrameShell
      accent={accent}
      lessonId={lessonId}
      notesCount={notesCount}
      rail={<RailBody slug={slug} frame={frame} hasExams={hasExams} levelLabel={levelLabel} preview={preview} coverUrl={coverUrl} lang={lang} videos={videos} />}
      railLabel={t("learn.rail.label", { level: levelLower })}
      railSummary={t("learn.rail.summary", { level: levelLower, done: frame.unitDone, total: frame.unitTotal })}
      crumbs={
        // Mục lục toàn khoá nằm ở hàng đường dẫn (căn phải), tách khỏi danh sách bài của unit ở thanh bên để không lẫn hai loại mục lục.
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <LessonCrumbs slug={slug} courseTitle={courseTitle} unitTitle={frame.unitTitle} lessonTitle={lessonTitle} preview={preview} lang={lang} />
          {tocModules && tocModules.length > 0 && (
            <div className="ml-auto">
              <LessonTocDrawer slug={slug} currentLessonId={lessonId} modules={tocModules} trigger="inline" side="right" preview={preview} />
            </div>
          )}
        </div>
      }
      nav={<LessonNavBar slug={slug} prev={frame.prev} next={frame.next} preview={preview} lang={lang} />}
    >
      {children}
    </LessonFrameShell>
  );
}
