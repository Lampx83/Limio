import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  assertCanEditExam,
  buildShuffleSnapshot,
  CourseAuthzError,
  toPublicQuestionConfig,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamPlayer from "@/components/ExamPlayer";
import type { TiptapDoc } from "@/components/exam/PassageView";

export const dynamic = "force-dynamic";

/**
 * Giáo viên thi thử đề trắc nghiệm/tự luận trước khi mở cho học viên — dùng
 * ĐÚNG giao diện làm bài (ExamPlayer) ở chế độ `preview`.
 *
 * Bản thử KHÔNG tạo lượt thi: không có ExamAttempt, không chấm, không tính
 * điểm/XP, không xuất hiện trong bảng kết quả. Vì vậy trang này không gọi API
 * làm bài; đáp án chỉ nằm trong localStorage của giáo viên và bị xoá khi nộp.
 * Trang vấn đáp có bản thử riêng ở `../preview`.
 */
export default async function WrittenExamPreviewPage({
  params,
  searchParams,
}: {
  params: { id: string; examId: string };
  searchParams?: { done?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/thi-thu`);
  }
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: {
      id: true,
      title: true,
      kind: true,
      courseId: true,
      createdById: true,
      durationMin: true,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
  });
  if (!exam) notFound();
  if (exam.kind === "oral") redirect(`/instructor/courses/${params.id}/exams/${params.examId}/preview`);
  if ((exam.courseId ?? "none") !== params.id) notFound();
  try {
    await assertCanEditExam(session.user.id, exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) redirect("/instructor/courses");
    throw e;
  }

  const examHref = `/instructor/courses/${params.id}/exams/${params.examId}`;
  const thiThuHref = `${examHref}/thi-thu`;

  // Bản thử đã nộp: báo rõ là không có gì được lưu, và cho làm lại.
  if (searchParams?.done === "1") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="mb-3 text-xl font-semibold">Đã nộp bản thử</h1>
        <p className="mb-6 text-sm text-faint">
          Bài thử không được lưu và không tính điểm. Học viên không thấy gì ở đây.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={thiThuHref} className="btn btn-primary btn-sm">Thi thử lại</Link>
          <Link href={examHref} className="btn btn-secondary btn-sm">Quay lại đề thi</Link>
        </div>
      </main>
    );
  }

  const [questions, passages] = await Promise.all([
    prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { orderInExam: "asc" },
      select: {
        id: true,
        type: true,
        prompt: true,
        points: true,
        passageId: true,
        config: true,
        orderInPassage: true,
        orderInExam: true,
      },
    }),
    prisma.examPassage.findMany({
      where: { examId: exam.id },
      orderBy: { orderIndex: "asc" },
      select: { id: true, title: true, contentJson: true },
    }),
  ]);

  // Mã nháp cố định theo đề: tải lại trang giữ được đáp án đang làm dở, còn
  // không ghi gì lên máy chủ. Không khớp mã lượt thi thật nên không đụng tới dữ liệu nào.
  const previewId = `preview-${exam.id}`;
  const shuffleSnapshot = await buildShuffleSnapshot(
    exam.id,
    previewId,
    exam.shuffleQuestions,
    exam.shuffleOptions,
    prisma,
  );

  const startedAt = new Date().toISOString();

  return (
    <ExamPlayer
      preview
      exitHref={examHref}
      attemptId={previewId}
      sessionToken="preview"
      startedAt={startedAt}
      durationSec={exam.durationMin * 60}
      serverNow={startedAt}
      exam={{
        id: exam.id,
        title: `Bản thử · ${exam.title}`,
        showResultsAfterSubmit: false,
        proctoringLevel: "none",
      }}
      passages={passages.map((p) => ({
        id: p.id,
        title: p.title,
        contentJson: p.contentJson as unknown as TiptapDoc,
      }))}
      questions={questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        passageId: q.passageId,
        orderInPassage: q.orderInPassage,
        orderInExam: q.orderInExam,
        config: toPublicQuestionConfig(q.type, q.config),
      }))}
      shuffleSnapshot={shuffleSnapshot}
      initialAnswers={[]}
      resultUrl={`${thiThuHref}?done=1`}
    />
  );
}
