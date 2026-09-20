import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { plainToRichHtml } from "@/lib/richText";
import OralExamRoom from "@/components/exam/OralExamRoom";
import OralVoiceRoom from "@/components/exam/OralVoiceRoom";

export const dynamic = "force-dynamic";

/**
 * Giáo viên thử vấn đáp trước khi mở phiên — dùng ĐÚNG phòng thi của sinh viên (OralExamRoom/OralVoiceRoom) ở chế
 * độ `preview`: cùng giao diện, cùng cấu hình đề (ngôn ngữ, chữ/giọng nói, hướng dẫn AI, mô tả), nhưng không có
 * lượt thi, không lưu hội thoại, không chấm điểm (xem runOralExamPreviewTurn). Đề không bị đổi trạng thái nên vẫn
 * sửa được tài liệu sau khi thử. Mỗi câu AI hỏi vẫn tốn token AI của giáo viên.
 */
export default async function OralExamPreviewPage({
  params,
  searchParams,
}: {
  params: { id: string; examId: string };
  searchParams?: { topic?: string };
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
      answerMode: true,
      description: true,
      durationMin: true,
      course: { select: { title: true } },
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

  // A6.7 — bản thử không có lượt thi nên không có chủ đề "được giao": GV chọn chủ đề để thử (mặc định
  // ngẫu nhiên). Chọn ở SERVER, cố định cho cả buổi thử — nếu để mỗi lượt tự chọn lại thì AI đổi chủ đề giữa chừng.
  const topics = await prisma.oralExamTopic.findMany({
    where: { examId: exam.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true },
  });
  const chosenTopic =
    topics.find((t) => t.id === searchParams?.topic) ??
    (topics.length > 0 ? topics[Math.floor(Math.random() * topics.length)]! : null);

  const back = `/instructor/courses/${params.id}/exams/${exam.id}?tab=materials`;
  const now = new Date().toISOString();
  const roomProps = {
    examId: exam.id,
    attemptId: "preview", // không có lượt thi thật — các nhánh dùng attemptId đã bị tắt ở chế độ preview
    examTitle: exam.title,
    courseTitle: exam.course?.title ?? "Đề độc lập",
    startedAt: now,
    durationSec: exam.durationMin * 60,
    serverNow: now,
    initialTurns: [],
    submittedUrl: back,
    exitUrl: back,
    instructionsHtml: exam.description ? plainToRichHtml(exam.description) : null,
    studentName: session.user.name,
    studentImageUrl: session.user.image,
    preview: true,
    previewTopicId: chosenTopic?.id ?? null,
  };

  const room = exam.answerMode === "voice" ? <OralVoiceRoom {...roomProps} /> : <OralExamRoom {...roomProps} />;
  if (topics.length === 0) return room;

  const base = `/instructor/courses/${params.id}/exams/${exam.id}/preview`;
  return (
    <>
      <div className="border-b border-default bg-slate-50 px-4 py-2 text-sm">
        <span className="font-medium">Đang thử với chủ đề: {chosenTopic!.title}</span>
        <span className="text-faint"> · sinh viên thật sẽ được giao ngẫu nhiên, chia đều. Đổi chủ đề để thử lại từ đầu:</span>
        <span className="ml-2 inline-flex flex-wrap gap-x-3 gap-y-1">
          {topics.map((t) =>
            t.id === chosenTopic!.id ? null : (
              <a key={t.id} href={`${base}?topic=${t.id}`} className="underline underline-offset-2">
                {t.title}
              </a>
            ),
          )}
        </span>
      </div>
      {room}
    </>
  );
}
