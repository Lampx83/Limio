import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WEAK_THRESHOLD = 0.4;
const MASTERY_THRESHOLD = 0.9;

export default async function LearnerInsightsPage({
  searchParams,
}: {
  searchParams?: { course?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/learner-insights");
  }
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  if (ownedCourses.length === 0) {
    return (
      <main>
        <h1 className="h-display text-3xl font-bold">Learner Insights</h1>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm">
          Bạn chưa là instructor của khoá nào.
        </div>
      </main>
    );
  }

  const courseFilter =
    searchParams?.course && ownedCourses.some((c) => c.id === searchParams.course)
      ? searchParams.course
      : null;
  const courseIds = courseFilter ? [courseFilter] : ownedCourses.map((c) => c.id);

  // Scope: learners enrolled in instructor's courses.
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    select: {
      userId: true,
      user: { select: { displayName: true, email: true } },
    },
  });
  const learnerById = new Map(
    enrollments.map((e) => [e.userId, e.user] as const),
  );
  const learnerIds = [...new Set(enrollments.map((e) => e.userId))];

  // Skills tagged to any content in these courses (lessons via ContentSkillMapping
  // + questions via QuestionSkillTag on quizzes in these courses).
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: { in: courseIds } } },
    select: { id: true },
  });
  const lessonIds = lessons.map((l) => l.id);

  const lessonSkills = await prisma.contentSkillMapping.findMany({
    where: { contentType: "lesson", contentId: { in: lessonIds } },
    select: { skillId: true },
  });
  const quizzes = await prisma.quiz.findMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        { lessonId: { in: lessonIds } },
      ],
    },
    select: { id: true },
  });
  const questionSkills = await prisma.questionSkillTag.findMany({
    where: { question: { quizId: { in: quizzes.map((q) => q.id) } } },
    select: { skillId: true },
  });
  const skillIdSet = new Set<string>([
    ...lessonSkills.map((m) => m.skillId),
    ...questionSkills.map((t) => t.skillId),
  ]);
  const skills = await prisma.skill.findMany({
    where: { id: { in: [...skillIdSet] } },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });

  // Mastery state.
  const states = await prisma.learnerSkillState.findMany({
    where: {
      userId: { in: learnerIds },
      skillId: { in: skills.map((s) => s.id) },
    },
    select: {
      userId: true,
      skillId: true,
      masteryProbability: true,
      attempts: true,
      correctCount: true,
    },
  });

  const stateByPair = new Map<string, (typeof states)[number]>();
  for (const s of states) {
    stateByPair.set(`${s.userId}:${s.skillId}`, s);
  }

  // KPI computations.
  const trackedLearners = new Set(states.map((s) => s.userId)).size;
  const trackedSkills = new Set(states.map((s) => s.skillId)).size;
  const avgMastery =
    states.length > 0
      ? states.reduce((sum, s) => sum + s.masteryProbability, 0) / states.length
      : 0;
  const weakLearnersSet = new Set<string>();
  for (const s of states) {
    if (s.masteryProbability < WEAK_THRESHOLD) weakLearnersSet.add(s.userId);
  }

  // Weakest skill = lowest avg mastery among tracked.
  const perSkillStats = skills.map((sk) => {
    const rows = states.filter((s) => s.skillId === sk.id);
    if (rows.length === 0) {
      return { ...sk, count: 0, avg: 0, mastered: 0, weak: 0 };
    }
    const avg = rows.reduce((s, r) => s + r.masteryProbability, 0) / rows.length;
    const mastered = rows.filter(
      (r) => r.masteryProbability >= MASTERY_THRESHOLD,
    ).length;
    const weak = rows.filter((r) => r.masteryProbability < WEAK_THRESHOLD).length;
    return { ...sk, count: rows.length, avg, mastered, weak };
  });
  const weakestSkill = [...perSkillStats]
    .filter((s) => s.count > 0)
    .sort((a, b) => a.avg - b.avg)[0];

  const filterHref = (cid?: string) =>
    cid
      ? `/instructor/learner-insights?course=${cid}`
      : "/instructor/learner-insights";

  // Learners in the matrix — only those with at least one mastery row,
  // sorted by their avg mastery ascending (weakest first).
  const matrixLearners = [...new Set(states.map((s) => s.userId))]
    .map((uid) => {
      const rows = states.filter((s) => s.userId === uid);
      const avg = rows.reduce((s, r) => s + r.masteryProbability, 0) / rows.length;
      return { userId: uid, avg };
    })
    .sort((a, b) => a.avg - b.avg);

  return (
    <main>
      <header>
        <h1 className="h-display text-3xl font-bold sm:text-4xl">
          Learner Insights
          <span className="ml-2 align-middle text-sm font-normal text-faint">
            (BKT mastery)
          </span>
        </h1>
        <p className="mt-2 text-muted">
          Xác suất master từng skill của từng học viên, ước lượng bằng Bayesian
          Knowledge Tracing sau mỗi quiz attempt. Mastered = P ≥ {Math.round(
            MASTERY_THRESHOLD * 100,
          )}
          %, Weak = P &lt; {Math.round(WEAK_THRESHOLD * 100)}%.
        </p>
      </header>

      {/* KPI */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi label="Học viên tracked" value={trackedLearners} tone="brand" />
        <Kpi label="Skill tracked" value={trackedSkills} tone="brand" />
        <Kpi
          label="Mastery TB"
          value={`${Math.round(avgMastery * 100)}%`}
          tone={avgMastery >= 0.6 ? "success" : avgMastery >= 0.4 ? "accent" : "danger"}
        />
        <Kpi
          label="HV có skill yếu"
          value={weakLearnersSet.size}
          tone={weakLearnersSet.size > 0 ? "accent" : "success"}
        />
      </section>

      {weakestSkill && (
        <p className="mt-4 text-sm">
          <span className="text-faint">Skill yếu nhất:</span>{" "}
          <span className="font-semibold text-accent-700">
            {weakestSkill.name}
          </span>{" "}
          — TB {(weakestSkill.avg * 100).toFixed(0)}% trên {weakestSkill.count} học
          viên ({weakestSkill.weak} dưới ngưỡng weak).
        </p>
      )}

      {/* Course filter */}
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
        {ownedCourses.map((c) => (
          <Link
            key={c.id}
            href={filterHref(c.id)}
            className={courseFilter === c.id ? "chip-brand" : "chip"}
          >
            {c.title}
          </Link>
        ))}
      </div>

      {/* Matrix */}
      <section className="mt-8">
        <h2 className="text-base font-semibold">
          Ma trận học viên × skill
          <span className="ml-2 text-xs font-normal text-faint">
            (sắp xếp học viên yếu trước)
          </span>
        </h2>
        {matrixLearners.length === 0 || skills.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-10 text-center text-sm text-muted">
            Chưa có dữ liệu BKT — học viên cần submit ít nhất 1 quiz có question
            đã tag skill.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="sticky left-0 z-10 bg-[rgb(var(--surface-muted))] px-4 py-3">
                    Học viên
                  </th>
                  {skills.map((sk) => (
                    <th
                      key={sk.id}
                      className="px-3 py-3 text-center font-medium normal-case"
                      title={sk.code}
                    >
                      <span className="block max-w-[10ch] truncate">{sk.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {matrixLearners.map((row) => {
                  const learner = learnerById.get(row.userId);
                  return (
                    <tr
                      key={row.userId}
                      className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                    >
                      <td className="sticky left-0 z-10 bg-[rgb(var(--surface))] px-4 py-2.5">
                        <p className="text-sm font-medium">
                          {learner?.displayName ?? "—"}
                        </p>
                        <p className="text-[10px] text-faint">
                          TB {(row.avg * 100).toFixed(0)}%
                        </p>
                      </td>
                      {skills.map((sk) => {
                        const cell = stateByPair.get(`${row.userId}:${sk.id}`);
                        if (!cell) {
                          return (
                            <td
                              key={sk.id}
                              className="px-2 py-2 text-center text-xs text-faint"
                            >
                              —
                            </td>
                          );
                        }
                        return (
                          <td
                            key={sk.id}
                            className="px-2 py-2 text-center"
                            title={`${cell.correctCount}/${cell.attempts} đúng`}
                          >
                            <MasteryCell p={cell.masteryProbability} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-skill summary */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Coverage theo skill</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3 text-right">HV tracked</th>
                <th className="px-4 py-3 text-right">Mastery TB</th>
                <th className="px-4 py-3 text-right">Đã master</th>
                <th className="px-4 py-3 text-right">Yếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {perSkillStats.map((s) => (
                <tr
                  key={s.id}
                  className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{s.name}</p>
                    <code className="text-[10px] text-faint">{s.code}</code>
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums">
                    {s.count}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums">
                    {s.count > 0 ? `${Math.round(s.avg * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-success-600">
                    {s.mastered}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-danger-600">
                    {s.weak}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MasteryCell({ p }: { p: number }) {
  const pct = Math.round(p * 100);
  let bg = "bg-[rgb(var(--surface-muted))] text-muted";
  if (p >= MASTERY_THRESHOLD) bg = "bg-emerald-500 text-white";
  else if (p >= 0.7) bg = "bg-success-500/80 text-white";
  else if (p >= 0.5) bg = "bg-amber-400 text-amber-950";
  else if (p >= WEAK_THRESHOLD) bg = "bg-orange-400 text-orange-950";
  else bg = "bg-danger-500 text-white";
  return (
    <span
      className={`inline-flex h-7 w-12 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${bg}`}
    >
      {pct}%
    </span>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
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
    </div>
  );
}
