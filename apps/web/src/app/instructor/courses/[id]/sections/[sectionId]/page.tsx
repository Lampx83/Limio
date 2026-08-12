import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSectionRoster, CourseAuthzError, CourseError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SectionRosterClient from "./SectionRosterClient";

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

  return (
    <main>
      <Link
        href={`/instructor/courses/${params.id}?tab=sections`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {roster.section.courseTitle}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">👥 {roster.section.name}</h1>
      {roster.section.description && (
        <p className="mt-1 text-sm text-faint">{roster.section.description}</p>
      )}
      <SectionRosterClient
        courseId={params.id}
        sectionId={params.sectionId}
        initial={roster}
      />
    </main>
  );
}
