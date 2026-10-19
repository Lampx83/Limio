import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { ExamError, getPracticeOverview } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PracticeSetup from "@/components/exam/PracticeSetup";

export const dynamic = "force-dynamic";

/** LANG G5e — chọn phạm vi luyện đề (kỹ năng / phần / cả đề). */
export default async function PracticeSetupPage({ params }: { params: { slug: string; examId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}/practice`);
  const course = await prisma.course.findUnique({ where: { slug: params.slug }, select: { id: true, kind: true } });
  if (!course) notFound();

  try {
    const o = await getPracticeOverview(session.user.id, params.examId);
    const exam = await prisma.exam.findUnique({ where: { id: params.examId }, select: { courseId: true } });
    if (exam?.courseId !== course.id) notFound();
    return <PracticeSetup slug={params.slug} examId={params.examId} title={o.title} sections={o.sections} inProgress={o.inProgress} />;
  } catch (e) {
    if (e instanceof ExamError) {
      // Chưa ghi danh (và đề không phải học thử miễn phí): khoá luyện đề → về thư viện để mua; khoá thường → catalog.
      if (e.code === "not_enrolled") redirect(course.kind === "practice_bank" ? `/learn/${params.slug}/practice` : `/catalog/${params.slug}`);
      return (
        <main className="mx-auto max-w-3xl px-4 py-8 text-center">
          <h1 className="mb-3 text-2xl font-semibold">Chưa luyện đề được</h1>
          <p className="text-faint">
            {e.code === "practice_disabled" ? "Đề này hiện không mở luyện đề." : `Lỗi: ${e.code}`}
          </p>
        </main>
      );
    }
    throw e;
  }
}
