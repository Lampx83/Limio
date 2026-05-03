import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WEAK_MASTERY_THRESHOLD = 0.5;
const WEAK_MIN_ATTEMPTS = 2;

export default async function StrugglingStudentsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/struggling-students`,
    );
  }
  const userId = session.user.id;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, slug: true },
  });
  if (!course) notFound();

  const ok = await canEditCourse(userId, course.id);
  if (!ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Bạn không có quyền xem trang này.
        </p>
      </main>
    );
  }

  // Step 1: misconception IDs that are testable in this course (any option of
  // any question in any quiz of this course).
  const courseMcRows = await prisma.questionOption.findMany({
    where: {
      misconceptionId: { not: null },
      question: { quiz: { courseId: course.id } },
    },
    select: { misconceptionId: true },
    distinct: ["misconceptionId"],
  });
  const courseMcIds = courseMcRows
    .map((r) => r.misconceptionId)
    .filter((x): x is string => x !== null);

  // Step 2: skill IDs tagged on lessons or questions in this course.
  const [csm, qst] = await Promise.all([
    prisma.contentSkillMapping.findMany({
      where: { contentType: "lesson", lesson: { module: { courseId: course.id } } },
      select: { skillId: true },
    }),
    prisma.questionSkillTag.findMany({
      where: { question: { quiz: { courseId: course.id } } },
      select: { skillId: true },
    }),
  ]);
  const courseSkillIds = Array.from(
    new Set([...csm.map((r) => r.skillId), ...qst.map((r) => r.skillId)]),
  );

  // Step 3: enrolled students.
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });

  if (enrollments.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Header courseId={course.id} courseTitle={course.title} />
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          Chưa có học viên nào đăng ký khóa này.
        </p>
      </main>
    );
  }

  const userIds = enrollments.map((e) => e.user.id);

  // Step 4: per-user unresolved-flag count (course-scoped).
  const unresolvedFlagGroups =
    courseMcIds.length === 0
      ? []
      : await prisma.misconceptionFlag.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds },
            misconceptionId: { in: courseMcIds },
            resolved: false,
          },
          _count: { _all: true },
        });
  const unresolvedByUser = new Map(
    unresolvedFlagGroups.map((g) => [g.userId, g._count._all]),
  );

  // Step 5: per-user weak-skill count (course-scoped).
  const weakStateRows =
    courseSkillIds.length === 0
      ? []
      : await prisma.learnerSkillState.findMany({
          where: {
            userId: { in: userIds },
            skillId: { in: courseSkillIds },
            masteryProbability: { lt: WEAK_MASTERY_THRESHOLD },
            attempts: { gte: WEAK_MIN_ATTEMPTS },
          },
          select: { userId: true },
        });
  const weakByUser = new Map<string, number>();
  for (const r of weakStateRows) {
    weakByUser.set(r.userId, (weakByUser.get(r.userId) ?? 0) + 1);
  }

  // Step 6: most recent activity per user (any LearningEvent in this course).
  const lastEventRows = await prisma.learningEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, courseId: course.id },
    _max: { occurredAt: true },
  });
  const lastActivityByUser = new Map(
    lastEventRows.map((r) => [r.userId, r._max.occurredAt]),
  );

  type Row = {
    userId: string;
    displayName: string;
    email: string;
    unresolvedFlags: number;
    weakSkills: number;
    lastActivity: Date | null;
  };
  const rows: Row[] = enrollments.map((e) => ({
    userId: e.user.id,
    displayName: e.user.displayName,
    email: e.user.email,
    unresolvedFlags: unresolvedByUser.get(e.user.id) ?? 0,
    weakSkills: weakByUser.get(e.user.id) ?? 0,
    lastActivity: lastActivityByUser.get(e.user.id) ?? null,
  }));
  rows.sort((a, b) => {
    if (b.unresolvedFlags !== a.unresolvedFlags)
      return b.unresolvedFlags - a.unresolvedFlags;
    return b.weakSkills - a.weakSkills;
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Header courseId={course.id} courseTitle={course.title} />
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Học viên được sắp xếp theo số lỗi tư duy chưa khắc phục, sau đó số kỹ năng yếu.
      </p>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
            <th className="py-2 pr-3">Học viên</th>
            <th className="py-2 pr-3">Lỗi tư duy chưa khắc phục</th>
            <th className="py-2 pr-3">Kỹ năng yếu</th>
            <th className="py-2 pr-3">Hoạt động gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.userId}
              className="border-b border-slate-200 dark:border-slate-800"
            >
              <td className="py-2 pr-3">
                <Link
                  href={`/instructor/courses/${course.id}/struggling-students/${r.userId}`}
                  className="block hover:underline"
                >
                  <div className="font-medium">{r.displayName}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </Link>
              </td>
              <td className="py-2 pr-3">
                {r.unresolvedFlags > 0 ? (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      r.unresolvedFlags >= 3
                        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    }`}
                  >
                    {r.unresolvedFlags}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-2 pr-3">
                {r.weakSkills > 0 ? (
                  <span className="text-slate-700 dark:text-slate-300">
                    {r.weakSkills}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                {r.lastActivity
                  ? new Date(r.lastActivity).toLocaleString("vi-VN")
                  : "Chưa có"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function Header({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  return (
    <>
      <Link
        href={`/instructor/courses/${courseId}`}
        className="text-sm underline"
      >
        ← Quay lại khóa học
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        Học viên cần hỗ trợ — {courseTitle}
      </h1>
    </>
  );
}
