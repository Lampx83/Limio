"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StickyMobileCTA from "@/components/ui/StickyMobileCTA";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { DEFAULT_GAME_THEME, GAME_THEMES, type GameThemeKey } from "@/lib/gameshow/themes";
import { TEAM_COUNT_MAX, TEAM_COUNT_MIN } from "@/lib/gameshow/teams";

type QuizOption = {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  lessonOrder: number | null;
  questionCount: number;
};

type QuestionSetOption = {
  id: string;
  title: string;
  questionCount: number;
};

type SourceTab = "quiz" | "question-set";

function Radio({ checked, name, onChange }: { checked: boolean; name: string; onChange: () => void }) {
  return (
    <input
      type="radio"
      name={name}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 shrink-0 accent-[rgb(var(--brand))]"
    />
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="shrink-0 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--text-muted))]">
      {n} câu
    </span>
  );
}

export default function NewGameshowClient({
  quizzes,
  questionSets,
}: {
  quizzes: QuizOption[];
  questionSets: QuestionSetOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SourceTab>(questionSets.length > 0 ? "question-set" : "quiz");
  const [selectedQuiz, setSelectedQuiz] = useState<string>(quizzes[0]?.id ?? "");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [lessonFilter, setLessonFilter] = useState<string>("");

  const courseOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const q of quizzes) if (!m.has(q.courseId)) m.set(q.courseId, q.courseTitle);
    return [...m.entries()].map(([id, title]) => ({ id, title }));
  }, [quizzes]);

  const lessonOptions = useMemo(() => {
    if (!courseFilter) return [];
    const m = new Map<string, { title: string; order: number }>();
    let hasStandalone = false;
    for (const q of quizzes) {
      if (q.courseId !== courseFilter) continue;
      if (q.lessonId) m.set(q.lessonId, { title: q.lessonTitle ?? "", order: q.lessonOrder ?? 0 });
      else hasStandalone = true;
    }
    const list = [...m.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id, v]) => ({ id, title: v.title }));
    if (hasStandalone) list.push({ id: "__none", title: "Quiz độc lập (không gắn bài)" });
    return list;
  }, [quizzes, courseFilter]);

  const visibleQuizzes = useMemo(
    () =>
      quizzes.filter((q) => {
        if (courseFilter && q.courseId !== courseFilter) return false;
        if (lessonFilter === "__none") return !q.lessonId;
        if (lessonFilter && q.lessonId !== lessonFilter) return false;
        return true;
      }),
    [quizzes, courseFilter, lessonFilter],
  );
  const [selectedSet, setSelectedSet] = useState<string>(questionSets[0]?.id ?? "");
  const [teamMode, setTeamMode] = useState(false);
  const [teamCount, setTeamCount] = useState(4);
  const [theme, setTheme] = useState<GameThemeKey>(DEFAULT_GAME_THEME);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = tab === "quiz" ? selectedQuiz : selectedSet;

  const onCreate = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl("/api/gameshow/sessions/create"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(tab === "quiz" ? { quizId: selectedQuiz } : { questionSetId: selectedSet }),
          ...(teamMode ? { teamCount } : {}),
          theme,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { id: string };
      router.push(`/instructor/gameshow/${j.id}`);
    } finally {
      setBusy(false);
    }
  };

  const selectedTitle =
    tab === "quiz"
      ? quizzes.find((q) => q.id === selectedQuiz)?.title
      : questionSets.find((x) => x.id === selectedSet)?.title;
  const selectedCount =
    tab === "quiz"
      ? quizzes.find((q) => q.id === selectedQuiz)?.questionCount
      : questionSets.find((x) => x.id === selectedSet)?.questionCount;

  // Thẻ chọn nguồn: cả thẻ là vùng bấm, tiêu đề xuống nhiều dòng thay vì
  // bị cắt, số câu + dấu chọn nằm cùng một hàng cuối thẻ để mắt không phải
  // chạy ngang cả màn hình rộng mới nối được tên với ô chọn.
  const cardCls = (active: boolean) =>
    `group relative flex min-h-[7rem] cursor-pointer flex-col justify-between gap-3 rounded-xl border p-4 transition-colors ${
      active
        ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand)/0.06)] ring-1 ring-[rgb(var(--brand)/0.35)]"
        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--brand)/0.45)] hover:bg-[rgb(var(--surface-muted))]"
    }`;

  const gridCls = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

  const emptyCls =
    "rounded-xl border border-dashed border-[rgb(var(--border))] p-8 text-center text-sm text-[rgb(var(--text-muted))]";

  return (
    <div className="mt-6 grid items-start gap-6 pb-20 lg:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Cột trái: chọn nguồn câu hỏi */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" className="tool-segmented">
            <button role="tab" aria-selected={tab === "question-set"} aria-pressed={tab === "question-set"} onClick={() => setTab("question-set")}>
              Bộ câu hỏi tự soạn
            </button>
            <button role="tab" aria-selected={tab === "quiz"} aria-pressed={tab === "quiz"} onClick={() => setTab("quiz")}>
              Quiz có sẵn
            </button>
          </div>
          {tab === "question-set" && questionSets.length > 0 && (
            <Link href="/instructor/gameshow/question-sets/new" className="tool-action">
              + Soạn bộ mới
            </Link>
          )}
        </div>

        {tab === "question-set" ? (
          questionSets.length === 0 ? (
            <div className={emptyCls}>
              Chưa có bộ câu hỏi nào.{" "}
              <Link href="/instructor/gameshow/question-sets/new" className="font-medium text-[rgb(var(--brand))] hover:underline">
                Soạn bộ mới
              </Link>
            </div>
          ) : (
            <div className={gridCls}>
              {questionSets.map((s) => (
                <label key={s.id} className={cardCls(selectedSet === s.id)}>
                  <span className="text-sm font-semibold leading-snug">{s.title}</span>
                  <span className="flex items-center justify-between gap-3">
                    <Count n={s.questionCount} />
                    <Radio name="question-set" checked={selectedSet === s.id} onChange={() => setSelectedSet(s.id)} />
                  </span>
                </label>
              ))}
            </div>
          )
        ) : quizzes.length === 0 ? (
          <div className={emptyCls}>
            Chưa có quiz nào có câu trắc nghiệm/đúng-sai. Tạo quiz với ít nhất 1 câu loại này trước.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc theo khoá học"
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setLessonFilter("");
                }}
                className="select !w-auto min-w-[14rem] max-w-full sm:max-w-sm"
              >
                <option value="">Tất cả khoá học</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lọc theo bài học"
                value={lessonFilter}
                onChange={(e) => setLessonFilter(e.target.value)}
                disabled={!courseFilter}
                className="select !w-auto min-w-[14rem] max-w-full disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-sm"
              >
                <option value="">{courseFilter ? "Tất cả bài học" : "Chọn khoá học trước"}</option>
                {lessonOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
              <span className="text-caption ml-auto">{visibleQuizzes.length} quiz</span>
            </div>
            {visibleQuizzes.length === 0 ? (
              <div className={emptyCls}>Không có quiz nào khớp bộ lọc.</div>
            ) : (
              <div className={`${gridCls} lg:max-h-[calc(100vh-16rem)] overflow-y-auto pr-1`}>
                {visibleQuizzes.map((q) => {
                  const trail = [!courseFilter && q.courseTitle, !lessonFilter && q.lessonTitle]
                    .filter(Boolean)
                    .join(" › ");
                  return (
                    <label key={q.id} className={cardCls(selectedQuiz === q.id)}>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug">{q.title}</span>
                        {trail && <span className="text-caption mt-1 line-clamp-2 block">{trail}</span>}
                      </span>
                      <span className="flex items-center justify-between gap-3">
                        <Count n={q.questionCount} />
                        <Radio name="quiz" checked={selectedQuiz === q.id} onChange={() => setSelectedQuiz(q.id)} />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cột phải: cài đặt + nút tạo, dính khi cuộn danh sách dài */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        <section className="tool-panel !p-4 space-y-1">
          <p className="tool-section-label !mb-1">Đã chọn</p>
          {selectedTitle ? (
            <>
              <p className="text-sm font-semibold leading-snug">{selectedTitle}</p>
              <p className="text-caption">{selectedCount} câu hỏi</p>
            </>
          ) : (
            <p className="text-caption">Chưa chọn nguồn câu hỏi</p>
          )}
        </section>

        <section className="tool-panel !p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold">Chơi theo nhóm</span>
              <span className="text-caption mt-0.5 block">
                Học viên tự chọn đội lúc vào phòng, xếp hạng &amp; podium tính theo đội.
              </span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input
                type="checkbox"
                role="switch"
                checked={teamMode}
                onChange={(e) => setTeamMode(e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-[rgb(var(--border))] transition-colors peer-checked:bg-[rgb(var(--brand))] peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--brand)/0.4)]" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>

          {teamMode && (
            <div className="mt-4 flex items-center gap-3 border-t border-[rgb(var(--border))] pt-4">
              <label htmlFor="team-count" className="text-sm font-medium text-[rgb(var(--text-muted))]">
                Số đội
              </label>
              <input
                id="team-count"
                type="range"
                min={TEAM_COUNT_MIN}
                max={TEAM_COUNT_MAX}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                className="flex-1 accent-[rgb(var(--brand))]"
              />
              <span className="w-8 rounded-md bg-[rgb(var(--surface-muted))] py-0.5 text-center text-sm font-semibold">
                {teamCount}
              </span>
            </div>
          )}
        </section>

        <section className="tool-panel !p-4">
          <p className="tool-section-label !mb-2">Giao diện</p>
          <div role="radiogroup" aria-label="Giao diện phiên" className="grid grid-cols-2 gap-2">
            {GAME_THEMES.map((t) => (
              <label
                key={t.key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm font-medium transition-colors ${
                  theme === t.key
                    ? "border-[rgb(var(--brand))] ring-1 ring-[rgb(var(--brand)/0.35)]"
                    : "border-[rgb(var(--border))] hover:border-[rgb(var(--brand)/0.45)]"
                }`}
              >
                <input
                  type="radio"
                  name="gs-theme"
                  checked={theme === t.key}
                  onChange={() => setTheme(t.key)}
                  className="sr-only"
                />
                <span
                  className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ background: t.preview }}
                  aria-hidden="true"
                />
                <span className="truncate">{t.label}</span>
              </label>
            ))}
          </div>
        </section>

        {err && <div className="banner-danger">{err}</div>}

        <button onClick={onCreate} disabled={busy || !selected} className="tool-cta hidden lg:inline-flex">
          {busy ? "Đang tạo..." : "Tạo phiên"}
        </button>
      </aside>

      <StickyMobileCTA
        primary={selectedTitle ?? "Chưa chọn nguồn câu hỏi"}
        secondary={selectedTitle ? `${selectedCount} câu hỏi` : undefined}
        action={
          <button onClick={onCreate} disabled={busy || !selected} className="tool-cta !w-auto">
            {busy ? "Đang tạo..." : "Tạo phiên"}
          </button>
        }
      />
    </div>
  );
}
