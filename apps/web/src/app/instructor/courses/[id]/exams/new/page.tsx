import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamMetaForm from "../ExamMetaForm";

export const dynamic = "force-dynamic";

/** Local datetime string suitable for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default async function NewExamPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/exams/new`);
  }
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await canEditCourse(session.user.id, course.id))) {
    redirect("/instructor/courses");
  }
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/instructor/courses/${course.id}/exams`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Bài thi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Tạo bài thi mới</h1>
      <p className="mt-1 text-sm text-faint">
        Bước 1 trong 3 — đặt thông số bài thi. Sau khi tạo, bạn sẽ thêm đoạn bài
        đọc và câu hỏi.
      </p>

      <div className="mt-6">
        <ExamMetaForm
          mode="create"
          courseId={course.id}
          initial={{
            title: "",
            description: "",
            durationMin: 60,
            openAt: toLocalInput(now),
            closeAt: toLocalInput(inWeek),
            passScore: 50,
            attemptPolicy: "single",
            gradingMode: "hybrid",
            proctoringLevel: "basic",
            shuffleQuestions: true,
            shuffleOptions: true,
            showResultsAfterSubmit: true,
          }}
        />
      </div>
    </main>
  );
}
