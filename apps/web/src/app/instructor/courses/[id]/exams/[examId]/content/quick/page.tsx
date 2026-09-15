import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import QuickBankPicker from "./QuickBankPicker";

export const dynamic = "force-dynamic";

export default async function QuickBankPickerPage({
  params,
}: {
  params: { id: string; examId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/content/quick`,
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, kind: true },
  });
  if (!exam || exam.courseId !== params.id) notFound();
  if (exam.kind !== "written") notFound();
  if (!(await canEditCourse(session.user.id, exam.courseId))) {
    redirect("/instructor/courses");
  }

  const backHref = `/instructor/courses/${params.id}/exams/${params.examId}/content`;
  const doneHref = `/instructor/courses/${params.id}/exams/${params.examId}?tab=content`;

  return (
    <main>
      <Link href={backHref} className="text-sm text-faint hover:text-brand-700">
        ← Chọn phương thức khác
      </Link>

      <div className="mt-6 max-w-2xl">
        <h1 className="text-h2">Chọn nhanh theo tiêu chí</h1>
        <p className="mt-2 text-meta">
          Đặt số lượng câu và tiêu chí — hệ thống tự rút ngẫu nhiên từ ngân hàng (chỉ câu đã
          publish).
        </p>
      </div>

      <QuickBankPicker examId={exam.id} doneHref={doneHref} />
    </main>
  );
}
