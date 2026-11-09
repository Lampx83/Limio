import Link from "next/link";
import { CalendarClock, Lightbulb, RotateCcw } from "lucide-react";
import {
  SUGGESTION_TEXT,
  nothingToReview,
  practiceWrongTotal,
  scheduleDayLabel,
  scheduleMax,
  scheduleTotal,
  type PracticeReviewRow,
  type ScheduleDay,
} from "@/lib/reviewScheduleView";
import EmptyState from "@/components/ui/EmptyState";

export interface ReviewSuggestion {
  skillLabel: string;
  lessonId: string;
  lessonTitle: string;
  reason: keyof typeof SUGGESTION_TEXT;
}

/**
 * LANG đợt 4 — trang "Lịch ôn tập" (menu "Không gian học" của Figma). Thuần trình bày: nhận dữ liệu đã tổng hợp, không đọc
 * DB. Không hiện số mastery: gợi ý chỉ là nhãn và tên bài.
 */
export default function ReviewSchedule({
  courses,
  selected,
  dueToday,
  days,
  practice,
  suggestion,
}: {
  courses: Array<{ id: string; slug: string; title: string }>;
  selected: { id: string; slug: string; title: string };
  dueToday: number;
  days: ScheduleDay[];
  practice: PracticeReviewRow[];
  suggestion: ReviewSuggestion | null;
}) {
  const slug = selected.slug;
  const wrong = practiceWrongTotal(practice);
  const done = nothingToReview({ dueToday, practiceWrong: wrong, hasSuggestion: !!suggestion });
  const max = scheduleMax(days);
  const total = scheduleTotal(days);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-h1">Lịch ôn tập</h1>
        <p className="text-meta mt-1">Những việc nên ôn hôm nay để nhớ lâu hơn · {selected.title}</p>
      </header>

      {courses.length > 1 && (
        <nav aria-label="Chọn khoá" className="mt-4 flex flex-wrap gap-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/language/lich-on-tap?course=${encodeURIComponent(c.slug)}`}
              aria-current={c.id === selected.id ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                c.id === selected.id ? "border-lime-400 bg-lime-50 font-semibold text-lime-800" : "border-token text-muted hover:bg-[rgb(var(--surface-muted))]"
              }`}
            >
              {c.title}
            </Link>
          ))}
        </nav>
      )}

      {done && (
        <div className="mt-6">
          <EmptyState title="Hôm nay bạn đã ôn xong" description="Chưa có thẻ nào đến hạn và không có câu luyện nào cần làm lại." />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="rv-today" className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
          <h2 id="rv-today" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
            <RotateCcw size={15} aria-hidden /> Hôm nay
          </h2>
          {dueToday > 0 ? (
            <>
              <div className="mt-2 text-3xl font-bold tabular-nums text-lime-700">{dueToday}</div>
              <p className="text-meta">thẻ từ vựng đến hạn ôn</p>
              <Link href={`/learn/${slug}/flashcards`} className="btn-primary btn-sm mt-3 inline-flex">
                Ôn thẻ từ vựng
              </Link>
            </>
          ) : (
            <p className="text-meta mt-2">Hôm nay không có thẻ nào đến hạn.</p>
          )}
        </section>

        <section aria-labelledby="rv-week" className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
          <h2 id="rv-week" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
            <CalendarClock size={15} aria-hidden /> 7 ngày tới
          </h2>
          <ul className="mt-3 space-y-2">
            {days.map((d, i) => (
              <li key={d.dayStart} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted">{scheduleDayLabel(d.dayStart, i)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" aria-hidden>
                  <span className="block h-full rounded-full bg-lime-500" style={{ width: `${Math.round((d.count / max) * 100)}%` }} />
                </span>
                <span className="w-8 text-right tabular-nums font-semibold">{d.count}</span>
              </li>
            ))}
          </ul>
          <p className="text-caption mt-2 text-muted">{total > 0 ? "Số thẻ từ vựng đến hạn mỗi ngày (thẻ quá hạn tính vào hôm nay)." : "Chưa có thẻ nào được lên lịch."}</p>
        </section>
      </div>

      {practice.length > 0 && (
        <section aria-labelledby="rv-practice" className="mt-6">
          <h2 id="rv-practice" className="text-h3">
            Câu luyện nên làm lại
          </h2>
          <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-2xl border border-token bg-[rgb(var(--surface))]">
            {practice.map((p) => (
              <li key={p.examId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.title}</span>
                  <span className="text-caption text-muted">{p.wrong} câu lần trả lời gần nhất chưa đúng</span>
                </span>
                <Link href={`/learn/${slug}/exams/${p.examId}/practice?filter=wrong`} className="btn-ghost btn-sm">
                  Làm lại
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestion && (
        <section aria-labelledby="rv-suggest" className="mt-6 rounded-2xl border border-lime-200 bg-lime-50 p-5">
          <h2 id="rv-suggest" className="flex items-center gap-2 text-sm font-bold">
            <Lightbulb size={16} aria-hidden /> Gợi ý hôm nay
          </h2>
          <p className="text-meta mt-1">
            {SUGGESTION_TEXT[suggestion.reason]} kỹ năng {suggestion.skillLabel}: {suggestion.lessonTitle}
          </p>
          <Link href={`/learn/${slug}/lessons/${suggestion.lessonId}`} className="btn-primary btn-sm mt-3 inline-flex">
            Mở bài
          </Link>
        </section>
      )}
    </main>
  );
}
