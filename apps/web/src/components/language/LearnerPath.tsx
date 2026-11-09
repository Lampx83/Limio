import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { LANGUAGE_SKILL_LABEL } from "@feedbackme/shared-types";
import type { LanguageLearnerPath, LanguagePathUnit, UnitState } from "@feedbackme/core-lms";

/** Số Unit hiện sẵn ở "Lộ trình giáo trình"; phần còn lại xem ở trang khoá. */
export const UNITS_SHOWN = 5;

export interface LearnerPathGoal {
  /** Vd "IELTS 6.5". */
  level: string;
  /** Đã định dạng sẵn (giờ VN). */
  targetDate: string;
  hoursPerWeek: number | null;
}

type SelectedPath = LanguageLearnerPath & { selected: NonNullable<LanguageLearnerPath["selected"]> };

const UNIT_TEXT: Record<UnitState, string> = { done: "Hoàn thành", learning: "Đang học", todo: "Chưa học" };

function Bar({ pct, tone }: { pct: number; tone: "lime" | "pink" | "grey" }) {
  const fill = tone === "pink" ? "bg-pink-500" : tone === "lime" ? "bg-lime-500" : "bg-transparent";
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function UnitRow({ unit, href, index }: { unit: LanguagePathUnit; href: string; index: number }) {
  const pct = unit.total === 0 ? 0 : Math.round((unit.done / unit.total) * 100);
  const learning = unit.state === "learning";
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-shadow hover:shadow-sm ${
          learning ? "border-pink-200 bg-pink-50" : "border-token bg-[rgb(var(--surface))]"
        }`}
      >
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
            unit.state === "done"
              ? "bg-lime-100 text-lime-700"
              : learning
                ? "bg-pink-500 text-white"
                : "bg-[rgb(var(--surface-muted))] text-muted"
          }`}
        >
          {unit.state === "done" ? "✓" : index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{unit.title}</span>
        <span className="hidden w-44 shrink-0 sm:block">
          <span className={`block text-right text-xs ${learning ? "text-pink-700" : "text-muted"}`}>
            {unit.done} / {unit.total} bài · {UNIT_TEXT[unit.state]}
          </span>
          <span className="mt-1 block">
            <Bar pct={pct} tone={learning ? "pink" : unit.state === "done" ? "lime" : "grey"} />
          </span>
        </span>
        <span className="text-xs text-muted sm:hidden">
          {unit.done}/{unit.total}
        </span>
      </Link>
    </li>
  );
}

/**
 * LANG đợt 1 — trang "Lộ trình của tôi" (thiết kế Figma "Tổng quan lộ trình học"). Thuần trình bày: nhận dữ liệu đã
 * tổng hợp, không đọc DB. Tiến độ theo kỹ năng là bài ĐÃ HOÀN THÀNH, không phải mức nắm vững.
 */
