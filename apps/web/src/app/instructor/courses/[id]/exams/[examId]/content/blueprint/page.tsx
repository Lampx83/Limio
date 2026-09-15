import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, getBlueprint, getBlueprintLessonTree } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import BlueprintEditorClient from "./BlueprintEditorClient";

export const dynamic = "force-dynamic";

export default async function BlueprintPage({
  params,
}: {
  params: { id: string; examId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/content/blueprint`,
    );
  }
  const userId = session.user.id;

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, kind: true },
  });
  if (!exam || exam.courseId !== params.id) notFound();
  if (exam.kind !== "written") notFound();
  if (!(await canEditCourse(userId, exam.courseId))) {
    redirect("/instructor/courses");
  }

  const [lessonTree, blueprint] = await Promise.all([
    getBlueprintLessonTree(userId, exam.id),
    getBlueprint(userId, exam.id),
  ]);

  const backHref = `/instructor/courses/${params.id}/exams/${params.examId}/content`;
  const doneHref = `/instructor/courses/${params.id}/exams/${params.examId}?tab=content`;

  return (
    <main>
      <Link href={backHref} className="text-sm text-faint hover:text-brand-700">
        ← Chọn phương thức khác
      </Link>

      <div className="mt-6 max-w-2xl">
        <h1 className="text-h2">Theo ma trận đề thi</h1>
        <p className="mt-2 text-meta">
          Thiết lập số câu theo từng chủ đề × mức độ nhận thức. Hệ thống sẽ tự rút câu (đã publish)
          từ ngân hàng theo đúng tỉ lệ này.
        </p>
      </div>

      <div className="mt-6 max-w-4xl">
        <BlueprintEditorClient
          examId={exam.id}
          lessonTree={lessonTree}
          initialBlueprint={blueprint}
          doneHref={doneHref}
        />
      </div>
    </main>
  );
}
