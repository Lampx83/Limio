import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { EmptyState, KpiCard } from "@/components/ui";
import { loadAssignmentsWithCounts } from "./assignmentQueries";
import CourseAssignmentsBrowser from "./CourseAssignmentsBrowser";
import CourseFilterSelect from "@/components/CourseFilterSelect";

export const dynamic = "force-dynamic";

type View = "list" | "pending";

export default async function InstructorAssignmentsPage({
  searchParams,
}: {
  searchParams?: { course?: string; lesson?: string; filter?: string; view?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/assignments");
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
        <h1 className="text-2xl font-bold">Assignment</h1>
        <EmptyState
          className="mt-6"
          icon="📝"
          title="Bạn chưa là instructor của khoá nào"
          description="Tạo khoá đầu tiên để có assignment cần chấm."
          actions={[{ label: "+ Tạo khoá", href: "/instructor/courses/new" }]}
        />
      </main>
    );
  }

  const courseIds = ownedCourses.map((c) => c.id);
  const selectedCourseId =
    searchParams?.course && courseIds.includes(searchParams.course)
      ? searchParams.course
      : null;
  const filter = searchParams?.filter ?? "all";
  const view: View = searchParams?.view === "pending" ? "pending" : "list";
  const requestedLessonId = searchParams?.lesson ?? null;

  const scopedCourseIds = selectedCourseId ? [selectedCourseId] : courseIds;

  // KPI metrics: pending grading + totals + overdue.
  const [
    pendingSubmissionsCount,
    pendingEssaysCount,
    totalAssignments,
    gradedSubmissionsCount,
    overdueAssignments,
  ] = await Promise.all([
    prisma.assignmentSubmission.count({
      where: {
        status: "submitted",
        assignment: { lesson: { module: { courseId: { in: scopedCourseIds } } } },
      },
    }),
    prisma.answerResponse.count({
      where: {
        needsGrading: true,
        manualScore: null,
        attempt: { quiz: { courseId: { in: scopedCourseIds } } },
      },
    }),
    prisma.assignment.count({
      where: { lesson: { module: { courseId: { in: scopedCourseIds } } } },
    }),
    prisma.assignmentSubmission.count({
      where: {
        status: "graded",
        assignment: { lesson: { module: { courseId: { in: scopedCourseIds } } } },
      },
    }),
    prisma.assignment.count({
      where: {
        dueAt: { lt: new Date() },
        lesson: { module: { courseId: { in: scopedCourseIds } } },
        submissions: { some: { status: "submitted" } },
      },
    }),
  ]);
  const totalPending = pendingSubmissionsCount + pendingEssaysCount;

  const buildHref = (next: {
    course?: string | null;
    lesson?: string | null;
    filter?: string;
    view?: View;
  }) => {
    const params = new URLSearchParams();
    const c = next.course === undefined ? selectedCourseId : next.course;
    if (c) params.set("course", c);
    const l = next.lesson === undefined ? requestedLessonId : next.lesson;
    if (l && c) params.set("lesson", l);
    const f = next.filter ?? filter;
    if (f && f !== "all") params.set("filter", f);
    const v = next.view ?? view;
    if (v && v !== "list") params.set("view", v);
    const qs = params.toString();
    return `/instructor/assignments${qs ? `?${qs}` : ""}`;
  };

  return (
    <main>
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold">Assignment</h1>
        <p className="mt-2 text-muted">
          Quản lý assignment + chấm tập trung mọi submission đang chờ trong{" "}
          {ownedCourses.length} khoá bạn phụ trách.
        </p>
      </header>

      {/* KPI cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard label="Tổng assignment" value={totalAssignments} tone="brand" />
        <KpiCard
          label="Đang chờ chấm"
          value={totalPending}
          sub={
            totalPending > 0
              ? `${pendingSubmissionsCount} bài nộp · ${pendingEssaysCount} tự luận`
              : "Sạch hết"
          }
          tone={totalPending > 0 ? "accent" : "success"}
        />
        <KpiCard
          label="Đã chấm"
          value={gradedSubmissionsCount}
          tone="success"
        />
        <KpiCard
          label="Assignment quá hạn"
          value={overdueAssignments}
          sub={overdueAssignments > 0 ? "Còn bài chưa chấm" : undefined}
          tone={overdueAssignments > 0 ? "danger" : "success"}
        />
      </section>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 border-b border-token">
        <Link
          href={buildHref({ view: "list" })}
          className={
            "border-b-2 px-4 py-2 text-sm transition-colors " +
            (view === "list"
              ? "border-brand-500 font-semibold text-brand-700 dark:text-brand-300"
              : "border-transparent text-muted hover:text-[rgb(var(--text))]")
          }
        >
          Danh sách assignment
        </Link>
        <Link
          href={buildHref({ view: "pending" })}
          className={
            "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors " +
            (view === "pending"
              ? "border-brand-500 font-semibold text-brand-700 dark:text-brand-300"
              : "border-transparent text-muted hover:text-[rgb(var(--text))]")
          }
        >
          Cần chấm
          {totalPending > 0 && (
            <span className="rounded-full bg-accent-100 px-1.5 text-[10px] font-semibold tabular-nums text-accent-700">
              {totalPending}
            </span>
          )}
        </Link>
      </div>

      {/* Course filter — chỉ dùng cho tab "Cần chấm" (stream xuyên khoá). Tab
          "Danh sách assignment" chọn khoá qua bước drill-down bên dưới. */}
      {view === "pending" && (
        <div className="mt-6">
          <CourseFilterSelect
            value={selectedCourseId ?? ""}
            options={[
              {
                value: "",
                label: `Tất cả khoá học (${ownedCourses.length})`,
                href: buildHref({ course: null }),
              },
              ...ownedCourses.map((c) => ({
                value: c.id,
                label: c.title,
                href: buildHref({ course: c.id }),
              })),
            ]}
          />
        </div>
      )}

      {view === "list" ? (
        <AssignmentDrillDown
          ownedCourses={ownedCourses}
          courseIds={scopedCourseIds}
          selectedCourseId={selectedCourseId}
          requestedLessonId={requestedLessonId}
          filter={filter}
          buildHref={buildHref}
        />
      ) : (
        <PendingStreamView courseIds={scopedCourseIds} />
      )}
    </main>
  );
}

