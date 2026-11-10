import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { CourseAuthzError, getPracticeEditorData } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import PracticeEditor from "./PracticeEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Soạn bài luyện", ...NOINDEX };

/**
 * Editor riêng của khối "Bài luyện" (docs/tieu-chi/limio-language-bai-luyen-editor.md): giảng viên đưa đoạn văn, âm thanh, ảnh
 * và câu hỏi lên đây, KHÔNG qua mục Đề thi. Quyền: ai sửa được khoá chứa bài.
 */
export default async function PracticeEditorPage({ params }: { params: { id: string; contentId: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/bai-luyen/${params.contentId}`);
  let data;
  try {
    data = await getPracticeEditorData(userId, params.contentId);
  } catch (e) {
    if (e instanceof CourseAuthzError) notFound();
    throw e;
  }
  // Khối phải thuộc đúng khoá trong đường dẫn (không lộ khối của khoá khác qua id khoá khác).
  if (data.courseId !== params.id) notFound();

  const base = `/instructor/courses/${data.courseId}`;
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href={base} className="link inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} aria-hidden /> Về trang soạn khoá
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1">Soạn bài luyện</h1>
          <p className="text-meta mt-1">
            {data.blockTitle ? <strong>{data.blockTitle}</strong> : "Bài luyện"} · Bài “{data.lessonTitle}” · Khoá {data.courseTitle}
          </p>
        </div>
        <Link href={`${base}/bai-luyen/${data.contentItemId}/xem-truoc`} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
          <Eye size={14} aria-hidden /> Xem trước
        </Link>
      </header>
      <p className="text-meta mt-3 max-w-2xl text-muted">
        Đưa đoạn văn hoặc bài nghe lên, rồi thêm câu hỏi cho từng đoạn. Học viên đọc hoặc nghe, trả lời và bấm “Kiểm tra câu n” để biết
        đúng sai ngay trong bài; phần “Giải thích đáp án” của mỗi câu hiện ra sau khi kiểm tra. Mọi thay đổi được lưu ngay khi bấm Lưu.
      </p>
      <PracticeEditor
        examId={data.examId}
        sectionId={data.sectionId}
        passages={JSON.parse(JSON.stringify(data.passages))}
        questions={JSON.parse(JSON.stringify(data.questions))}
      />
    </main>
  );
}
