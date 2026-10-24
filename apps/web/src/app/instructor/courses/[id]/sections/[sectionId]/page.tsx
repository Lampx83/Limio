import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getSectionRoster,
  getClassSchedule,
  getCoursePlan,
  getSectionAttendanceSummary,
  listCourseInstructors,
  CourseAuthzError,
  CourseError,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SectionRosterClient from "./SectionRosterClient";
import SectionScheduleClient from "./SectionScheduleClient";
import SectionAttendanceSummary from "./SectionAttendanceSummary";
import PackUpdateBanner from "./PackUpdateBanner";

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

  const [schedule, instructors, attendance, coursePlan] = await Promise.all([
    getClassSchedule(userId, params.sectionId),
    listCourseInstructors(params.id),
    getSectionAttendanceSummary(userId, params.sectionId),
    getCoursePlan(userId, params.id),
  ]);
  const teachers = instructors.map((i) => ({ id: i.userId, name: i.displayName }));

  return (
    <main>
      <Link
        href={`/instructor/courses/${params.id}?tab=sections`}
        className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
      >
        ← {roster.section.courseTitle}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{roster.section.name}</h1>
      {roster.section.description && (
        <p className="mt-1 text-sm text-faint">{roster.section.description}</p>
      )}
      {coursePlan.pack?.hasUpdate && (
        <PackUpdateBanner
          courseId={params.id}
          packTitle={coursePlan.pack.title}
          copiedVersion={coursePlan.pack.copiedVersion}
          currentVersion={coursePlan.pack.currentVersion}
        />
      )}
      <SectionScheduleClient courseId={params.id} sectionId={params.sectionId} initial={schedule} teachers={teachers} />
      <SectionAttendanceSummary summary={attendance} />
      <SectionRosterClient
        courseId={params.id}
        sectionId={params.sectionId}
        initial={roster}
      />
    </main>
  );
}
