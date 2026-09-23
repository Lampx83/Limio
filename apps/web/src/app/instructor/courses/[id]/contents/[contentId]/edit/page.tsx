import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import ContentEditorClient from "./ContentEditorClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trang soạn content toàn màn hình — cho loại cần chỗ rộng hơn khối sửa
 * nội-tuyến chật hẹp trong ContentItemRow (bắt đầu với richtext, xem
 * POPOUT_EDITOR_TYPES ở ContentItemRow.tsx). Cùng khuôn với trang soạn quiz
 * (quizzes/[quizId]/edit) — chỉ đổi form bên trong.
 */
export default async function ContentEditorPage({
  params,
}: {
  params: { id: string; contentId: string };
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/login");

  try {
    await assertCanEditCourse(userId, params.id);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      if (err.code === "not_found") notFound();
      redirect("/403");
    }
    throw err;
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: params.contentId },
    include: {
      lesson: { select: { id: true, title: true, module: { select: { courseId: true } } } },
    },
  });
  if (!item || item.lesson.module.courseId !== params.id) notFound();

  return (
    <ContentEditorClient
      courseId={params.id}
      lessonId={item.lesson.id}
      lessonTitle={item.lesson.title}
      item={{ id: item.id, type: item.type, payload: item.payload }}
    />
  );
}
