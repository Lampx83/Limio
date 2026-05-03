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
import ViewModeToggle from "./ViewModeToggle";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "chip-accent",
  published: "chip-success",
  archived: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};

export default async function InstructorCourseEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { view?: string };
}) {
  const view: "edit" | "preview" =
    searchParams?.view === "preview" ? "preview" : "edit";
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

  const untaggedLessonIds = course.modules.flatMap((m) =>
    m.lessons
      .filter((l) => l.skillTags.length === 0)
      .map((l) => ({ id: l.id, title: l.title })),
  );

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const totalQuizzes = course.modules.reduce(
    (s, m) => s + m.lessons.reduce((ls, l) => ls + l.quizzes.length, 0),
    0,
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/instructor/courses"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Khóa của tôi
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip-brand">Editor</span>
            <span className={STATUS_TONE[course.status] ?? "chip"}>
              {STATUS_LABEL[course.status] ?? course.status}
            </span>
          </div>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
            {course.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-faint">
            <code className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 font-mono">
              /{course.slug}
            </code>
            <span>·</span>
            <span>v{course.version}</span>
            <span>·</span>
            <span>{course.modules.length} modules</span>
            <span>·</span>
            <span>{totalLessons} bài</span>
            <span>·</span>
            <span>{totalQuizzes} quizzes</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewModeToggle />
          <Link
            href={`/instructor/courses/${course.id}/struggling-students`}
            className="btn-secondary btn-sm"
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
      </header>

      <div data-view={view}>
        {/* Preview mode banner */}
        {view === "preview" && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-soft p-4">
            <p className="text-sm text-brand-700">
              👁 Bạn đang xem dưới góc nhìn học viên — controls editor đã ẩn.
              Chuyển về <span className="font-semibold">Sửa</span> để chỉnh.
            </p>
          </div>
        )}

        {/* Untagged lessons warning */}
        {untaggedLessonIds.length > 0 && view === "edit" && (
          <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-4">
            <p className="text-sm font-semibold text-accent-700">
              ⚠️ {untaggedLessonIds.length} bài chưa tag skill
            </p>
            <p className="mt-1 text-xs text-accent-700/80">
              Khóa không thể publish khi còn bài chưa được tag — personalization
              sẽ không hoạt động cho những bài này.
            </p>
          </div>
        )}

        {/* Meta form (edit only) */}
        {view === "edit" && (
          <section className="mt-8">
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
          </section>
        )}

        {/* Course description (preview only) */}
        {view === "preview" && (
          <section className="mt-6 card">
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {course.description}
            </p>
          </section>
        )}

        {/* Modules */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">
              {view === "preview" ? "Lộ trình học" : "Modules"}
            </h2>
            <span className="text-sm text-muted">
              {course.modules.length} modules ·{" "}
              {course.modules.reduce((s, m) => s + m.lessons.length, 0)} bài
            </span>
          </div>

          <div className="mt-4">
            <SortableModulesWrapper
              reorderEndpoint={`/api/courses/${course.id}/modules/reorder`}
              payloadKey="orderedModuleIds"
              items={course.modules.map((m, i) => ({
                id: m.id,
                node: <ModuleSection module={m} order={i + 1} courseSlug={course.slug} />,
              }))}
            />
          </div>

          <div className="mt-6">
            <AddModuleForm
              courseId={course.id}
              nextOrderIndex={course.modules.length}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
