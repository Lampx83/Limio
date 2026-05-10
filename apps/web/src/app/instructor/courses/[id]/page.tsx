import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import CourseMetaForm from "./CourseMetaForm";
import LessonSection from "./LessonSection";
import ModuleSection from "./ModuleSection";
import ModuleOverviewCard from "./ModuleOverviewCard";
import AddModuleForm from "./AddModuleForm";
import PublishControls from "./PublishControls";
import DuplicateCourseButton from "./DuplicateCourseButton";
import SortableModulesWrapper from "./SortableModulesWrapper";
import LessonViewToggle from "./LessonViewToggle";
import ImportStudentsButton from "./ImportStudentsButton";
import EditorSidebar from "./EditorSidebar";
import EditorTabs, { type EditorTab } from "./EditorTabs";
import EnrollmentList from "./EnrollmentList";
import AnalyticsDashboard from "./AnalyticsDashboard";

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
  searchParams?: { lesson?: string; tab?: string; lessonView?: string };
}) {
  const TAB_VALUES: EditorTab[] = ["overview", "content", "students", "analytics"];
  const tab: EditorTab = TAB_VALUES.includes(searchParams?.tab as EditorTab)
    ? (searchParams!.tab as EditorTab)
    : "overview";
  const lessonView: "edit" | "preview" =
    searchParams?.lessonView === "preview" ? "preview" : "edit";
  const selectedLessonId = searchParams?.lesson;
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

  // Find selected lesson + parent module for split-pane editing
  let selectedLesson = null as any;
  let selectedModule = null as any;
  let selectedLessonOrder = 0;
  if (selectedLessonId) {
    for (const m of course.modules) {
      const idx = m.lessons.findIndex((l) => l.id === selectedLessonId);
      if (idx !== -1) {
        selectedModule = m;
        selectedLesson = m.lessons[idx];
        selectedLessonOrder = idx + 1;
        break;
      }
    }
  }

  // Sidebar tree shape — only the data we need
  const sidebarModules = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    isHidden: m.isHidden,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      isHidden: l.isHidden,
      noSkill: l.skillTags.length === 0,
      contentCount: l.contentItems.length,
      quizCount: l.quizzes.length,
      assignmentCount: l.assignments.length,
    })),
  }));

  const useWideLayout = tab === "content";
  const useSidebarLayout = tab === "content";

  return (
    <main
      className={
        useWideLayout
          ? "mx-auto max-w-7xl px-6 py-10"
          : "mx-auto max-w-5xl px-6 py-10"
      }
    >
      <Link
        href="/instructor/courses"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Khóa của tôi
      </Link>

      {/* Header — always visible across tabs */}
      <header className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="chip-brand">Editor</span>
            <span className={STATUS_TONE[course.status] ?? "chip"}>
              {STATUS_LABEL[course.status] ?? course.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PublishControls
              courseId={course.id}
              status={course.status}
              untaggedLessons={untaggedLessonIds}
            />
          </div>
        </div>

        <div>
          <h1 className="h-display text-3xl font-bold leading-tight sm:text-4xl">
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
      </header>

      <div className="mt-6">
        <EditorTabs courseId={course.id} active={tab} />
      </div>

      {/* TAB: Tổng quan */}
      {tab === "overview" && (
        <div className="mt-8 space-y-8">
          {untaggedLessonIds.length > 0 && (
            <div className="rounded-2xl border border-accent-200 bg-accent-50 p-4">
              <p className="text-sm font-semibold text-accent-700">
                {untaggedLessonIds.length} bài chưa tag skill
              </p>
              <p className="mt-1 text-xs text-accent-700/80">
                Khóa không thể publish khi còn bài chưa được tag —
                personalization sẽ không hoạt động cho những bài này.
                Sang tab <span className="font-semibold">Nội dung</span> để
                tag.
              </p>
            </div>
          )}

          <section>
            <CourseMetaForm
              courseId={course.id}
              initial={{
                title: course.title,
                description: course.description,
                level: course.level,
                language: course.language,
                category: course.category ?? "",
                priceCents: course.priceCents,
                currency: course.currency ?? "VND",
              }}
            />
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">Hành động khóa</h2>
            <div className="flex flex-wrap items-center gap-2">
              <DuplicateCourseButton courseId={course.id} />
            </div>
          </section>
        </div>
      )}

      {/* TAB: Nội dung */}
      {tab === "content" && (
        <div className={useSidebarLayout ? "mt-6 flex gap-6" : "mt-6"}>
          {useSidebarLayout && (
            <EditorSidebar
              courseId={course.id}
              modules={sidebarModules}
              activeLessonId={selectedLessonId}
              view="edit"
            />
          )}

          <div className="min-w-0 flex-1">
            {selectedLesson && selectedModule && (
              <article className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <nav className="flex min-w-0 items-center gap-2 text-sm text-muted">
                    <Link
                      href={`/instructor/courses/${course.id}?tab=content`}
                      className="link shrink-0"
                    >
                      Tổng quan nội dung
                    </Link>
                    <span className="text-faint">›</span>
                    <span className="truncate">{selectedModule.title}</span>
                    <span className="text-faint">›</span>
                    <span className="font-medium text-default truncate">
                      {selectedLesson.title}
                    </span>
                  </nav>
                  <LessonViewToggle />
                </div>
                <div
                  data-view={lessonView}
                  className={`rounded-2xl border-2 p-6 ${
                    selectedLesson.isHidden
                      ? "border-danger-200 bg-danger-50/30"
                      : "border-token bg-[rgb(var(--surface))]"
                  }`}
                >
                  <LessonSection
                    lesson={selectedLesson}
                    order={selectedLessonOrder}
                    courseSlug={course.slug}
                    flat
                    moduleId={selectedModule.id}
                    siblingLessonIds={selectedModule.lessons.map((l: { id: string }) => l.id)}
                    modules={course.modules.map((m) => ({
                      id: m.id,
                      title: m.title,
                    }))}
                  />
                </div>
              </article>
            )}

            {!selectedLesson && (
              <section>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold">Modules</h2>
                  <span className="text-sm text-muted">
                    {course.modules.length} modules · {totalLessons} bài
                  </span>
                </div>

                {course.modules.length === 0 ? (
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-token bg-[rgb(var(--surface-muted))/0.4] px-6 py-12 text-center">
                    <span className="text-5xl" aria-hidden>
                      📚
                    </span>
                    <h3 className="text-lg font-semibold">
                      Khóa chưa có module nào
                    </h3>
                    <p className="max-w-md text-sm text-muted">
                      Module gom các bài học cùng chủ đề lại với nhau. Tạo
                      module đầu tiên để bắt đầu thêm bài học.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {course.modules.map((m, i) => {
                      const sidebarModule = sidebarModules[i];
                      if (!sidebarModule) return null;
                      return (
                        <ModuleOverviewCard
                          key={m.id}
                          courseId={course.id}
                          module={{
                            id: m.id,
                            title: m.title,
                            orderIndex: m.orderIndex,
                            isHidden: m.isHidden,
                            lessons: sidebarModule.lessons,
                          }}
                          order={i + 1}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="mt-6">
                  <AddModuleForm
                    courseId={course.id}
                    nextOrderIndex={course.modules.length}
                  />
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* TAB: Học viên */}
      {tab === "students" && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Học viên</h2>
              <p className="mt-1 text-sm text-muted">
                Quản lý danh sách enrollment, role và trạng thái.
              </p>
            </div>
            <ImportStudentsButton courseId={course.id} />
          </div>

          <EnrollmentList courseId={course.id} />
        </div>
      )}

      {/* TAB: Phân tích học tập */}
      {tab === "analytics" && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Phân tích học tập</h2>
            <p className="mt-1 text-sm text-muted">
              Báo cáo và insight về hành vi học, hiệu quả khóa học, mastery
              skill. Đợt 1: 4 báo cáo CSV; đợt 2/3 sẽ thêm chart và XLSX/PDF.
            </p>
          </div>
          <AnalyticsDashboard courseId={course.id} />
        </div>
      )}
    </main>
  );
}
