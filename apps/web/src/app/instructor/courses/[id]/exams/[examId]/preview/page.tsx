import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OralPreviewRoom from "@/components/exam/OralPreviewRoom";

export const dynamic = "force-dynamic";

/**
 * Giáo viên thử vấn đáp trước khi mở phiên. Không tạo lượt thi, không lưu hội thoại, không chấm điểm — xem
 * runOralExamPreviewTurn. Đề không bị đổi trạng thái nên vẫn sửa được tài liệu sau khi thử.
 */
export default async function OralExamPreviewPage({
  params,
}: {
  params: { id: string; examId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/preview`);
  }
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: {
      id: true,
      title: true,
      kind: true,
      courseId: true,
      createdById: true,
      _count: { select: { oralMaterials: true } },
    },
  });
  if (!exam || exam.kind !== "oral") notFound();
  if ((exam.courseId ?? "none") !== params.id) notFound();
  try {
    await assertCanEditExam(session.user.id, exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) redirect("/instructor/oral-exams");
    throw e;
  }
  const back = `/instructor/courses/${params.id}/exams/${exam.id}?tab=materials`;

  return (
    <main>
      <Link
        href={back}
        className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
      >
        ← Quay lại đề
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Thử vấn đáp</h1>
      <p className="mt-1 text-sm text-faint">{exam.title}</p>

      <p className="banner-info mt-4 px-4 py-3 text-sm">
        Đây là bản thử: không tạo lượt thi, không lưu hội thoại và không chấm điểm. Mỗi câu AI hỏi vẫn tốn token AI của bạn.
        Thử xong bạn vẫn sửa được tài liệu và cấu hình đề như bình thường.
      </p>
      {exam._count.oralMaterials === 0 && (
        <p className="banner-warning mt-3 px-4 py-3 text-sm">
          Đề chưa có tài liệu — AI sẽ hỏi chung chung. Thêm tài liệu ở tab "Tài liệu" để thử sát thực tế hơn.
        </p>
      )}

      <div className="mt-6">
        <OralPreviewRoom examId={exam.id} />
      </div>
    </main>
  );
}
