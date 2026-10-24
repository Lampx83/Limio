import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getSectionGoal, listMyGoals, type GoalView } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getLearnerCenterAccess } from "@/lib/centerAccess";
import { loadGoalWithProgress } from "@/lib/goalProgress";
import GoalsClient, { type CourseGoalCard } from "./GoalsClient";

export const dynamic = "force-dynamic";

/**
 * CENTER C6.3 — trang "Mục tiêu học tập" của học viên: mục tiêu theo từng khoá (riêng hoặc gợi ý của lớp) kèm tiến độ
 * theo kỹ năng bằng nhãn và nhận định so với kế hoạch; mục tiêu chung; mục tiêu đã đóng. Không có % mastery.
 */
export default async function MucTieuPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/muc-tieu");
  const userId = session.user.id;
  if (!(await getLearnerCenterAccess(userId))) redirect("/me/dashboard");

  const [enrollments, mine] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, status: { in: ["active", "completed"] } },
      select: { courseId: true, sectionId: true, course: { select: { title: true } }, section: { select: { id: true, name: true } } },
      orderBy: { enrolledAt: "asc" },
    }),
    listMyGoals(userId, { includeInactive: true }),
  ]);

  // Chỉ các khoá thuộc lớp có lịch (tính năng trung tâm) hoặc đã có mục tiêu.
  const goalCourseIds = new Set(mine.filter((g) => g.courseId).map((g) => g.courseId as string));
  const scheduled = new Set(
    (
      await prisma.classMeeting.findMany({
        where: { sectionId: { in: enrollments.map((e) => e.sectionId) } },
        distinct: ["sectionId"],
        select: { sectionId: true },
      })
    ).map((m) => m.sectionId),
  );
  const relevant = enrollments.filter((e) => scheduled.has(e.sectionId) || goalCourseIds.has(e.courseId));

  const cards: CourseGoalCard[] = await Promise.all(
    relevant.map(async (e) => {
      const withProgress = await loadGoalWithProgress(userId, e.courseId, "learner");
      const sectionGoal = e.sectionId ? await getSectionGoal(userId, e.sectionId).catch(() => null) : null;
      const personal = withProgress?.effective.source === "personal" ? mine.find((g) => g.id === withProgress.effective.goal?.id) ?? null : null;
      return {
        courseId: e.courseId,
        courseTitle: e.course.title,
        sectionName: e.section?.name ?? null,
        personal: personal as GoalView | null,
        sectionGoal,
        source: withProgress?.effective.source ?? "none",
        effective: withProgress?.effective.goal ?? null,
        progress: withProgress?.progress ?? null,
      };
    }),
  );

  const general = mine.filter((g) => !g.courseId);
  const closed = mine.filter((g) => g.courseId && g.status !== "active");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Mục tiêu học tập</h1>
      <p className="mt-1 text-sm text-muted">
        Đặt mục tiêu (ví dụ HSK 3 trước 30/06/2027, 4 giờ mỗi tuần) để xem mình đang ở đâu so với kế hoạch. Đây chỉ là gợi ý để bạn tự điều chỉnh,
        không phải điểm số. Mục tiêu của bạn chỉ bạn và giáo viên của lớp xem được.
      </p>
      <GoalsClient cards={JSON.parse(JSON.stringify(cards))} general={general} closed={closed} />
    </main>
  );
}