export default function LearnerPath({
  userName,
  path,
  goal,
  dueCards,
  hasExams,
}: {
  userName: string;
  path: SelectedPath;
  goal: LearnerPathGoal | null;
  dueCards: number;
  hasExams: boolean;
}) {
  const { selected } = path;
  const courseHref = `/learn/${selected.slug}`;
  const examsHref = `${courseHref}#luyen-thi`;
  const shown = path.units.slice(0, UNITS_SHOWN);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Khu vực" className="flex items-center gap-1 border-b border-token">
        <span aria-current="page" className="-mb-px border-b-2 border-lime-600 px-3 py-2 text-sm font-semibold text-lime-800">
          Học
        </span>
        {hasExams && (
          <Link href={examsHref} className="px-3 py-2 text-sm text-muted hover:text-[rgb(var(--text))]">
            Luyện đề
          </Link>
        )}
      </nav>

      {path.courses.length > 1 && (
        <nav aria-label="Chọn khoá" className="mt-4 flex flex-wrap gap-2">
          {path.courses.map((c) => (
            <Link
              key={c.id}
              href={`/language?course=${encodeURIComponent(c.slug)}`}
              aria-current={c.id === selected.id ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                c.id === selected.id
                  ? "border-lime-400 bg-lime-50 font-semibold text-lime-800"
                  : "border-token text-muted hover:bg-[rgb(var(--surface-muted))]"
              }`}
            >
              {c.title}
            </Link>
          ))}
        </nav>
      )}

      <header className="mt-5">
        <h1 className="text-h1">Học từng bước, tiến xa hơn.</h1>
        <p className="text-meta mt-1">
          Chào {userName}, tiếp tục hành trình {selected.title} của bạn hôm nay.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="continue-title" className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-muted" id="continue-title">
              Tiếp tục học
            </div>
            {path.continue ? (
              <>
                <h2 className="text-h2 mt-2">{path.continue.lessonTitle}</h2>
                <p className="text-meta mt-1">
                  {path.continue.unitTitle}
                  {path.continue.minutes ? ` · ${path.continue.minutes} phút` : ""}
                </p>
                <Link href={`/learn/${selected.slug}/lessons/${path.continue.lessonId}`} className="btn-primary mt-4 inline-flex">
                  Tiếp tục bài học →
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-h2 mt-2">Bạn đã học hết các bài đang mở</h2>
                <p className="text-meta mt-1">Xem lại khoá hoặc luyện đề để củng cố.</p>
                <Link href={courseHref} className="btn-ghost mt-4 inline-flex">
                  Mở khoá học
                </Link>
              </>
            )}
          </section>

          <section aria-labelledby="units-title">
            <div className="flex items-end justify-between gap-3">
              <h2 id="units-title" className="text-h3">
                Lộ trình giáo trình
              </h2>
              {path.units.length > shown.length && (
                <Link href={courseHref} className="link text-sm">
                  Xem tất cả {path.units.length} unit →
                </Link>
              )}
            </div>
            {shown.length === 0 ? (
              <p className="text-meta mt-3">Khoá này chưa có bài học nào được mở.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {shown.map((u, i) => (
                  <UnitRow key={u.id} unit={u} href={courseHref} index={i} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4" aria-label="Tiến độ của bạn">
          {goal && (
            <section aria-labelledby="goal-title" className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
              <h2 id="goal-title" className="text-xs font-bold uppercase tracking-wider text-muted">
                Mục tiêu của bạn
              </h2>
              <div className="mt-2 text-3xl font-bold text-lime-700">{goal.level}</div>
              <p className="text-meta mt-1">
                Hạn {goal.targetDate}
                {goal.hoursPerWeek ? ` · ${goal.hoursPerWeek} giờ/tuần` : ""}
              </p>
              <div className="mt-3">
                <Bar pct={selected.completionPct} tone="lime" />
              </div>
              <p className="text-caption mt-1 text-muted">{selected.completionPct}% bài học của khoá đã hoàn thành</p>
            </section>
          )}

          {path.skills.length > 0 && (
            <section aria-labelledby="skills-title" className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
              <h2 id="skills-title" className="text-xs font-bold uppercase tracking-wider text-muted">
                Tiến độ theo kỹ năng
              </h2>
              <ul className="mt-3 space-y-3">
                {path.skills.map((s) => (
                  <li key={s.skill}>
                    <div className="flex justify-between text-sm">
                      <span>{LANGUAGE_SKILL_LABEL[s.skill]}</span>
                      <span className="tabular-nums text-muted">{s.pct}%</span>
                    </div>
                    <div className="mt-1">
                      <Bar pct={s.pct} tone="lime" />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-caption mt-3 text-muted">Dựa trên bài học đã hoàn thành</p>
            </section>
          )}

          <section
            aria-labelledby="review-title"
            className={`rounded-2xl border p-4 ${dueCards > 0 ? "border-lime-200 bg-lime-50" : "border-token bg-[rgb(var(--surface))]"}`}
          >
            <h2 id="review-title" className="flex items-center gap-2 text-sm font-bold">
              <RotateCcw size={16} aria-hidden /> Đến lúc ôn lại
            </h2>
            {dueCards > 0 ? (
              <>
                <p className="text-meta mt-2">{dueCards} từ vựng</p>
                <Link href={`/learn/${selected.slug}/flashcards`} className="btn-ghost btn-sm mt-3 inline-flex">
                  Ôn kiến thức đã học
                </Link>
              </>
            ) : (
              <p className="text-meta mt-2">Hôm nay không có thẻ nào đến hạn.</p>
            )}
          </section>

          {hasExams && (
            <section aria-labelledby="ready-title" className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
              <h2 id="ready-title" className="text-sm font-bold">
                Sẵn sàng vận dụng?
              </h2>
              <Link href={examsHref} className="link mt-1 inline-block text-sm font-semibold">
                Luyện đề ↗
              </Link>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
