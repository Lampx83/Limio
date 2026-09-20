import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditExam } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ManualBankPicker from "./ManualBankPicker";

export const dynamic = "force-dynamic";

export default async function ManualBankPickerPage({
  params,
  searchParams,
}: {
  params: { id: string; examId: string };
  searchParams?: { sectionId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/content/manual`,
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, createdById: true, kind: true },
  });
  if (!exam || (exam.courseId ?? "none") !== params.id) notFound();
  if (exam.kind !== "written") notFound();
  if (!(await canEditExam(session.user.id, exam))) {
    redirect("/instructor/courses");
  }

  const sectionId = searchParams?.sectionId ?? null;
  // Chỉ khi thêm vào 1 "Phần" có sẵn thì mới bỏ qua bước chọn phương thức —
  // lúc đó nút "Quay lại" phải về thẳng tab Nội dung (không còn bước chọn
  // phương thức để quay lại).
  const backHref = sectionId
    ? `/instructor/courses/${params.id}/exams/${params.examId}?tab=content`
    : `/instructor/courses/${params.id}/exams/${params.examId}/content`;
  const backLabel = sectionId ? "Quay lại tab Nội dung" : "Chọn phương thức khác";
  // Sau khi thêm xong thì LUÔN về tab Nội dung để thấy câu vừa thêm — khác
  // với backHref (nút "← ..." phía trên), vốn có thể trỏ về bước chọn
  // phương thức khi chưa gán sectionId.
  const doneHref = `/instructor/courses/${params.id}/exams/${params.examId}?tab=content`;

  return (
    <main>
      <Link href={backHref} className="text-sm text-faint hover:text-brand-700">
        ← {backLabel}
      </Link>

      <div className="mt-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Chọn thủ công</h1>
        <p className="mt-2 text-meta">
          Duyệt danh sách câu hỏi đã publish trong ngân hàng và tự tay tick chọn từng câu.
        </p>
      </div>

      <ManualBankPicker
        examId={exam.id}
        courseId={params.id}
        sectionId={sectionId}
        doneHref={doneHref}
      />
    </main>
  );
}
