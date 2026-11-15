import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CourseAuthzError, ExamError, getPracticeEditorData, getPracticePreview } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import { prisma } from "@feedbackme/db";
import LessonPractice from "@/components/language/LessonPractice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Xem trước bài luyện", ...NOINDEX };

/**
 * Xem trước Bài luyện đúng như học viên thấy (đoạn văn cạnh câu hỏi, kiểm tra từng câu) trên dữ liệu thật của khối. Không tạo buổi
 * luyện, không lưu đáp án, không ghi sự kiện (chấm qua `/api/practice-preview`).
 */
export default async function PracticePreviewPage({ params }: { params: { id: string; contentId: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/bai-luyen/${params.contentId}/xem-truoc`);
  let data;
  let embed;
  try {
    data = await getPracticeEditorData(userId, params.contentId);
    embed = await getPracticePreview(userId, data.examId);
  } catch (e) {
    if (e instanceof CourseAuthzError || e instanceof ExamError) notFound();
    throw e;
  }
  if (data.courseId !== params.id) notFound();
  const course = await prisma.course.findUnique({ where: { id: data.courseId }, select: { languageMode: true } });
  const back = `/instructor/courses/${data.courseId}/bai-luyen/${data.contentItemId}`;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Link href={back} className="link inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} aria-hidden /> Về trình soạn bài luyện
      </Link>
      <p className="banner-info mt-3">Đây là bản xem trước: đáp án thầy/cô chọn không được lưu và không tính vào kết quả của ai.</p>
      <div className="mt-4">
        {embed.questions.length === 0 ? (
          <p className="text-meta">Bài luyện chưa có câu hỏi, học viên sẽ không thấy khối này.</p>
        ) : (
          <LessonPractice slug="" embed={embed} blockTitle={data.blockTitle || undefined} preview sheet={!!course?.languageMode} />
        )}
      </div>
    </main>
  );
}
