import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import CourseMetaForm from "./CourseMetaForm";
import ModuleSection from "./ModuleSection";
import AddModuleForm from "./AddModuleForm";
import PublishControls from "./PublishControls";
import DuplicateCourseButton from "./DuplicateCourseButton";
import SortableModulesWrapper from "./SortableModulesWrapper";

export const dynamic = "force-dynamic";

export default async function InstructorCourseEditPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}`);
  }
  const userId = session.user.id;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              contentItems: { orderBy: { orderIndex: "asc" } },
              skillTags: { include: { skill: true } },
              assignments: { orderBy: { createdAt: "asc" } },
              quizzes: {
                orderBy: { createdAt: "asc" },
                include: {
                  questions: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                      options: {
                        orderBy: { orderIndex: "asc" },
                        include: { misconception: true },
                      },
                      skillTags: { include: { skill: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const canEdit = await canEditCourse(userId, course.id);
  if (!canEdit) redirect("/instructor/courses");

  // Untagged lessons block publish (per AC-A2.6).
  const untaggedLessonIds = course.modules.flatMap((m) =>
    m.lessons
      .filter((l) => l.skillTags.length === 0)
      .map((l) => ({ id: l.id, title: l.title })),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/instructor/courses" className="text-sm underline">
            ← Khóa của tôi
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{course.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <code className="font-mono">/{course.slug}</code> · v{course.version} ·{" "}
            <span
              className={
                course.status === "published"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300"
              }
            >
              {course.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/instructor/courses/${course.id}/struggling-students`}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            👥 Học viên cần hỗ trợ
          </Link>
          <DuplicateCourseButton courseId={course.id} />
          <PublishControls
            courseId={course.id}
            status={course.status}
            untaggedLessons={untaggedLessonIds}
          />
        </div>
      </div>

      <CourseMetaForm
        courseId={course.id}
        initial={{
          title: course.title,
          description: course.description,
          level: course.level,
          language: course.language,
          category: course.category ?? "",
        }}
      />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Modules</h2>
          <span className="text-xs text-slate-500">
            {course.modules.length} modules
          </span>
        </div>

        <div className="mt-4">
          <SortableModulesWrapper
            reorderEndpoint={`/api/courses/${course.id}/modules/reorder`}
            payloadKey="orderedModuleIds"
            items={course.modules.map((m, i) => ({
              id: m.id,
              node: <ModuleSection module={m} order={i + 1} />,
            }))}
          />
        </div>

        <div className="mt-4">
          <AddModuleForm
            courseId={course.id}
            nextOrderIndex={course.modules.length}
          />
        </div>
      </section>
    </main>
  );
}
