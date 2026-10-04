import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditCourse, getCourseTeamsOverview } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import TeamsClient from "./TeamsClient";

export const dynamic = "force-dynamic";

/** Nhóm làm bài tập của khoá — docs/group-submission-AC.md mục B. */
export default async function CourseTeamsPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/teams`);
  const userId = session.user.id;
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await canEditCourse(userId, course.id))) redirect("/instructor/courses");

  const overview = await getCourseTeamsOverview(userId, course.id);

  return (
    <main>
      <Link href={`/instructor/courses/${course.id}?tab=sections`} className="link text-sm">
        ← {course.title}
      </Link>
      <h1 className="text-h1 mt-3">Nhóm làm bài tập</h1>
      <p className="text-meta mt-1">
        Sinh viên tự lập nhóm ở trang khoá học: trưởng nhóm tạo nhóm rồi gửi mã cho các bạn. Nhóm dùng cho mọi
        bài tập nộp theo nhóm của khoá.
      </p>
      <TeamsClient courseId={course.id} initial={JSON.parse(JSON.stringify(overview))} />
    </main>
  );
}
