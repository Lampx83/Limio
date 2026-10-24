import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getSectionRoster,
  getClassSchedule,
  getCoursePlan,
  getTeachingScope,
  assertCanViewSection,
  getSectionAttendanceSummary,
  getSectionGoal,
  listCourseInstructors,
  CourseAuthzError,
  CourseError,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import SectionRosterClient from "./SectionRosterClient";
import SectionScheduleClient from "./SectionScheduleClient";
import SectionAttendanceSummary from "./SectionAttendanceSummary";
import PackUpdateBanner from "./PackUpdateBanner";
import SectionGoalsCard from "./SectionGoalsCard";
import { loadLearnerGoalProgress } from "@/lib/goalProgress";
import { getInstructorCenterAccess } from "@/lib/centerAccess";

export const dynamic = "force-dynamic";

export default async function SectionRosterPage({
  params,
}: {
  params: { id: string; sectionId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/sections/${params.sectionId}`,
    );
  }
  const userId = session.user.id;

  let roster;
  try {
    roster = await getSectionRoster(userId, params.sectionId);
  } catch (e) {
    if (e instanceof CourseError && e.code === "section_not_found") notFound();
    if (e instanceof CourseAuthzError) {
      if (e.code === "not_found") notFound();
      redirect(`/instructor/courses/${params.id}?tab=sections`);
    }
    throw e;
  }

  if (roster.section.courseId !== params.id) notFound();

  // Người chỉ dạy (giảng viên trung tâm) chỉ vào lớp được xếp cho mình, và ở đây chỉ để xem.
  const scope = await getTeachingScope(userId, params.id);
  const canManage = scope === "manage";
  if (!canManage) {
    const sectionRow = await prisma.courseSection.findUnique({ where: { id: params.sectionId }, select: { instructorId: true } });
    try {
      await assertCanViewSection(userId, { id: params.sectionId, courseId: params.id, instructorId: sectionRow?.instructorId ?? null });
    } catch (e) {
      if (e instanceof CourseAuthzError) redirect("/instructor/dashboard");
      throw e;
    }
  }

  // Tính năng trung tâm (lịch dạy, chuyên cần, giáo trình) chỉ hiện khi tài khoản được bật; không thì trang lớp
  // chỉ còn danh sách học viên như trước và không tốn thêm truy vấn.
  const centerEnabled = await getInstructorCenterAccess(userId);
  const [schedule, instructors, attendance, coursePlan] = centerEnabled
    ? await Promise.all([
        getClassSchedule(userId, params.sectionId),
        listCourseInstructors(params.id),
        getSectionAttendanceSummary(userId, params.sectionId),
        getCoursePlan(userId, params.id),
      ])
    : [null, [], null, null];
  const [sectionGoal, goalRows] = centerEnabled
    ? await Promise.all([getSectionGoal(userId, params.sectionId), loadLearnerGoalProgress(userId, params.sectionId)])
    : [null, []];
  const teachers = instructors.map((i) => ({ id: i.userId, name: i.displayName }));
  const autoSendSummary =
    (await prisma.courseSection.findUnique({ where: { id: params.sectionId }, select: { autoSendSummary: true } }))?.autoSendSummary ?? true;

  return (
    <main>
      <Link
        href={canManage ? `/instructor/courses/${params.id}?tab=sections` : "/instructor/lich-day"}
        className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
      >
        ← {canManage ? roster.section.courseTitle : "Lịch dạy"}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{roster.section.name}</h1>
      {roster.section.description && (
        <p className="mt-1 text-sm text-faint">{roster.section.description}</p>
      )}
      {canManage && coursePlan?.pack?.hasUpdate && (
        <PackUpdateBanner
          courseId={params.id}
          packTitle={coursePlan.pack.title}
          copiedVersion={coursePlan.pack.copiedVersion}
          currentVersion={coursePlan.pack.currentVersion}
        />
      )}
      {schedule && <SectionScheduleClient courseId={params.id} sectionId={params.sectionId} initial={schedule} teachers={teachers} canManage={canManage} viewerId={userId} autoSendSummary={autoSendSummary} />}
      {attendance && <SectionAttendanceSummary summary={attendance} />}
      {centerEnabled && (
        <SectionGoalsCard
          sectionId={params.sectionId}
          courseId={params.id}
          canManage={canManage}
          sectionGoal={sectionGoal}
          rows={JSON.parse(JSON.stringify(goalRows))}
        />
      )}
      <SectionRosterClient
        courseId={params.id}
        sectionId={params.sectionId}
        initial={roster}
      />
    </main>
  );
}
