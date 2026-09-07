import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import EssayGradeForm from "./EssayGradeForm";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";

export const dynamic = "force-dynamic";

export default async function GradeEssaysPage({
  searchParams,
}: {
  searchParams?: { course?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/grade-essays");
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
        <h1 className="h-display text-3xl font-bold">Chấm essay quiz</h1>
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

  // Exam essays live in a SEPARATE table (ExamAnswer) from quiz essays
  // (AnswerResponse). Surface them here too — grouped by exam — so code-based
  // exam submissions don't get stranded in the per-exam grading page only.
  const examAnswers = await prisma.examAnswer.findMany({
    where: {
      needsGrading: true,
      attempt: { exam: { courseId: { in: courseIds } } },
      question: { type: { in: ["essay", "short_answer"] } },
    },
    select: {
      id: true,
      attempt: {
        select: {
          exam: { select: { id: true, title: true, courseId: true } },
        },
      },
    },
  });
  const examGroupsMap = new Map<
    string,
    { examId: string; courseId: string; title: string; count: number }
  >();
  for (const a of examAnswers) {
    const ex = a.attempt.exam;
    const cur = examGroupsMap.get(ex.id);
    if (cur) cur.count += 1;
    else
      examGroupsMap.set(ex.id, {
        examId: ex.id,
        courseId: ex.courseId,
        title: ex.title,
        count: 1,
      });
  }
  const examGroups = [...examGroupsMap.values()].sort((a, b) => b.count - a.count);

  const responses = await prisma.answerResponse.findMany({
    where: {
      needsGrading: true,
      manualScore: null,
      attempt: { quiz: { courseId: { in: courseIds } } },
    },
    orderBy: { answeredAt: "asc" },
    take: 100,
    select: {
      id: true,
      response: true,
      answeredAt: true,
      confidence: true,
      question: {
        select: { id: true, prompt: true, points: true, explanation: true },
      },
      attempt: {
        select: {
          id: true,
          user: { select: { displayName: true, email: true } },
          quiz: {
            select: {
              id: true,
              title: true,
              courseId: true,
              lesson: {
                select: {
                  title: true,
                  module: {
                    select: { course: { select: { id: true, title: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const filterHref = (cid?: string) =>
    cid
      ? `/instructor/grade-essays?course=${cid}`
      : "/instructor/grade-essays";

  return (
    <main>
      <header>
        <h1 className="h-display text-3xl font-bold sm:text-4xl">
          Chấm tự luận
        </h1>
        <p className="mt-2 text-muted">
          Bài tự luận cần chấm tay — đề thi và quiz, sắp xếp theo nộp sớm nhất.
        </p>
      </header>

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
            prefetch={false}
          >
            {c.title}
          </Link>
        ))}
      </div>

      {/* Exam essays — grouped per exam, graded in the dedicated per-exam page
          (AI gợi ý + chấm lại). */}
      {examGroups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Tự luận đề thi
          </h2>
          <div className="mt-3 space-y-3">
            {examGroups.map((g) => (
              <Link
                key={g.examId}
                href={`/instructor/courses/${g.courseId}/exams/${g.examId}/grading`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card transition hover:border-brand-300"
                prefetch={false}
              >
                <div>
                  <p className="font-medium">{g.title}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {g.count} bài tự luận chờ chấm
                  </p>
                </div>
                <span className="chip-brand text-xs">Chấm bài →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quiz essays — graded inline below. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
          Tự luận quiz
        </h2>
        <div className="mt-3">
        {responses.length === 0 ? (
          <div className="rounded-2xl border border-success-200 bg-success-50 p-10 text-center text-sm text-success-700">
            🎉 Không còn essay quiz nào chờ chấm.
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((r) => {
              const course =
                r.attempt.quiz.lesson?.module.course ??
                ({
                  id: r.attempt.quiz.courseId,
                  title: "—",
                } as { id: string | null; title: string });
              const responseText =
                typeof r.response === "string"
                  ? r.response
                  : JSON.stringify(r.response);
              return (
                <article
                  key={r.id}
                  id={`essay-${r.id}`}
                  className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-token pb-3">
                    <div>
                      <p className="font-medium">
                        {r.attempt.user.displayName}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {course.title} · {r.attempt.quiz.title} · nộp{" "}
                        {formatAgo(r.answeredAt)}
                      </p>
                    </div>
                    <span className="chip text-[10px]">
                      Tối đa {r.question.points} điểm
                    </span>
                  </header>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                      Đề bài
                    </p>
                    <SafeHtml
                      html={plainToRichHtml(r.question.prompt)}
                      className="prose prose-sm mt-1 max-w-none dark:prose-invert"
                    />
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                      Bài làm{" "}
                      {r.confidence !== null && (
                        <span className="ml-1 font-normal normal-case">
                          (confidence: {r.confidence}/5)
                        </span>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm">
                      {responseText}
                    </p>
                  </div>

                  {r.question.explanation && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                        Gợi ý đáp án
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {r.question.explanation}
                      </p>
                    </div>
                  )}

                  <EssayGradeForm
                    responseId={r.id}
                    maxScore={r.question.points}
                  />
                </article>
              );
            })}
          </div>
        )}
        </div>
      </section>
    </main>
  );
}

function formatAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const hours = ms / (1000 * 3600);
  if (hours < 1) return `${Math.round(hours * 60)}m trước`;
  if (hours < 24) return `${Math.round(hours)}h trước`;
  return `${Math.round(hours / 24)}d trước`;
}
