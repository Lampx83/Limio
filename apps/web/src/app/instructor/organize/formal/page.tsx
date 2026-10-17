import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import OrganizeLayout from "../OrganizeLayout";
import CreateFormalSessionForm from "./CreateFormalSessionForm";

export const dynamic = "force-dynamic";

/**
 * Kỳ thi chính thức — tạo một ca, rồi thêm phòng, giám thị, thí sinh ở trang ca.
 *
 * Không còn bước "tạo đợt thi" trước: đợt chỉ là nhãn gom nhóm (trạng thái chỉ
 * để phân loại, giờ vào thi do từng ca quyết định), nên ca được tạo thẳng từ
 * đề. Các ca đã tổ chức xem ở Lịch sử thi, tab Kỳ thi chính thức.
 *
 * "Tự do" = ExamAccessMode.open_code (một mã chung cho cả ca).
 * "Theo phòng" = assigned_code (mã cấp riêng từng thí sinh, có xếp phòng).
 */
export default async function OrganizeFormalPage({
  searchParams,
}: {
  searchParams: { examId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/organize/formal");
  const userId = session.user.id;

  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  const papers = await prisma.exam.findMany({
    where: {
      status: { not: "archived" },
      // Vấn đáp AI mở qua Link thi nhanh — chưa có phòng/giám thị nhiều người.
      kind: "written",
      questions: { some: {} },
      OR: [
        ...(courses.length > 0 ? [{ courseId: { in: courses.map((c) => c.id) } }] : []),
        { courseId: null, createdById: userId },
      ],
    },
    select: {
      id: true,
      title: true,
      courseId: true,
      _count: { select: { questions: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  return (
    <OrganizeLayout
      title="Kỳ thi chính thức"
      blurb="Nhiều ca, nhiều phòng, có giám thị. Tạo ca từ một đề thi, rồi xếp phòng, cấp mã từng thí sinh, in phiếu."
      historyType="formal"
    >
      {courses.length === 0 && papers.length === 0 ? (
        <p className="text-sm">
          Bạn cần là giảng viên của một khoá học trước đã.{" "}
          <Link href="/instructor/courses/new" className="underline">
            Tạo khoá đầu tiên
          </Link>
          .
        </p>
      ) : (
        <CreateFormalSessionForm
          initialPaperId={searchParams.examId}
          papers={papers.map((p) => ({
            id: p.id,
            title: p.title,
            courseTitle: (p.courseId && courseTitleById.get(p.courseId)) || "",
            questionCount: p._count.questions,
          }))}
        />
      )}
    </OrganizeLayout>
  );
}
