import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  canEditCourse,
  getCourseProgress,
  isUserEnrolled,
  listThreadsForLesson,
} from "@feedbackme/core-lms";
import { shouldSkipLesson } from "@feedbackme/core-feedback";
import { LearningEventType } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import LessonContent from "@/components/LessonContent";
import SkipLessonBanner from "@/components/SkipLessonBanner";
import LessonForumSection from "@/components/LessonForumSection";
import AiTutorPanel from "@/components/AiTutorPanel";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import LessonTabs, { type TabKey } from "@/components/lesson/LessonTabs";
import LessonTasksTab, {
  type TaskItem,
} from "@/components/lesson/LessonTasksTab";
import LessonStickyActions from "@/components/lesson/LessonStickyActions";
import LessonCompletionPrompt from "@/components/lesson/LessonCompletionPrompt";
import LessonEngagementTracker from "@/components/lesson/LessonEngagementTracker";
import ScrollEnds from "@/components/ScrollEnds";
import LessonNotesDrawer from "@/components/lesson/LessonNotesDrawer";
import LessonTocDrawer from "@/components/lesson/LessonTocDrawer";
import LessonSectionNav from "@/components/lesson/LessonSectionNav";
import LessonContentToolbar from "@/components/lesson/LessonContentToolbar";
import TeacherBar, { StageListener } from "@/components/lesson/TeacherBar";
import { isNativeVideoUrl } from "@/lib/videoUrl";
import { Download, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

// Sentinel for user-scoped filters when nobody is signed in. Never a real id, so
// the filter matches zero rows — as opposed to `undefined`, which Prisma would
// treat as "no filter at all".
const NO_USER = "__anonymous__";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: { slug: string; lessonId: string };
  /**
   * `gv=1` bật chế độ giảng viên (hiện ghi chú), `stage=1` biến trang thành
   * màn chiếu: bỏ hết phần điều hướng, chỉ còn nội dung. Cả hai đều nằm trên
   * URL chứ không phải trong state, để cửa sổ trình chiếu mở ra bằng một
   * đường dẫn là xong.
   */
  searchParams?: { gv?: string; stage?: string };
}) {
  const session = await auth();
  // May be null: courses with `publicAccess` are readable logged-out. Everything
  // downstream that filters by user must handle that — see NO_USER below.
  const userId = session?.user?.id ?? null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: { include: { course: { select: { id: true, slug: true, title: true, priceCents: true, currency: true, version: true, status: true, publicAccess: true } } } },
      // isLocked của bài nằm sẵn trong `lesson`; của module lấy qua include ở trên.
      contentItems: { orderBy: { orderIndex: "asc" } },
      quizzes: {
        select: {
          id: true,
          title: true,
          isHidden: true,
          createdAt: true,
          cuepointOnly: true,
        },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          maxScore: true,
          isHidden: true,
          createdAt: true,
          pedagogicalIntent: true,
          responseFormat: true,
          requireSelfRating: true,
          requireReflection: true,
          countsTowardGrade: true,
          submissions: {
            // NEVER pass a nullable userId straight in: Prisma reads `undefined`
            // as "drop this condition", so an anonymous visitor would match every
            // learner's submission — score, feedback, reflection and all. The
            // sentinel matches nothing instead. (strictUndefinedChecks is off
            // repo-wide, so the type system will not catch this for us.)
            where: { userId: userId ?? NO_USER },
            select: {
              id: true,
              status: true,
              submittedAt: true,
              score: true,
              feedback: true,
              selfRating: true,
              reflection: true,
            },
          },
        },
      },
    },
  });
  if (!lesson || lesson.module.course.slug !== params.slug) notFound();
  if (lesson.isHidden) notFound();

  // A public course opens every non-hidden lesson to everyone — but only while it
  // is actually published. Without the status check, flipping `publicAccess` on a
  // draft would put unfinished material on the open internet.
  const publiclyReadable =
    lesson.module.course.publicAccess && lesson.module.course.status === "published";

  const enrolled = userId ? await isUserEnrolled(userId, lesson.module.course.id) : false;
  // Người dạy khoá này vào được bài mà không cần ghi danh — trước đây họ bị đá
  // về trang giới thiệu, tức là muốn xem bài mình vừa soạn thì phải tự ghi danh
  // vào khoá của chính mình.
  const canEdit = userId ? await canEditCourse(userId, lesson.module.course.id) : false;
  // Ẩn cả module thì bài bên trong cũng phải khoá lại, không thì học viên biết
  // đường dẫn vẫn vào thẳng được. Người dạy khoá này thì vẫn vào — họ cần soạn
  // và chiếu thử nội dung chưa mở cho lớp.
  if (lesson.module.isHidden && !canEdit) notFound();
  const teacherMode = canEdit && searchParams?.gv === "1";
  const stageMode = searchParams?.stage === "1";

  // B14 — khoá thì học viên vẫn biết bài này tồn tại (mục lục hiện tên kèm ổ
  // khoá), nhưng nội dung không được gửi xuống trình duyệt. Chặn ngay ở đây,
  // trước mọi truy vấn nội dung, chứ không giấu bằng CSS: giấu bằng CSS thì
  // toàn bộ bài vẫn nằm trong mã nguồn trang.
  const lockedForLearner = (lesson.isLocked || lesson.module.isLocked) && !canEdit;
  if (lockedForLearner) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Link
          href={`/learn/${params.slug}`}
          className="text-sm text-muted underline decoration-dotted"
        >
          ← {lesson.module.course.title}
        </Link>
        <div className="mt-8 rounded-2xl border border-token bg-[rgb(var(--surface))] px-6 py-10">
          <Lock className="mx-auto h-10 w-10 text-faint" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold">{lesson.title}</h1>
          <p className="mt-1 text-sm text-faint">{lesson.module.title}</p>
          <p className="mt-4 text-sm text-muted">
            Nội dung bài này đang khoá. Giảng viên sẽ mở khi lớp học tới phần
            này — bạn không cần làm gì thêm.
          </p>
          <Link href={`/learn/${params.slug}`} className="btn-primary mt-6 inline-block">
            Về trang khoá học
          </Link>
        </div>
      </main>
    );
  }
  if (!enrolled && !canEdit) {
    if (!userId) {
      // Logged out: public courses render as preview, everything else signs in.
      if (!publiclyReadable) {
        redirect(`/signin?callbackUrl=/learn/${params.slug}/lessons/${params.lessonId}`);
      }
    } else if (!lesson.previewable && !publiclyReadable) {
      const paid = lesson.module.course.priceCents !== null && lesson.module.course.priceCents > 0;
      // Luôn kèm lý do: khoá miễn phí trước đây bị đá về tay không, người dùng
      // quay lại đúng trang cũ và không biết vì sao.
      redirect(`/catalog/${params.slug}?${paid ? "paywall=1" : "locked=1"}`);
    }
    // Otherwise fall through and render as preview below.
  }

  const allLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.course.id } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true, title: true },
  });
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1]! : null;
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1]! : null;

  // Preview mode: anyone without an enrollment — logged out on a public course, or
  // logged in on a previewable lesson. Skip enrollment-dependent queries and render
  // with a CTA banner.
  if (!enrolled && !canEdit) {
    const anonymous = userId === null;
    // Forum stays behind sign-in: threads carry learner display names, and
    // publishing those to the open internet is not something a course-visibility
    // toggle should silently decide (CLAUDE.md §5.4 — privacy by default).
    const threads = anonymous ? [] : await listThreadsForLesson(lesson.id);
    const course = lesson.module.course;
    const paid = course.priceCents !== null && course.priceCents > 0;
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/catalog/${params.slug}`} className="link inline-flex items-center gap-1 text-base font-medium">
            ← {course.title}
          </Link>
        </div>
        {/* Preview banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-soft px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-brand-700">
              {anonymous ? "Bạn đang xem thử công khai" : "Bài học preview miễn phí"}
            </p>
            <p className="text-sm text-brand-600">
              {anonymous
                ? "Đăng nhập để lưu tiến độ, làm bài tập, thảo luận và nhận phản hồi."
                : paid
                  ? "Mua khoá học để truy cập toàn bộ nội dung."
                  : "Đăng ký miễn phí để học toàn bộ khoá."}
            </p>
          </div>
          <a
            href={
              anonymous
                ? `/signin?callbackUrl=/learn/${params.slug}/lessons/${params.lessonId}`
                : `/catalog/${params.slug}`
            }
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {anonymous ? "Đăng nhập" : paid ? "Xem khoá học" : "Đăng ký ngay"}
          </a>
        </div>
        {/* Cùng kiểu panel như bản dành cho người đã ghi danh. */}
        <header className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card sm:p-6">
          <span className="chip">{lesson.module.title}</span>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">{lesson.title}</h1>
          {lesson.description && (
            <SafeHtml
              html={plainToRichHtml(lesson.description)}
              className="prose mt-3 max-w-none text-base text-muted dark:prose-invert"
            />
          )}
          {/* Bản in cũng mở cho người xem thử: quy tắc truy cập của trang in
              giống hệt trang này, nên giấu nút đi chỉ làm khó người dùng chứ
              không giữ được gì. */}
          <div className="mt-5">
            <a
              href={`/learn/${params.slug}/lessons/${params.lessonId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill"
            >
              <Download size={16} />
              In / Lưu PDF
            </a>
          </div>
        </header>
        <div className="mt-8">
          <LessonContent
            items={lesson.contentItems
              .filter((c) => !c.isHidden)
              .map((c) => ({ id: c.id, type: c.type, payload: c.payload, orderIndex: c.orderIndex }))}
            courseId={course.id}
            lessonId={lesson.id}
            interactive={!anonymous}
          />
        </div>
        {!anonymous && (
          <LessonForumSection threads={threads} lessonId={lesson.id} courseSlug={params.slug} />
        )}
      </main>
    );
  }

  // Enrolled implies a session (see `enrolled` above) — this narrows `userId` to a
  // string for the rest of the page and is unreachable in practice.
  if (!userId) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/lessons/${params.lessonId}`);
  }

  // Giảng viên vào bài mà không ghi danh thì không có hàng enrollment — nên
  // findUnique chứ không phải findUniqueOrThrow, và mọi thứ đọc từ nó phải
  // chịu được null (vị trí học dở, tiến độ khoá).
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.module.course.id } },
  });

  const completedEvent = await prisma.learningEvent.findFirst({
    where: {
      userId,
      courseId: lesson.module.course.id,
      eventType: LearningEventType.LessonCompleted,
      eventKey: `lesson.completed:${userId}:${lesson.id}`,
    },
  });

  const progress = await getCourseProgress(userId, lesson.module.course.id);
  const threads = await listThreadsForLesson(lesson.id);

  const skipSuggestion = completedEvent
    ? null
    : await shouldSkipLesson(userId, lesson.id);

  // Visible tasks: quizzes (excluding hidden + cuepoint-only) + assignments,
  // merged & sorted by createdAt so the order matches what the instructor
  // authored. Quiz "status" comes from the user's best attempt.
  const visibleQuizzes = lesson.quizzes.filter(
    (q) => !q.isHidden && !q.cuepointOnly,
  );
  const visibleAssignments = lesson.assignments.filter((a) => !a.isHidden);

  const quizAttempts = visibleQuizzes.length
    ? await prisma.quizAttempt.findMany({
        where: { userId, quizId: { in: visibleQuizzes.map((q) => q.id) } },
        select: { quizId: true, status: true, scorePct: true, passed: true },
        orderBy: { startedAt: "desc" },
      })
    : [];
  const bestAttemptByQuiz = new Map<
    string,
    {
      passed: boolean | null;
      scorePct: number | null;
      attempted: boolean;
      submitted: boolean;
    }
  >();
  for (const att of quizAttempts) {
    const cur = bestAttemptByQuiz.get(att.quizId);
    const score = att.scorePct ?? null;
    const isSubmitted = att.status === "submitted";
    if (!cur) {
      bestAttemptByQuiz.set(att.quizId, {
        attempted: true,
        submitted: isSubmitted,
        passed: att.passed ?? null,
        scorePct: score,
      });
    } else {
      // Keep "passed"/"submitted" sticky; otherwise prefer the higher score.
      const passed = cur.passed || (att.passed ?? false) ? true : cur.passed;
      const submitted = cur.submitted || isSubmitted;
      const bestScore =
        score !== null && (cur.scorePct === null || score > cur.scorePct)
          ? score
          : cur.scorePct;
      bestAttemptByQuiz.set(att.quizId, {
        attempted: true,
        submitted,
        passed,
        scorePct: bestScore,
      });
    }
  }

  const tasks: TaskItem[] = [
    ...visibleQuizzes.map<TaskItem>((q) => {
      const best = bestAttemptByQuiz.get(q.id);
      return {
        kind: "quiz",
        id: q.id,
        title: q.title,
        attempted: best?.attempted ?? false,
        passed: best?.passed ?? null,
        scorePct: best?.scorePct ?? null,
        _sort: q.createdAt.getTime(),
      } as TaskItem & { _sort: number };
    }),
    ...visibleAssignments.map<TaskItem>((a) => ({
      kind: "assignment",
      id: a.id,
      title: a.title,
      description: a.description,
      dueAt: a.dueAt,
      maxScore: a.maxScore,
      pedagogicalIntent: a.pedagogicalIntent,
      responseFormat: a.responseFormat,
      requireSelfRating: a.requireSelfRating,
      requireReflection: a.requireReflection,
      submission: a.submissions[0]
        ? {
            status: a.submissions[0].status,
            submittedAt: a.submissions[0].submittedAt,
            score: a.submissions[0].score,
            feedback: a.submissions[0].feedback,
          }
        : null,
      _sort: a.createdAt.getTime(),
    }) as TaskItem & { _sort: number }),
  ]
    .sort((a, b) => (a as any)._sort - (b as any)._sort)
    .map(({ _sort, ...rest }: any) => rest);

  const tasksUndone =
    tasks.filter((t) =>
      t.kind === "quiz" ? !t.passed : t.submission?.status !== "graded",
    ).length;

  const defaultTab: TabKey = tasksUndone > 0 ? "tasks" : "forum";

  // Auto-complete criteria. Computed server-side because we already know all
  // the inputs here (content shape + per-user activity status). Client-side
  // tracker (LessonStickyActions) only handles the live signals we can't
  // determine from the server: ongoing video watch %, and scroll-to-end.
  //
  // Rules:
  //   - Video required iff the lesson has at least one native (<video>-playable)
  //     video ContentItem. Provider iframes (YouTube/Vimeo) can't be tracked.
  //   - Activities required iff the lesson has any visible quiz or assignment.
  //   - Scroll-to-end ONLY when neither video nor activities apply (text/PDF/
  //     embed lessons). Avoids forcing a scroll on lessons where the video or
  //     quiz already verifies engagement.
  const hasNativeVideo = lesson.contentItems.some(
    (c) =>
      c.type === "video" &&
      !c.isHidden &&
      isNativeVideoUrl(
        ((c.payload as { url?: string } | null)?.url ?? "") as string,
      ),
  );
  const hasAnyActivity =
    visibleQuizzes.length > 0 || visibleAssignments.length > 0;
  // Pending = quizzes never submitted + assignments without any submission.
  // Trước đây tính theo `passed` — nộp bài mà chưa đạt điểm coi như chưa
  // xong, nên hoàn thành bài lẫn % tiến độ khoá kẹt ở chỗ học viên đã làm
  // xong quiz (dù trượt) và nộp bài tập rồi. Đổi tiêu chí "hoàn thành hoạt
  // động" sang "đã nộp" — độ đạt/không đạt vẫn hiện riêng qua cảnh báo ở
  // LessonTasksTab, chỉ không còn chặn hoàn thành bài học nữa.
  const pendingActivityCount =
    visibleQuizzes.filter((q) => !(bestAttemptByQuiz.get(q.id)?.submitted === true))
      .length +
    visibleAssignments.filter((a) => a.submissions.length === 0).length;
  const totalActivityCount = visibleQuizzes.length + visibleAssignments.length;
  const autoCompleteConfig = {
    requireVideoWatch: hasNativeVideo,
    videoThresholdPct: lesson.completionThresholdPct ?? 80,
    requireAllActivities: hasAnyActivity,
    pendingActivityCount,
    totalActivityCount,
    // Scroll fallback only when there's no other engagement signal to verify.
    requireScrollToEnd: !hasNativeVideo && !hasAnyActivity,
  };

  // Ghi chú giảng viên là một LOẠI nội dung riêng, không phải khối bị ẩn: học
  // viên không bao giờ nhận được nó, kể cả khi ai đó lỡ bật `isHidden` sai.
  const teacherNotes = lesson.contentItems.filter((c) => c.type === "teacher_note");
  const visibleItems = lesson.contentItems
    .filter((c) => !c.isHidden)
    // Người dạy nhận ghi chú NGAY TỪ ĐẦU, bật/tắt chỉ là đổi hiển thị bằng CSS.
    // Trước đây bật ghi chú phải đi một vòng lên máy chủ để render lại cả bài —
    // mất vài giây, mà trong lúc ấy màn hình không đổi gì, nên người dạy tưởng
    // nút hỏng và bấm tiếp. Học viên vẫn không bao giờ nhận được khối này.
    .filter((c) => c.type !== "teacher_note" || canEdit)
    .map((c) => ({
      id: c.id,
      type: c.type,
      payload: c.payload,
      orderIndex: c.orderIndex,
    }));

  return (
    <main
      // `data-stage` bật bộ CSS biến trang thành màn chiếu: giấu mọi thứ trừ
      // khối nội dung, phóng cỡ chữ. Làm bằng CSS chứ không dựng một trang
      // riêng — hai bản nội dung khác nhau là hai bản có thể lệch nhau.
      data-stage={stageMode ? "1" : undefined}
      // Trạng thái ban đầu của công tắc ghi chú; sau đó TeacherBar tự đổi thuộc
      // tính này trên <html> để bật/tắt tức thì, không tải lại trang.
      data-gv={teacherMode ? "1" : undefined}
      className="mx-auto max-w-6xl px-4 py-6 lg:px-6"
    >
      {stageMode && <StageListener lessonId={lesson.id} />}
      {/*
        Hàng trên chỉ còn đường quay lại khoá. Mục lục đã có sẵn ở thanh dính
        dưới đáy — luôn trong tầm tay dù đang đọc tới đâu — nên đặt thêm một
        nút nữa ở đây chỉ là hai lối vào cùng một ngăn kéo. Vị trí bài và phần
        trăm hoàn thành chuyển xuống nằm ngay cạnh thanh tiến độ, vì đó chính
        là thứ chúng nói về.
      */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link
          href={`/learn/${params.slug}`}
          className="link inline-flex items-center gap-1 text-base font-medium"
        >
          ← {lesson.module.course.title}
        </Link>
      </div>

      {/*
        Tiêu đề bài nằm trong panel riêng, và hai nút công cụ đứng ngay dưới nó:
        chúng thao tác lên chính bài này, nên đặt cạnh tên bài thì rõ phạm vi
        hơn là thả nổi ở mép trên trang. Thanh tiến độ khoá khép panel lại.
      */}
      <header className="mt-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card sm:p-6">
        <span className="chip">{lesson.module.title}</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {lesson.title}
        </h1>
        {lesson.description && (
          <SafeHtml
            html={plainToRichHtml(lesson.description)}
            className="prose mt-3 max-w-none text-base text-muted dark:prose-invert"
          />
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {/* Bản in mở tab mới, trang in tự gọi hộp thoại in. */}
          <LessonContentToolbar
            printHref={`/learn/${params.slug}/lessons/${params.lessonId}/print${
              teacherMode ? "?gv=1" : ""
            }`}
          />
        </div>
        <div className="mt-5">
          {/* Chỉ phần trăm khoá học. Bỏ "Bài 2 / 22" vì nó đá nhau với số hiệu
              in ngay trên tiêu đề: bài tên "Bài 1.2" mà dòng dưới ghi "Bài 2"
              thì người đọc phải dừng lại đối chiếu hai cách đánh số. */}
          <p className="mb-1.5 text-sm text-muted">
            <span className="tabular-nums">{progress.courseCompletionPct}%</span>{" "}
            hoàn thành khoá học
          </p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
            role="progressbar"
            aria-label="Tiến độ khoá học"
            aria-valuenow={progress.courseCompletionPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
              style={{ width: `${progress.courseCompletionPct}%` }}
            />
          </div>
        </div>
      </header>

      {skipSuggestion?.shouldSkip && (
        <div className="mt-6">
          <SkipLessonBanner
            lessonId={lesson.id}
            courseSlug={params.slug}
            nextLessonId={next?.id ?? null}
            masteries={skipSuggestion.masteries.map((m) => ({
              skillCode: m.skillCode,
              skillName: m.skillName,
              masteryProbability: m.masteryProbability,
            }))}
          />
        </div>
      )}

      {/*
        Completion prompt + auto-tracker. Mounted high so the learner sees what's
        still pending before scrolling into content. Self-hides once the lesson
        is already completed (server-rendered state via completedEvent).
      */}
      {/*
        B11 — chỉ đo người học đã ghi danh. Giảng viên xem lại bài của chính
        mình, hay người xem thử bản preview, không phải dữ liệu học tập; trộn
        vào là làm hỏng chính con số ta định dùng.
      */}
      {enrollment && !stageMode && <LessonEngagementTracker lessonId={lesson.id} />}

      {/* Bài học là trang dài nhất hệ thống có. Xếp tiếp vào cột nút nổi bên
          phải; ẩn khi đang chiếu, vì lúc đó cả lớp nhìn vào màn hình. */}
      {!stageMode && <ScrollEnds className="fixed bottom-[17rem] right-4 z-30" />}

      <div className="mt-6">
        <LessonCompletionPrompt
          lessonId={lesson.id}
          courseSlug={params.slug}
          initiallyCompleted={completedEvent !== null}
          autoComplete={autoCompleteConfig}
        />
      </div>

      {canEdit && !stageMode && (
        <TeacherBar
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          teacherMode={teacherMode}
          noteCount={teacherNotes.length}
          containerId="lesson-content"
        />
      )}

      {/* Nội dung bài + mục lục nổi bên trái (từ 1280px trở lên).
          Khối phóng toàn màn hình là #lesson-stage chứ không phải riêng phần
          nội dung: phóng to mà bỏ mục lục lại phía sau thì bài dài mất luôn
          cách nhảy giữa các mục — đúng lúc cần nhất. */}
      <div
        id="lesson-stage"
        className="mt-8 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-8"
      >
        <LessonSectionNav containerId="lesson-content" />
        <div>
        {/* Trên màn chiếu, tên bài phải luôn nhìn thấy: người vào muộn hoặc ngẩng
            lên giữa chừng cần biết đang học bài nào mà không phải hỏi. Dính theo
            mép trên vì cuộn tới mục 4 thì tiêu đề bài đã trôi mất từ lâu. */}
        {stageMode && (
          <div className="sticky top-0 z-10 mb-4 border-b border-token bg-[rgb(var(--surface))] pb-2">
            <p className="text-sm font-medium text-muted">{lesson.module.title}</p>
            <p className="h-display text-2xl font-bold leading-tight">{lesson.title}</p>
          </div>
        )}
        <div id="lesson-content">
        <LessonContent
          items={visibleItems}
          courseId={lesson.module.course.id}
          lessonId={lesson.id}
        />
        </div>
        </div>
      </div>

      <LessonTabs
        defaultTab={defaultTab}
        tabs={[
          { key: "tasks", label: "Bài tập", icon: "📝", count: tasksUndone },
          { key: "forum", label: "Thảo luận", icon: "💬", count: threads.length },
        ]}
      >
        {{
          tasks: (
            <LessonTasksTab items={tasks} courseSlug={params.slug} />
          ),
          forum: (
            <LessonForumSection
              lessonId={lesson.id}
              courseSlug={params.slug}
              threads={threads.map((t) => ({
                id: t.id,
                title: t.title,
                body: t.body,
                resolvedPostId: t.resolvedPostId,
                createdAt: t.createdAt,
                author: { displayName: t.author.displayName },
                _count: { posts: t._count.posts },
              }))}
            />
          ),
        }}
      </LessonTabs>

      <LessonNotesDrawer lessonId={lesson.id} />

      {/* Sentinel for scroll-to-end auto-complete tracker (text-only lessons). */}
      <div id="lesson-end-sentinel" aria-hidden className="h-px w-full" />

      <LessonStickyActions
        lessonId={lesson.id}
        courseSlug={params.slug}
        completed={completedEvent !== null}
        initialResumeSec={
          enrollment?.lastLessonId === lesson.id
            ? enrollment.lastPositionSec ?? 0
            : 0
        }
        prevLessonId={prev?.id ?? null}
        prevTitle={prev?.title ?? null}
        nextLessonId={next?.id ?? null}
        nextTitle={next?.title ?? null}
        toc={
          <LessonTocDrawer
            slug={params.slug}
            currentLessonId={lesson.id}
            modules={progress.modules}
            triggerClassName="btn btn-secondary"
            triggerLabel={`Mục lục khoá · bài ${idx + 1}/${allLessons.length}`}
          />
        }
      />

      <AiTutorPanel lessonId={lesson.id} />
    </main>
  );
}
