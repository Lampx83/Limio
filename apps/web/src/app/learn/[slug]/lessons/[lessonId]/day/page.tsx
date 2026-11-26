import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canGradeCourse, getPracticeBlockSummaries, getPracticeForTeaching, ExamError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { buildTeachingFrames, type TeachingPracticeInput } from "@/lib/teachingFrames";
import TeachingDeck from "@/components/lesson/TeachingDeck";

/**
 * "Chiếu lớp" của một bài học HSK (docs/tieu-chi/hsk-che-do-chieu-lop.md): các màn dựng thẳng từ nội dung bài lúc mở, không lưu bản sao.
 * Chỉ người dạy của khoá (chủ, đồng giảng viên, giảng viên không sửa, trợ giảng; D2). Ghi chú giảng viên và khối ẩn không vào màn nào.
 * Âm thanh và ảnh đi qua đúng các đường `/api/lesson-media/*` của trang bài học nên khoá có bản quyền vẫn được chặn ở đó; trang bị
 * layout của bài học chặn in. Không phát LearningEvent (E2).
 */
export const dynamic = "force-dynamic";

type Props = { params: { slug: string; lessonId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = await prisma.lesson.findUnique({ where: { id: params.lessonId }, select: { title: true, module: { select: { course: { select: { protectedMedia: true } } } } } });
  const hide = !lesson || lesson.module.course.protectedMedia;
  return { title: hide ? "Chiếu lớp" : `Chiếu lớp · ${lesson.title}`, robots: { index: false, follow: false } };
}

export default async function TeachPage({ params }: Props) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const back = `/learn/${params.slug}/lessons/${params.lessonId}`;
  if (!userId) redirect(`/signin?callbackUrl=${encodeURIComponent(`${back}/day`)}`);

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: { include: { course: { select: { id: true, slug: true, title: true } } } },
      contentItems: { where: { isHidden: false }, orderBy: { orderIndex: "asc" } },
    },
  });
  if (!lesson || lesson.isHidden || lesson.module.course.slug !== params.slug) notFound();
  if (!(await canGradeCourse(userId, lesson.module.course.id))) notFound();

  const items = lesson.contentItems.filter((c) => c.type !== "teacher_note");
  const practiceItems = items.filter((c) => c.type === "exam_practice");
  const summaries = practiceItems.length ? await getPracticeBlockSummaries(practiceItems.map((c) => c.id)) : {};
  const practices: Record<string, TeachingPracticeInput> = {};
  for (const it of practiceItems) {
    const info = summaries[it.id];
    if (!info?.examId || info.questions === 0) continue;
    try {
      const embed = await getPracticeForTeaching(userId, info.examId);
      practices[it.id] = {
        title: embed.title,
        passages: embed.passages.map((p) => ({ id: p.id, title: p.title, contentJson: p.contentJson })),
        questions: embed.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, passageId: q.passageId, config: q.config })),
      };
    } catch (e) {
      if (!(e instanceof ExamError)) throw e;
    }
  }

  const frames = buildTeachingFrames({
    lessonTitle: lesson.title,
    items: items.map((c) => ({ id: c.id, type: c.type, payload: c.payload })),
    practices,
  });

  return <TeachingDeck frames={frames} lessonTitle={lesson.title} courseTitle={lesson.module.course.title} backHref={back} />;
}
