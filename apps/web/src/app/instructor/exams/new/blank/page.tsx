import Link from "next/link";
import { redirect } from "next/navigation";
import { isInstructor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamMetaForm from "../../../courses/[id]/exams/ExamMetaForm";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * A7.x — Tạo đề thi viết ĐỘC LẬP, không gắn khoá học nào (courseId=null).
 * Tách khỏi wizard lấy mẫu (/instructor/exams/new) vì wizard cần course thật
 * để lấy lesson tree/ngân hàng câu hỏi — đề độc lập chỉ soạn tay được.
 */
export default async function NewBlankExamPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/exams/new/blank");
  }
  if (!(await isInstructor(session.user.id))) {
    redirect("/instructor/exams");
  }
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  return (
    <main>
      <Link href="/instructor/exams" className="text-sm text-blue-600 hover:underline">
        ← Bài thi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Tạo đề không gắn khoá học</h1>
      <p className="mt-1 text-sm text-faint">
        Đề độc lập — không thuộc khoá học nào. Chỉ soạn tay được (không lấy
        mẫu từ ngân hàng câu hỏi). Sinh viên vào thi qua mã/link mời.
      </p>
      <div className="mt-6">
        <ExamMetaForm
          mode="create"
          courseId={null}
          fixedKind="written"
          initial={{
            title: "",
            description: "",
            durationMin: 60,
            openAt: toLocalInput(now),
            closeAt: toLocalInput(inWeek),
            attemptPolicy: "single",
            gradingMode: "hybrid",
            proctoringLevel: "basic",
            shuffleQuestions: true,
            shuffleOptions: true,
            showResultsAfterSubmit: true,
            purpose: "assessment",
          }}
        />
      </div>
    </main>
  );
}
