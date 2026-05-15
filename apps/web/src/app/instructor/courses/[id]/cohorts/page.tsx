import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditCourse, listCohorts } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import CohortsClient from "./CohortsClient";

export const dynamic = "force-dynamic";

export default async function CohortsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/cohorts`);
  const userId = session.user.id;
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await canEditCourse(userId, course.id))) redirect("/instructor/courses");

  const cohorts = await listCohorts(userId, course.id);

  // PR2.12 — Danh sách GV có thể được assign làm chủ nhiệm cohort. Lấy
  // instructors của course để giới hạn (1 GV : N cohort).
  const courseInstructors = await prisma.courseInstructor.findMany({
    where: { courseId: course.id },
    select: { user: { select: { id: true, displayName: true, email: true } } },
    orderBy: { user: { displayName: "asc" } },
  });
  const instructorOptions = courseInstructors.map((ci) => ({
    id: ci.user.id,
    displayName: ci.user.displayName,
    email: ci.user.email,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/instructor/courses/${course.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {course.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">👥 Lớp / Cohort</h1>
      <p className="mt-1 text-sm text-faint">
        Tạo lớp + gán sinh viên để gating ca thi theo lớp (decision #2).
      </p>
      <CohortsClient
        courseId={course.id}
        initial={cohorts}
        instructorOptions={instructorOptions}
      />
    </main>
  );
}
