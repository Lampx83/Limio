import Link from "next/link";
import { Suspense } from "react";
import ScrollEnds from "@/components/ScrollEnds";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  canEditCourse,
  canGradeCourse,
  canModerateLiveExam,
  isCourseOwner,
} from "@feedbackme/core-lms";
import { ArrowLeft, Presentation } from "lucide-react";
import { auth } from "@/lib/auth";
import CourseMetaForm from "./CourseMetaForm";
import AccessCodesPanel from "./AccessCodesPanel";
import LessonSection from "./LessonSection";
import ModuleSection from "./ModuleSection";
import ModuleOverviewList from "./ModuleOverviewList";
import AddModuleForm from "./AddModuleForm";
import PublishControls from "./PublishControls";
import DuplicateCourseButton from "./DuplicateCourseButton";
import ArchiveCourseButton from "./ArchiveCourseButton";
import DeleteCourseButton from "./DeleteCourseButton";
import SortableModulesWrapper from "./SortableModulesWrapper";
import ImportStudentsButton from "./ImportStudentsButton";
import PreviewAsLearnerButton from "./PreviewAsLearnerButton";
import EditorSidebar from "./EditorSidebar";
import EditorNavProgress from "./EditorNavProgress";
import EditorTabs, { type EditorTab } from "./EditorTabs";
import EnrollmentList from "./EnrollmentList";
import AnalyticsDashboard from "./AnalyticsDashboard";
import InstructorsSection from "./InstructorsSection";
import SectionsClient from "./SectionsClient";
import CourseAssignmentsBrowser from "../../assignments/CourseAssignmentsBrowser";

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
  searchParams?: {
    lesson?: string;
    tab?: string;
    assignmentLesson?: string;
    assignmentFilter?: string;
  };
}) {
  const TAB_VALUES: EditorTab[] = [
    "overview",
    "content",
    "students",
    "sections",
    "assignments",
    "analytics",
  ];
  const requestedTab: EditorTab = TAB_VALUES.includes(searchParams?.tab as EditorTab)
    ? (searchParams!.tab as EditorTab)
    : "overview";
  const selectedLessonId = searchParams?.lesson;
  // Auth và truy vấn khoá chạy song song — truy vấn chỉ cần params.id.
  // Cây module/bài ở đây CHỈ lấy phần nhẹ (đếm thay vì kéo hết quiz, câu hỏi,
  // đáp án của mọi bài): mỗi lần đổi bài trước đây tải cả khoá ~270KB. Dữ liệu
  // đầy đủ chỉ lấy cho đúng bài đang mở (xem `selectedLesson` bên dưới).
  const [session, course] = await Promise.all([
    auth(),
    prisma.course.findUnique({
      where: { id: params.id },
      include: {
        modules: {
          orderBy: { orderIndex: "asc" },
          include: {
            lessons: {
              orderBy: { orderIndex: "asc" },
              select: {
                id: true,
                title: true,
                orderIndex: true,
                isHidden: true,
                isLocked: true,
                skillTags: { select: { id: true } },
                _count: {
                  select: { contentItems: true, quizzes: true, assignments: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}`);
  }
  const userId = session.user.id;
  if (!course) notFound();

  // canGradeCourse is the broadest instructor-tier check (all 4 roles) — lets
  // non-editing-teacher/teaching-assistant reach the page at all (they need
  // "Học viên" for grading context). Content-edit UI is separately gated by
  // canEdit below.
  const [canAccess, canEdit, isOwner, canViewAnalytics] = await Promise.all([
    canGradeCourse(userId, course.id),
    canEditCourse(userId, course.id),
    isCourseOwner(userId, course.id),
    // Analytics is hidden from teaching-assistant (grade-only role, no course
    // reports) — same role tier as the live-moderate check.
    canModerateLiveExam(userId, course.id),
  ]);
  if (!canAccess) redirect("/instructor/courses");
  const hiddenTabs: EditorTab[] = [
    ...(!canViewAnalytics ? (["analytics"] as const) : []),
  ];
  // Content stays visible but locked (not hidden) for non-editing-teacher/
  // teaching-assistant, so they can see it exists and why it's off-limits.
  // "Lớp học" is NOT locked here — section management runs on
  // assertCanGradeCourse, not assertCanEditCourse, so both roles can use it.
  const lockedTabs: EditorTab[] = [...(!canEdit ? (["content"] as const) : [])];
  // Requesting a hidden/locked tab falls back to overview — content editor
  // isn't read-only-safe yet (forms would render but every save 403s server-side).
  const tab: EditorTab =
    hiddenTabs.includes(requestedTab) || lockedTabs.includes(requestedTab)
      ? "overview"
      : requestedTab;

  const untaggedLessonIds = course.modules.flatMap((m) =>
    m.lessons
      .filter((l) => l.skillTags.length === 0)
      .map((l) => ({ id: l.id, title: l.title })),
  );

  const firstLessonId = course.modules[0]?.lessons[0]?.id;

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  // Find selected lesson + parent module for split-pane editing
  let selectedLesson = null as any;
  let selectedModule = null as any;
  let selectedLessonOrder = 0;
  if (selectedLessonId) {
    for (const m of course.modules) {
      const idx = m.lessons.findIndex((l) => l.id === selectedLessonId);
      if (idx !== -1) {
        selectedModule = m;
        selectedLessonOrder = idx + 1;
        break;
      }
    }
    // Chỉ bài đang mở mới cần dữ liệu đầy đủ. Tìm trong cây của khoá này trước
    // rồi mới truy vấn, nên id của khoá khác không đọc được qua đường này.
    if (selectedModule && tab === "content") {
      selectedLesson = await prisma.lesson.findUnique({
        where: { id: selectedLessonId },
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
          // Unified ordering layer — drives ActivitySection's cross-type
          // drag-drop; ActivitySection joins by id on the client.
          activities: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              kind: true,
              orderIndex: true,
              contentItemId: true,
              quizId: true,
              assignmentId: true,
            },
          },
        },
      });
      if (!selectedLesson) selectedModule = null;
    }
  }

  // Sidebar tree shape — only the data we need.
  // When personalization is off, force noSkill=false so the "chưa tag skill"
  // chip stops appearing in sidebar + module overview.
  const sidebarModules = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    isHidden: m.isHidden,
    isLocked: m.isLocked,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      isHidden: l.isHidden,
      isLocked: l.isLocked,
      noSkill: course.personalizationEnabled && l.skillTags.length === 0,
      contentCount: l._count.contentItems,
      quizCount: l._count.quizzes,
      assignmentCount: l._count.assignments,
    })),
  }));

  const useWideLayout = true;

  const buildAssignmentHref = (next: { lesson?: string | null; filter?: string }) => {
    const params = new URLSearchParams();
    params.set("tab", "assignments");
    const l =
      next.lesson === undefined ? (searchParams?.assignmentLesson ?? null) : next.lesson;
    if (l) params.set("assignmentLesson", l);
    const f = next.filter ?? searchParams?.assignmentFilter ?? "all";
    if (f && f !== "all") params.set("assignmentFilter", f);
    return `/instructor/courses/${course.id}?${params.toString()}`;
  };

  return (
    <>
    {/* Trang soạn khoá dài không kém trang bài học — nhất là khi mở một bài có
        hai chục khối nội dung. Góc dưới bên phải ở đây đang trống. */}
    <ScrollEnds className="fixed bottom-20 right-4 z-30 lg:bottom-4" />
    <Suspense fallback={null}>
      <EditorNavProgress />
    </Suspense>
    <main
      className={
        useWideLayout
          ? "mx-auto max-w-7xl px-6 py-6"
          : "mx-auto max-w-5xl px-6 py-6"
      }
    >
      {/* Header — always visible across tabs */}
      <header>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            href="/instructor/courses"
            className="link inline-flex items-center gap-1 text-sm"
          >
            ← Khóa của tôi
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <PublishControls
              courseId={course.id}
              status={course.status}
              untaggedLessons={untaggedLessonIds}
              personalizationEnabled={course.personalizationEnabled}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="h-display text-2xl font-bold leading-tight sm:text-3xl">
            {course.title}
          </h1>
          <span className={STATUS_TONE[course.status] ?? "chip"}>
            {STATUS_LABEL[course.status] ?? course.status}
          </span>
            {/* Trình chiếu khoá học — mở ngay bài đầu tiên ở chế độ giảng dạy
                trong tab mới, để trang soạn còn nguyên. */}
            {firstLessonId && (
              <Link
                href={`/learn/${course.slug}/lessons/${firstLessonId}?gv=1`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-soft px-3 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                title="Mở khoá học ở chế độ giảng dạy (thanh giảng viên, ghi chú, màn chiếu) trong tab mới"
              >
                <Presentation className="h-4 w-4" aria-hidden />
                Trình chiếu khoá học
              </Link>
            )}
        </div>
      </header>

      <div className="mt-4">
        <EditorTabs
          courseId={course.id}
          active={tab}
          hiddenTabs={hiddenTabs}
          lockedTabs={lockedTabs}
        />
      </div>

      {/* TAB: Tổng quan */}
      {tab === "overview" && (
        <div className="mt-5 space-y-6">
          {course.personalizationEnabled && untaggedLessonIds.length > 0 && (
            <div className="banner-warning">
              <span className="text-xl shrink-0" aria-hidden>⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {untaggedLessonIds.length} bài chưa tag skill
                </p>
                <p className="mt-1 text-xs opacity-90">
                  Khoá không thể publish khi còn bài chưa được tag —
                  personalization sẽ không hoạt động cho những bài này.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={`?tab=content&lesson=${untaggedLessonIds[0]!.id}`}
                    className="btn-primary btn-sm"
                  >
                    Tag ngay bài đầu tiên →
                  </a>
                  <a href="?tab=content" className="btn-ghost btn-sm">
                    Xem tất cả bài chưa tag
                  </a>
                </div>
              </div>
            </div>
          )}

          {canEdit && (
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
                personalizationEnabled: course.personalizationEnabled,
                publicAccess: course.publicAccess,
                enrollMode: course.enrollMode,
              }}
            />
          </section>
          )}

          {canEdit &&
            course.priceCents !== null &&
            course.priceCents > 0 &&
            course.enrollMode === "open" && (
              // "Chỉ vào bằng link mời lớp" + có giá là bất biến bị cấm ở
              // updateCourse (courses.ts) — invite_only luôn priceCents=null.
              // Điều kiện enrollMode ở đây chỉ để phòng dữ liệu cũ/lệch,
              // không phải nhánh sẽ thực sự chạy trong luồng bình thường.
              <section>
                <AccessCodesPanel courseId={course.id} />
              </section>
            )}

          <section>
            <h2 className="text-base font-semibold">Giảng viên</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              Đồng giảng viên có toàn quyền sửa nội dung như chủ khóa; chỉ chủ
              khóa mới thêm/gỡ được.
            </p>
            <InstructorsSection courseId={course.id} isOwner={isOwner} />
          </section>

          {canEdit && (
          <section>
            <h2 className="mb-3 text-base font-semibold">Hành động khóa</h2>
            <div className="flex flex-wrap items-center gap-2">
              <DuplicateCourseButton courseId={course.id} />
              {course.status === "published" && <ArchiveCourseButton courseId={course.id} />}
              {isOwner && (
                <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
              )}
            </div>
          </section>
          )}
        </div>
      )}

      {/* TAB: Nội dung */}
      {tab === "content" && (
        <div
          className={selectedLesson && selectedModule ? "mt-6 md:flex md:gap-5 lg:gap-6" : "mt-6"}
          data-editor-body
        >
          {/* Sidebar outline chỉ hiện khi đang sửa một bài: tổng quan nội dung
              đã là danh sách đầy đủ nên không cần thêm một bản nữa. */}
          {selectedLesson && selectedModule && (
            <EditorSidebar
              courseId={course.id}
              modules={sidebarModules}
              activeLessonId={selectedLesson.id}
              view="edit"
            />
          )}

          <div className="min-w-0 flex-1">
            {selectedLesson && selectedModule && (
              /* key: pane sửa bài học giữ nguyên vị trí trong cây khi đổi
                 bài, nên không có key thì React tái dùng cùng instance —
                 form sửa còn nguyên title/ORDER của bài trước, bấm Lưu là
                 ghi ORDER cũ, đụng unique (moduleId, orderIndex) → 500 câm. */
              <article key={selectedLesson.id} className="space-y-5">
                <Link
                  href={`/instructor/courses/${course.id}?tab=content`}
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Danh sách module
                </Link>
                <div
                  className={`rounded-2xl border p-5 sm:p-6 ${
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
                    hideUntaggedWarning={!course.personalizationEnabled}
                    titleAside={
                      <PreviewAsLearnerButton
                        courseSlug={course.slug}
                        lessonId={selectedLesson.id}
                        hidden={selectedLesson.isHidden}
                      />
                    }
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
                  <div className="mt-4">
                    <ModuleOverviewList
                      courseId={course.id}
                      modules={course.modules.map((m, i) => ({
                        id: m.id,
                        title: m.title,
                        orderIndex: m.orderIndex,
                        isHidden: m.isHidden,
                        isLocked: m.isLocked,
                        lessons: sidebarModules[i]!.lessons,
                      }))}
                    />
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

      {/* TAB: Lớp học (invite link) */}
      {tab === "sections" && (
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Lớp học</h2>
            <p className="mt-1 text-sm text-muted">
              Cùng 1 khoá học có thể có nhiều lớp — mỗi lớp có link mời riêng để học viên tự đăng ký.
            </p>
          </div>
          <SectionsClient courseId={course.id} />
        </div>
      )}

      {/* TAB: Assignment — danh sách bài học (theo module) → assignment của
          bài học đó, dùng chung component với trang /instructor/assignments. */}
      {tab === "assignments" && (
        <CourseAssignmentsBrowser
          courseId={course.id}
          courseTitle={course.title}
          requestedLessonId={searchParams?.assignmentLesson ?? null}
          filter={searchParams?.assignmentFilter ?? "all"}
          buildHref={buildAssignmentHref}
        />
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
    </>
  );
}