type BuildHref = (n: {
  course?: string | null;
  lesson?: string | null;
  filter?: string;
  view?: View;
}) => string;

/**
 * Drill-down: chọn khoá học → danh sách bài học (theo thứ tự module) →
 * danh sách assignment của bài học đó → (link ra) danh sách sinh viên nộp bài.
 */
async function AssignmentDrillDown({
  ownedCourses,
  courseIds,
  selectedCourseId,
  requestedLessonId,
  filter,
  buildHref,
}: {
  ownedCourses: { id: string; title: string }[];
  courseIds: string[];
  selectedCourseId: string | null;
  requestedLessonId: string | null;
  filter: string;
  buildHref: BuildHref;
}) {
  // Bước 1: chọn khoá học.
  if (!selectedCourseId) {
    const modules = await prisma.module.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        id: true,
        courseId: true,
        lessons: { select: { id: true } },
      },
    });
    const lessonCourse = new Map<string, string>();
    for (const m of modules) {
      for (const l of m.lessons) lessonCourse.set(l.id, m.courseId);
    }
    const assignments = await loadAssignmentsWithCounts(modules.map((m) => m.id));

    const stats = new Map<
      string,
      { lessonCount: number; assignmentCount: number; pendingCount: number }
    >();
    for (const c of ownedCourses) {
      if (courseIds.includes(c.id)) {
        stats.set(c.id, { lessonCount: 0, assignmentCount: 0, pendingCount: 0 });
      }
    }
    for (const m of modules) {
      const s = stats.get(m.courseId);
      if (s) s.lessonCount += m.lessons.length;
    }
    for (const a of assignments) {
      const cid = lessonCourse.get(a.lessonId!);
      const s = cid ? stats.get(cid) : undefined;
      if (s) {
        s.assignmentCount += 1;
        s.pendingCount += a.counts.pending;
      }
    }

    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Chọn khoá học</h2>
        {ownedCourses.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="📚"
            title="Chưa có khoá học nào"
            description="Tạo khoá học đầu tiên để bắt đầu quản lý assignment."
          />
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownedCourses.map((c) => {
              const s = stats.get(c.id) ?? {
                lessonCount: 0,
                assignmentCount: 0,
                pendingCount: 0,
              };
              return (
                <li key={c.id}>
                  <Link
                    href={buildHref({ course: c.id, lesson: null })}
                    className="block rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card transition-colors hover:border-brand-300"
                    prefetch={false}
                  >
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-1 text-xs text-faint">
                      {s.lessonCount} bài học · {s.assignmentCount} assignment
                    </p>
                    {s.pendingCount > 0 && (
                      <span className="chip-accent mt-2 inline-block text-[10px]">
                        {s.pendingCount} chờ chấm
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  const course = ownedCourses.find((c) => c.id === selectedCourseId);
  if (!course) redirect(buildHref({ course: null, lesson: null }));

  return (
    <CourseAssignmentsBrowser
      courseId={course.id}
      courseTitle={course.title}
      requestedLessonId={requestedLessonId}
      filter={filter}
      buildHref={buildHref}
      backToAllCoursesHref={buildHref({ course: null, lesson: null })}
    />
  );
}

async function PendingStreamView({ courseIds }: { courseIds: string[] }) {
  const [assignmentSubs, essayResps] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: {
        status: "submitted",
        assignment: { lesson: { module: { courseId: { in: courseIds } } } },
      },
      orderBy: { submittedAt: "asc" },
      take: 100,
      select: {
        id: true,
        submittedAt: true,
        user: { select: { displayName: true, email: true } },
        assignment: {
          select: {
            id: true,
            title: true,
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
    }),
    prisma.answerResponse.findMany({
      where: {
        needsGrading: true,
        manualScore: null,
        attempt: { quiz: { courseId: { in: courseIds } } },
      },
      orderBy: { answeredAt: "asc" },
      take: 100,
      select: {
        id: true,
        answeredAt: true,
        question: { select: { prompt: true } },
        attempt: {
          select: {
            user: { select: { displayName: true, email: true } },
            quiz: {
              select: {
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
    }),
  ]);

  type StreamItem = {
    key: string;
    kind: "assignment" | "essay";
    submittedAt: Date;
    learnerName: string;
    learnerEmail: string;
    courseTitle: string;
    title: string;
    subTitle: string;
    href: string;
  };

  const items: StreamItem[] = [
    ...assignmentSubs.map<StreamItem>((s) => ({
      key: `a:${s.id}`,
      kind: "assignment",
      submittedAt: s.submittedAt,
      learnerName: s.user.displayName,
      learnerEmail: s.user.email,
      courseTitle: s.assignment.lesson?.module.course.title ?? "",
      title: s.assignment.title,
      subTitle: s.assignment.lesson?.title ?? "",
      href: `/instructor/assignments/${s.assignment.id}/submissions`,
    })),
    ...essayResps.map<StreamItem>((r) => {
      const course =
        r.attempt.quiz.lesson?.module.course ??
        ({ id: r.attempt.quiz.courseId, title: "—" } as { id: string | null; title: string });
      return {
        key: `e:${r.id}`,
        kind: "essay",
        submittedAt: r.answeredAt,
        learnerName: r.attempt.user.displayName,
        learnerEmail: r.attempt.user.email,
        courseTitle: course.title,
        title: r.attempt.quiz.title,
        subTitle: r.question.prompt.slice(0, 120),
        href: `/instructor/grade-essays#essay-${r.id}`,
      };
    }),
  ].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  return (
    <>
      <div className="mt-3 text-sm text-muted">
        {items.length} item chờ chấm, sắp xếp theo nộp sớm nhất.
      </div>
      <section className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="Không còn bài nào chờ chấm"
            description="Tất cả submission đã được chấm xong. Kiểm tra lại lần sau."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Khoá / Nội dung</th>
                  <th className="px-4 py-3">Chờ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {items.map((it) => (
                  <tr
                    key={it.key}
                    className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                  >
                    <td className="px-4 py-3 align-top">
                      {it.kind === "assignment" ? (
                        <span className="chip-accent text-[10px]">Assignment</span>
                      ) : (
                        <span className="chip text-[10px]">Essay quiz</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm">{it.learnerName}</p>
                      <p className="mt-0.5 text-xs text-faint">{it.learnerEmail}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-xs text-muted">{it.courseTitle}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm">{it.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-faint">
                        {it.subTitle}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      {formatAgo(it.submittedAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Link href={it.href} className="btn-secondary btn-sm" prefetch={false}>
                        Chấm
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function formatAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const hours = ms / (1000 * 3600);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
