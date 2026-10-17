import { notFound, redirect } from "next/navigation";
import { LessonDraftError, assertCanEditLesson, getActiveLessonDraftId } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import LessonStudio from "./LessonStudio";

export const metadata = {
  title: "Tạo bài từ tài liệu | Limio",
};

/**
 * "Văn bản — AI hỗ trợ": tài liệu → dàn ý → (chốt) → bài học. Có bản nháp đang
 * mở cho bài này thì mở thẳng màn Dàn ý để làm tiếp.
 */
export default async function FromDocumentPage({ params }: { params: { id: string; lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) redirect(`/signin?callbackUrl=/instructor/courses/${params.id}`);
  let info;
  let draftId: string | null;
  try {
    info = await assertCanEditLesson(userId, params.lessonId);
    draftId = await getActiveLessonDraftId(userId, params.lessonId);
  } catch (e) {
    if (e instanceof LessonDraftError) notFound();
    throw e;
  }
  if (info.courseId !== params.id) notFound();
  return (
    <LessonStudio
      courseId={params.id}
      lessonId={params.lessonId}
      lessonTitle={info.lessonTitle}
      initialDraftId={draftId}
    />
  );
}
