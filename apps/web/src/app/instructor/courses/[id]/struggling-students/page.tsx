import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

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
      <main>
        <Forbidden />
      </main>
    );
  }

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

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });

  if (enrollments.length === 0) {
    return (
      <main>
        <Header courseId={course.id} courseTitle={course.title} />
        <div className="mt-6 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                      </div>
          <p className="mt-4 text-muted">
            Chưa có học viên nào đăng ký khóa này.
          </p>
        </div>
      </main>
    );
  }

  const userIds = enrollments.map((e) => e.user.id);

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

  const needHelpCount = rows.filter(
    (r) => r.unresolvedFlags > 0 || r.weakSkills > 0,
  ).length;

  return (
    <main>
      <Header courseId={course.id} courseTitle={course.title} />
      <p className="mt-2 text-muted">
        Học viên được sắp xếp theo số lỗi tư duy chưa khắc phục, sau đó số kỹ năng yếu.
      </p>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Tổng học viên" value={rows.length} tone="brand" />
        <Stat
          label="Cần hỗ trợ"
          value={needHelpCount}
          tone={needHelpCount > 0 ? "danger" : "success"}
        />
        <Stat
          label="Đang ổn định"
          value={rows.length - needHelpCount}
          tone="success"
        />
      </div>

      {/* Table inside card */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--surface-muted))]">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Học viên</th>
              <th className="px-4 py-3">Lỗi tư duy chưa khắc phục</th>
              <th className="px-4 py-3">Kỹ năng yếu</th>
              <th className="px-4 py-3">Hoạt động gần nhất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {rows.map((r) => (
              <tr
                key={r.userId}
                className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/instructor/courses/${course.id}/struggling-students/${r.userId}`}
                    className="group block"
                    prefetch={false}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                        {r.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="font-semibold transition-colors group-hover:text-brand-600">
                          {r.displayName}
                        </div>
                        <div className="text-xs text-faint">{r.email}</div>
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.unresolvedFlags > 0 ? (
                    <span
                      className={
                        r.unresolvedFlags >= 3 ? "chip-danger" : "chip-accent"
                      }
                    >
                      {r.unresolvedFlags}
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.weakSkills > 0 ? (
                    <span className="font-medium tabular-nums">
                      {r.weakSkills}
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {r.lastActivity
                    ? formatDateTime(r.lastActivity)
                    : "Chưa có"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Quay lại khóa học
      </Link>
      <div className="mt-4">
        <span className="chip-brand">Analytics</span>
        <h1 className="mt-3 text-2xl font-bold">
          Học viên cần hỗ trợ
        </h1>
        <p className="mt-1 text-sm text-faint">{courseTitle}</p>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "success" | "danger";
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
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

function Forbidden() {
  return (
    <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
      Bạn không có quyền xem trang này.
    </div>
  );
}
