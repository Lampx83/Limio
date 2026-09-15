import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { listExamRuns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrganizeLayout from "../OrganizeLayout";
import QuickExamForm from "../../exams/quick/QuickExamForm";

export const dynamic = "force-dynamic";

/** Link thi nhanh — tạo mới + lịch sử các lần cùng dạng. */
export default async function OrganizeQuickPage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/signin?callbackUrl=/instructor/organize/quick");
  const userId = session.user.id;

  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  const [papers, runs] = await Promise.all([
    prisma.exam.findMany({
      where: {
        courseId: { in: courses.map((c) => c.id) },
        status: { not: "archived" },
        purpose: "assessment",
        // Vấn đáp AI không phát mã/QR — luồng "mở buổi" riêng nằm ngay trên
        // trang quản lý đề (xem OralSessionControl), không qua đây nữa.
        kind: "written",
        questions: { some: {} },
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        _count: { select: { questions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    listExamRuns(userId, { purpose: "assessment", scale: "simple" }),
  ]);

  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  return (
    <OrganizeLayout
      title="Link thi nhanh"
      blurb="Khảo sát, điểm danh, kiểm tra nhanh trên lớp. Chọn gói đề, đặt thời lượng, bấm Mở."
      runs={runs}
      historyTitle="Các buổi đã mở"
      emptyHint="Chưa mở buổi thi nào. Tạo ở phần trên."
    >
      {courses.length === 0 ? (
        <p className="text-sm">
          Bạn cần là giảng viên của một khoá học trước đã.{" "}
          <Link href="/instructor/courses/new" className="underline">
            Tạo khoá đầu tiên
          </Link>
          .
        </p>
      ) : (
        <QuickExamForm
          purpose="assessment"
          courses={courses}
          papers={papers.map((p) => ({
            id: p.id,
            title: p.title,
            // Query đã lọc courseId trong danh sách khoá sở hữu — luôn có giá trị.
            courseId: p.courseId!,
            courseTitle: courseTitleById.get(p.courseId!) ?? "",
            questionCount: p._count.questions,
          }))}
        />
      )}
    </OrganizeLayout>
  );
}
