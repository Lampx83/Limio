import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import TeachingToolsMenu from "../TeachingToolsMenu";

export const dynamic = "force-dynamic";

export default async function ClassroomToolsPage({
  params,
}: {
  params: { lessonId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: {
      id: true,
      title: true,
      module: {
        select: {
          title: true,
          course: { select: { id: true, title: true, slug: true } },
        },
      },
    },
  });

  if (!lesson) notFound();

  // Check if user is instructor
  const instructor = await prisma.courseInstructor.findUnique({
    where: {
      courseId_userId: {
        courseId: lesson.module.course.id,
        userId: session.user.id,
      },
    },
  });

  if (!instructor) {
    redirect(`/instructor/courses/${lesson.module.course.id}`);
  }

  return (
    <>
      <main>
        <Link
          href={`/instructor/courses/${lesson.module.course.id}`}
          className="link inline-flex items-center gap-1 text-sm"
        >
          ← {lesson.module.course.title}
        </Link>

        <header className="mt-6">
          <span className="chip">{lesson.module.title}</span>
          <h1 className="mt-3 text-2xl font-bold">{lesson.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Công cụ hỗ trợ dạy học trực tiếp tại lớp
          </p>
        </header>
      </main>

      <TeachingToolsMenu lessonId={lesson.id} />
    </>
  );
}
