import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getInstructorSkillCoverage,
  listUntaggedLessons,
  listUntaggedQuestions,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import BulkTagger from "./BulkTagger";

export const dynamic = "force-dynamic";

export default async function SkillTaggingHubPage({
  searchParams,
}: {
  searchParams?: { course?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/skill-tagging");
  }
  const userId = session.user.id;

  const coverage = await getInstructorSkillCoverage(userId);
  if (coverage.courses.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="h-display text-3xl font-bold">Skill Tagging</h1>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm">
          Bạn chưa là instructor của khóa nào.
        </div>
      </main>
    );
  }

  const courseFilter =
    searchParams?.course &&
    coverage.courses.some((c) => c.courseId === searchParams.course)
      ? searchParams.course
      : undefined;

  const [untaggedLessons, untaggedQuestions] = await Promise.all([
    listUntaggedLessons(userId, { courseId: courseFilter, limit: 200 }),
    listUntaggedQuestions(userId, { courseId: courseFilter, limit: 200 }),
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

  const filterHref = (cid?: string) =>
    cid
      ? `/instructor/skill-tagging?course=${cid}`
      : "/instructor/skill-tagging";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="h-display text-3xl font-bold sm:text-4xl">
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
          href={filterHref(undefined)}
          className={!courseFilter ? "chip-brand" : "chip"}
        >
          Tất cả
        </Link>
        {coverage.courses.map((c) => (
          <Link
            key={c.courseId}
            href={filterHref(c.courseId)}
            className={courseFilter === c.courseId ? "chip-brand" : "chip"}
          >
            {c.courseTitle}
          </Link>
        ))}
      </div>

      {/* KPI cards */}
      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <Kpi
          label="Lesson đã tag"
          value={`${totals.taggedLessons}/${totals.totalLessons}`}
          sub={`${lessonPct}% coverage`}
          tone={lessonPct === 100 ? "success" : lessonPct >= 70 ? "brand" : "accent"}
        />
        <Kpi
          label="Question đã tag"
          value={`${totals.taggedQuestions}/${totals.totalQuestions}`}
          sub={`${questionPct}% coverage`}
          tone={
            questionPct === 100 ? "success" : questionPct >= 70 ? "brand" : "accent"
          }
        />
        <Kpi
          label="Lesson live chưa tag"
          value={totals.untaggedLiveLessons}
          sub="Đang published + visible"
          tone={totals.untaggedLiveLessons > 0 ? "danger" : "success"}
        />
        <Kpi
          label="Question live chưa tag"
          value={totals.untaggedLiveQuestions}
          sub="Trong khoá đã publish"
          tone={totals.untaggedLiveQuestions > 0 ? "danger" : "success"}
        />
      </section>

      {/* Per-course coverage */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Coverage theo khoá</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
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
              {coverage.courses.map((c) => {
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
          <div className="mt-3 rounded-2xl border border-success-200 bg-success-50 p-6 text-center text-sm text-success-700">
            Toàn bộ lesson đã được tag.
          </div>
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
          <div className="mt-3 rounded-2xl border border-success-200 bg-success-50 p-6 text-center text-sm text-success-700">
            Toàn bộ question đã được tag.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
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
        )}
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "brand" | "success" | "accent" | "danger";
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
  }[tone];
  return (
    <div className="card">
      <div className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}
