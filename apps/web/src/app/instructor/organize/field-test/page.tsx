import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { listExamRuns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrganizeLayout from "../OrganizeLayout";
import QuickExamForm from "../../exams/quick/QuickExamForm";

export const dynamic = "force-dynamic";

/** Thử nghiệm câu hỏi — tạo mới + lịch sử các đợt thử. */
export default async function OrganizeFieldTestPage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/signin?callbackUrl=/instructor/organize/field-test");
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
        purpose: "field_test",
        questions: { some: {} },
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        durationMin: true,
        _count: { select: { questions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    listExamRuns(userId, { purpose: "field_test", scale: "simple" }),
  ]);

  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  return (
    <OrganizeLayout
      title="Thử nghiệm câu hỏi"
      blurb="Đo chất lượng câu hỏi trước khi kết nạp vào ngân hàng. Đề loại này không hiện đáp án sau khi nộp."
      runs={runs}
      historyTitle="Các đợt đã thử"
      emptyHint="Chưa có đợt thử nghiệm nào."
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
          purpose="field_test"
          courses={courses}
          papers={papers.map((p) => ({
            id: p.id,
            title: p.title,
            courseId: p.courseId,
            courseTitle: courseTitleById.get(p.courseId) ?? "",
            questionCount: p._count.questions,
            defaultDurationMin: p.durationMin,
          }))}
        />
      )}
    </OrganizeLayout>
  );
}
