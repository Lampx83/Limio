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
import SectionTabs from "./SectionTabs";
import { resolveSectionTab } from "@/lib/sectionTabs";
import { loadLearnerGoalProgress } from "@/lib/goalProgress";
import { getInstructorCenterAccess } from "@/lib/centerAccess";

export const dynamic = "force-dynamic";

export default async function SectionRosterPage({
  params,
  searchParams,
}: {
  params: { id: string; sectionId: string };
  searchParams: { tab?: string };
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
  // Hai tab khi dùng tính năng trung tâm: "Lịch dạy" (đặt lịch, các buổi) và "Học viên" (chuyên cần, mục tiêu, danh sách).
  // Mỗi tab chỉ tải dữ liệu của chính nó. Không dùng trung tâm: chỉ có danh sách học viên như trước.
  const tab = resolveSectionTab(searchParams.tab, centerEnabled);
  const showSchedule = centerEnabled && tab === "lich-day";
  const showStudents = tab === "hoc-vien";
  const [schedule, instructors, coursePlan] = showSchedule
    ? await Promise.all([getClassSchedule(userId, params.sectionId), listCourseInstructors(params.id), getCoursePlan(userId, params.id)])
    : [null, [], null];
  // CENTER J — cây chương và bài của khoá để chọn bài đưa vào kế hoạch từng buổi (chỉ người quản khoá soạn kế hoạch).
  const courseTree =
    showSchedule && canManage
      ? (
          await prisma.module.findMany({
            where: { courseId: params.id },
            orderBy: { orderIndex: "asc" },
            select: { id: true, title: true, isHidden: true, lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, isHidden: true } } },
          })
        ).map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, hidden: l.isHidden || m.isHidden })) }))
      : [];
  const [attendance, sectionGoal, goalRows] =
    centerEnabled && showStudents
      ? await Promise.all([
          getSectionAttendanceSummary(userId, params.sectionId),
          getSectionGoal(userId, params.sectionId),
          loadLearnerGoalProgress(userId, params.sectionId),
        ])
      : [null, null, []];
  const teachers = instructors.map((i) => ({ id: i.userId, name: i.displayName }));
  const autoSendSummary = showSchedule
    ? ((await prisma.courseSection.findUnique({ where: { id: params.sectionId }, select: { autoSendSummary: true } }))?.autoSendSummary ?? true)
    : true;

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
      {centerEnabled && <SectionTabs courseId={params.id} sectionId={params.sectionId} active={tab} />}
      {canManage && coursePlan?.pack?.hasUpdate && (
        <PackUpdateBanner
          courseId={params.id}
          packTitle={coursePlan.pack.title}
          copiedVersion={coursePlan.pack.copiedVersion}
          currentVersion={coursePlan.pack.currentVersion}
        />
      )}
      {schedule && <SectionScheduleClient courseId={params.id} sectionId={params.sectionId} initial={schedule} teachers={teachers} canManage={canManage} viewerId={userId} autoSendSummary={autoSendSummary} courseTree={courseTree} />}
      {attendance && <SectionAttendanceSummary summary={attendance} />}
      {centerEnabled && showStudents && (
        <SectionGoalsCard
          sectionId={params.sectionId}
          courseId={params.id}
          canManage={canManage}
          sectionGoal={sectionGoal}
          rows={JSON.parse(JSON.stringify(goalRows))}
        />
      )}
      {showStudents && (
        <SectionRosterClient
          courseId={params.id}
          sectionId={params.sectionId}
          initial={roster}
        />
      )}
    </main>
  );
}
