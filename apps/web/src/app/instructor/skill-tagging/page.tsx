import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getInstructorSkillCoverage,
  listUntaggedLessons,
  listUntaggedQuestions,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import BulkTagger from "./BulkTagger";
import { EmptyState, KpiCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SkillTaggingHubPage({
  searchParams,
}: {
  searchParams?: { course?: string; personalization?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/skill-tagging");
  }
  const userId = session.user.id;

  const coverage = await getInstructorSkillCoverage(userId);
  if (coverage.courses.length === 0) {
    return (
      <main>
        <h1 className="h-display text-h1">Skill Tagging</h1>
        <EmptyState
          className="mt-6"
          icon="🏷️"
          title="Bạn chưa là instructor của khoá nào"
          description="Tạo khoá học để bắt đầu tag skill cho lesson và quiz."
          actions={[{ label: "+ Tạo khoá", href: "/instructor/courses/new" }]}
        />
      </main>
    );
  }

  const courseFilter =
    searchParams?.course &&
    coverage.courses.some((c) => c.courseId === searchParams.course)
      ? searchParams.course
      : undefined;
  // "on" = chỉ hiện course có personalization bật (course standard-LMS không
  // cần tag skill nên không gây nhiễu instructor).
  const onlyPersonalization = searchParams?.personalization === "on";
  const visibleCourses = onlyPersonalization
    ? coverage.courses.filter((c) => c.personalizationEnabled)
    : coverage.courses;
  const personalizationOffCount = coverage.courses.length - coverage.courses.filter((c) => c.personalizationEnabled).length;

  const [untaggedLessons, untaggedQuestions] = await Promise.all([
    listUntaggedLessons(userId, {
      courseId: courseFilter,
      limit: 200,
      personalizationEnabledOnly: onlyPersonalization,
    }),
    listUntaggedQuestions(userId, {
      courseId: courseFilter,
      limit: 200,
      personalizationEnabledOnly: onlyPersonalization,
    }),
  ]);

  const { totals } = coverage;
  const lessonPct =
    totals.totalLessons > 0
      ? Math.round((totals.taggedLessons / totals.totalLessons) * 100)
      : 100;
  const questionPct =
    totals.totalQuestions > 0
      ? Math.round((totals.taggedQuestions / totals.totalQuestions) * 100)
      : 100;

  const filterHref = (next: { course?: string; personalization?: "on" | null }) => {
    const params = new URLSearchParams();
    const c = "course" in next ? next.course : courseFilter;
    const p = "personalization" in next
      ? next.personalization
      : (onlyPersonalization ? "on" : null);
    if (c) params.set("course", c);
    if (p === "on") params.set("personalization", "on");
    const qs = params.toString();
    return qs ? `/instructor/skill-tagging?${qs}` : "/instructor/skill-tagging";
  };

  return (
    <main>
      <header>
        <h1 className="h-display text-h1">
          Skill Tagging
        </h1>
        <p className="mt-2 text-muted">
          Tag skill là tiền đề cho personalization (BKT, feedback, adaptive
          path). Mọi lesson và quiz question đều cần ít nhất 1 skill trước khi
          publish.
        </p>
      </header>

      {/* Filter by course */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Khoá:
        </span>
        <Link
          href={filterHref({ course: undefined })}
          className={!courseFilter ? "chip-brand" : "chip"}
        >
          Tất cả ({visibleCourses.length})
        </Link>
        {visibleCourses.map((c) => (
          <Link
            key={c.courseId}
            href={filterHref({ course: c.courseId })}
            className={courseFilter === c.courseId ? "chip-brand" : "chip"}
            prefetch={false}
          >
            {c.courseTitle}
          </Link>
        ))}
      </div>

      {/* Filter by personalization */}
      {personalizationOffCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Phạm vi:
          </span>
          <Link
            href={filterHref({ personalization: null })}
            className={!onlyPersonalization ? "chip-brand" : "chip"}
          >
            Mọi khoá
          </Link>
          <Link
            href={filterHref({ personalization: "on" })}
            className={onlyPersonalization ? "chip-brand" : "chip"}
            title="Chỉ hiện khoá có bật personalization — khoá Standard LMS không cần tag skill"
          >
            🤖 Chỉ khoá AI Feedback
          </Link>
          <span className="text-xs text-faint">
            ({personalizationOffCount} khoá Standard LMS không yêu cầu tag skill)
          </span>
        </div>
      )}

      {/* KPI cards */}
      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <KpiCard
          label="Lesson đã tag"
          value={`${totals.taggedLessons}/${totals.totalLessons}`}
          sub={`${lessonPct}% coverage`}
          tone={lessonPct === 100 ? "success" : lessonPct >= 70 ? "brand" : "accent"}
        />
        <KpiCard
          label="Question đã tag"
          value={`${totals.taggedQuestions}/${totals.totalQuestions}`}
          sub={`${questionPct}% coverage`}
          tone={
            questionPct === 100 ? "success" : questionPct >= 70 ? "brand" : "accent"
          }
        />
        <KpiCard
          label="Lesson live chưa tag"
          value={totals.untaggedLiveLessons}
          sub="Đang published + visible"
          tone={totals.untaggedLiveLessons > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Question live chưa tag"
          value={totals.untaggedLiveQuestions}
          sub="Trong khoá đã publish"
          tone={totals.untaggedLiveQuestions > 0 ? "danger" : "success"}
        />
      </section>

      {/* Per-course coverage */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Coverage theo khoá</h2>

        {/* Desktop table */}
        <div className="mt-3 hidden overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Khoá</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Lesson tag</th>
                <th className="px-4 py-3 text-right">Question tag</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {visibleCourses.map((c) => {
                const lp =
                  c.totalLessons > 0
                    ? Math.round((c.taggedLessons / c.totalLessons) * 100)
                    : 100;
                const qp =
                  c.totalQuestions > 0
                    ? Math.round((c.taggedQuestions / c.totalQuestions) * 100)
                    : 100;
                return (
                  <tr
                    key={c.courseId}
                    className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                  >
                    <td className="px-4 py-3 align-top font-medium">
                      {c.courseTitle}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          c.courseStatus === "published"
                            ? "chip-success"
                            : "chip"
                        }
                      >
                        {c.courseStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right tabular-nums">
                      <span className={lp < 100 ? "text-accent-700" : ""}>
                        {c.taggedLessons}/{c.totalLessons}
                      </span>
                      <span className="ml-1 text-xs text-faint">({lp}%)</span>
                    </td>
                    <td className="px-4 py-3 align-top text-right tabular-nums">
                      <span className={qp < 100 ? "text-accent-700" : ""}>
                        {c.taggedQuestions}/{c.totalQuestions}
                      </span>
                      <span className="ml-1 text-xs text-faint">({qp}%)</span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Link
                        href={`/instructor/courses/${c.courseId}`}
                        className="btn-ghost btn-sm"
                      >
                        Mở khoá →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card stack */}
        <ul className="mt-3 space-y-3 lg:hidden">
          {visibleCourses.map((c) => {
            const lp = c.totalLessons > 0 ? Math.round((c.taggedLessons / c.totalLessons) * 100) : 100;
            const qp = c.totalQuestions > 0 ? Math.round((c.taggedQuestions / c.totalQuestions) * 100) : 100;
            return (
              <li key={c.courseId} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 font-medium">{c.courseTitle}</p>
                  <span className={c.courseStatus === "published" ? "chip-success shrink-0" : "chip shrink-0"}>
                    {c.courseStatus}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-faint">Lesson</dt>
                    <dd className="mt-0.5 tabular-nums">
                      <span className={lp < 100 ? "text-accent-700 font-medium" : "font-medium"}>
                        {c.taggedLessons}/{c.totalLessons}
                      </span>
                      <span className="ml-1 text-faint">({lp}%)</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-faint">Question</dt>
                    <dd className="mt-0.5 tabular-nums">
                      <span className={qp < 100 ? "text-accent-700 font-medium" : "font-medium"}>
                        {c.taggedQuestions}/{c.totalQuestions}
                      </span>
                      <span className="ml-1 text-faint">({qp}%)</span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-token pt-3 text-right">
                  <Link href={`/instructor/courses/${c.courseId}`} className="btn-ghost btn-sm" prefetch={false}>
                    Mở khoá →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Untagged lessons */}
      <section className="mt-10">
        <header className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            Lesson chưa tag{" "}
            <span className="text-xs text-faint">
              ({untaggedLessons.length}
              {untaggedLessons.length === 200 ? "+" : ""})
            </span>
          </h2>
          <p className="text-xs text-faint">
            Tick + "Gợi ý AI" để tag hàng loạt, hoặc "Tag thủ công" để vào editor
          </p>
        </header>
        {untaggedLessons.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="✅"
            title="Toàn bộ lesson đã được tag"
            description="Coverage 100% trong scope hiện tại."
          />
        ) : (
          <BulkTagger lessons={untaggedLessons} />
        )}
      </section>

      {/* Untagged questions */}
      <section className="mt-10">
        <header className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            Quiz question chưa tag{" "}
            <span className="text-xs text-faint">
              ({untaggedQuestions.length}
              {untaggedQuestions.length === 200 ? "+" : ""})
            </span>
          </h2>
          <p className="text-xs text-faint">
            Question chưa tag không feed vào BKT learner model
          </p>
        </header>
        {untaggedQuestions.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="✅"
            title="Toàn bộ question đã được tag"
            description="Mọi quiz question đều feed được vào BKT."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-3 hidden overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card lg:block">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--surface-muted))]">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Prompt</th>
                    <th className="px-4 py-3">Khoá / Quiz</th>
                    <th className="px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-token">
                  {untaggedQuestions.map((q) => (
                    <tr
                      key={q.questionId}
                      className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="line-clamp-2 max-w-md">{q.prompt}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-xs text-muted">{q.courseTitle}</p>
                        <p className="mt-0.5 text-xs text-faint">{q.quizTitle}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {q.courseStatus === "published" ? (
                          <span className="chip-danger">Live · chưa tag</span>
                        ) : (
                          <span className="chip">Draft</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <ul className="mt-3 space-y-3 lg:hidden">
              {untaggedQuestions.map((q) => (
                <li key={q.questionId} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-3 flex-1 text-sm">{q.prompt}</p>
                    {q.courseStatus === "published" ? (
                      <span className="chip-danger shrink-0">Live</span>
                    ) : (
                      <span className="chip shrink-0">Draft</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted">{q.courseTitle}</p>
                  <p className="text-xs text-faint">{q.quizTitle}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

