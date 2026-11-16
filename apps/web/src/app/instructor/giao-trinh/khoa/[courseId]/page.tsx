import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getTeachingScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getInstructorCenterAccess } from "@/lib/centerAccess";
import CourseSessionPlanEditor from "@/components/course-plan/CourseSessionPlanEditor";

export const dynamic = "force-dynamic";

/** CENTER K — Phân phối chương trình của một khoá, mở từ menu "Giáo trình". */
export default async function CourseSessionPlanPage({ params }: { params: { courseId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/instructor/giao-trinh/khoa/${params.courseId}`);
  const userId = session.user.id;

  const [scope, course] = await Promise.all([
    getTeachingScope(userId, params.courseId),
    prisma.course.findUnique({
      where: { id: params.courseId },
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            title: true,
            isHidden: true,
            lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, isHidden: true } },
          },
        },
      },
    }),
  ]);
  if (!course || scope === null) notFound();
  // Khoá đã có bảng thì người có tên trong khoá vẫn xem được dù tính năng trung tâm chưa bật cho tài khoản.
  if (!(await getInstructorCenterAccess(userId)) && (await prisma.courseSession.count({ where: { courseId: course.id } })) === 0) {
    redirect("/instructor/dashboard");
  }

  return (
    <main>
      <Link href="/instructor/giao-trinh" className="link text-sm">
        ← Giáo trình
      </Link>
      <h1 className="text-h1 mt-3">{course.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Phân phối chương trình: buổi nào học bài nào. Mọi lớp của khoá tự theo bảng này: buổi số N của lớp hiện các bài của &quot;Buổi N&quot;
        ở lịch dạy của giáo viên và lịch học của học viên, bấm vào là mở bài. Buổi nào đã chỉnh riêng bằng nút &quot;Kế hoạch&quot; ở trang lớp
        thì giữ nguyên; buổi đã kết thúc không bị đổi.
      </p>
      {scope === "manage" && (
        <p className="mt-2 text-sm">
          <Link href={`/instructor/courses/${course.id}?tab=content`} className="link">
            Mở nội dung khoá
          </Link>
        </p>
      )}
      <div className="mt-6">
        <CourseSessionPlanEditor
          courseId={course.id}
          courseTree={course.modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, hidden: l.isHidden || m.isHidden })),
          }))}
        />
      </div>
    </main>
  );
}
