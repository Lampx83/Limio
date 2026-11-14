import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  canEditCourse,
  effectiveAssignmentDues,
  findVirtualLecturer,
  getCourseProgress,
  getEffectiveVirtualLecturer,
  getLearnerNarrations,
  getLessonSlideState,
  ExamError,
  buildLessonFrame,
  getPracticeBlockSummaries,
  getPracticeForEmbed,
  getPracticePreview,
  getExamRefStates,
  getExamRefPreviewCard,
  isUserEnrolled,
  listMockExamsForLearner,
  listThreadsForLesson,
  loadLessonDurations,
  minutesOf,
  registerLessonMedia,
  resolveQuizScore,
} from "@feedbackme/core-lms";
import {
  OUTLINE_MIN_SOURCE_CHARS,
  getSpeakingFeedbackForLearner,
  getWritingFeedbackForLearner,
  resolveFeedbackVariant,
  shouldSkipLesson,
} from "@feedbackme/core-feedback";
import { LANGUAGE_SKILL_LABEL, LearningEventType } from "@feedbackme/shared-types";
import { estimateLessonDeckTokens, formatTokenCount } from "@/lib/limioLiveLessonDeck";
import { auth } from "@/lib/auth";
import { getActiveRole } from "@/lib/active-role";
import { getT, getUiLang } from "@/lib/i18n/server";
import { isLearnerRole } from "@/lib/learnerRole";
import { parseLessonView, splitLessonItems } from "@/lib/lessonFrameView";
import { loadCourseLessonVideos, type LessonVideoInfo } from "@/lib/lessonVideo";
import EnrollButton from "@/components/EnrollButton";
import LessonFrameLayout, { LessonViewTabs } from "@/components/language/LessonFrame";
import { LESSON_FRAME_ALL_COURSES_KEY, isLessonFrameAllCoursesEnabled, lessonFrameApplies, lessonLevelLabel } from "@/lib/lessonFramePolicy";
import { getSiteSetting } from "@/lib/site-settings";
import { ExamRefLearnerBlock, ExamRefPreviewBlock } from "@/components/exam/ExamRefBlock";
import LessonPractice from "@/components/language/LessonPractice";
import PracticeBlockNotice from "@/components/language/PracticeBlockNotice";
import LessonContent from "@/components/LessonContent";
import SkipLessonBanner from "@/components/SkipLessonBanner";
import LessonForumSection from "@/components/LessonForumSection";
import AiTutorPanel from "@/components/AiTutorPanel";
import LessonAnnotations from "@/components/lesson/LessonAnnotations";
import { withoutHiddenAudioTranscripts } from "@/lib/lessonAudio";
import SafeHtml from "@/components/SafeHtml";
import { htmlToPlainText, plainToRichHtml } from "@/lib/richText";
import LessonTabs, { type TabKey } from "@/components/lesson/LessonTabs";
import LessonTasksTab, {
  type TaskItem,
} from "@/components/lesson/LessonTasksTab";
import LessonViewBeacon from "@/components/lesson/LessonViewBeacon";
import LessonCompletionPrompt from "@/components/lesson/LessonCompletionPrompt";
import LessonEngagementTracker from "@/components/lesson/LessonEngagementTracker";
import ScrollEnds from "@/components/ScrollEnds";
import LessonNotesDrawer from "@/components/lesson/LessonNotesDrawer";
import LessonTocDrawer from "@/components/lesson/LessonTocDrawer";
import LessonContentToolbar from "@/components/lesson/LessonContentToolbar";
import NarrationButton from "@/components/narration/NarrationButton";
import NarrationPlayer from "@/components/narration/NarrationPlayer";
import { lecturerVideoEnabled } from "@/lib/narration/lecturerVideoFlag";
import PodcastButton from "@/components/narration/PodcastButton";
import LecturerInvite from "@/components/narration/LecturerInvite";
import type { DeckCoverInfo } from "@/components/narration/DeckCover";
import { deckCoverId, withoutDeckIntro } from "@/lib/narration/deckCover";
import { loadDeck } from "@/lib/slideDeck/decks";
import LessonSlideButton, { type LessonSlideInfo } from "@/components/lesson/LessonSlideButton";
import TeacherBar, { StageListener } from "@/components/lesson/TeacherBar";
import { isNativeVideoUrl } from "@/lib/videoUrl";
import { Download, Lock, PenLine } from "lucide-react";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Bài học của khoá `publicAccess` là nội dung công khai thật — đây là thứ có
 * cơ hội xếp hạng cho truy vấn dài ("cách tính độ lệch chuẩn", "PLS-SEM là gì"),
 * chứ không phải trang bán khoá. Mọi bài học khác phải `noindex`: với Googlebot
 * chúng chỉ redirect về `/signin`, và index chúng nghĩa là đẩy hàng nghìn trang
 * đăng nhập trùng nhau vào kết quả tìm kiếm.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string; lessonId: string };
}): Promise<Metadata> {
  const t = await getT();
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: {
      title: true,
      description: true,
      isHidden: true,
      updatedAt: true,
      module: {
        select: {
          course: {
            select: { title: true, slug: true, status: true, publicAccess: true, coverUrl: true },
          },
        },
      },
    },
  });

  if (!lesson) return { title: t("learn.lesson.notFound"), robots: { index: false } };

  const course = lesson.module.course;
  const indexable =
    course.publicAccess && course.status === "published" && !lesson.isHidden;

  return pageMetadata({
    title: `${lesson.title} — ${course.title}`,
    description:
      htmlToPlainText(lesson.description) ||
      t("learn.lesson.metaDesc", { lesson: lesson.title, course: course.title, site: SITE_NAME }),
    path: `/learn/${params.slug}/lessons/${params.lessonId}`,
    image: course.coverUrl,
    type: "article",
    modifiedTime: lesson.updatedAt,
    noIndex: !indexable,
  });
}

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
   * đường dẫn là xong. `preview=1` (chỉ người dạy khoá) là giảng viên soạn bài
   * xem thử: chỉ còn tên bài, nội dung, các tab Bài tập/Thảo luận và nút
   * lên/xuống; bỏ mọi nút điều hướng/công cụ khác.
   */
  searchParams?: { gv?: string; stage?: string; preview?: string; view?: string };
}) {
  const t = await getT();
  const lang = await getUiLang();
  const session = await auth();
  // May be null: courses with `publicAccess` are readable logged-out. Everything
  // downstream that filters by user must handle that — see NO_USER below.
  const userId = session?.user?.id ?? null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: { include: { course: { select: { id: true, slug: true, title: true, priceCents: true, currency: true, version: true, status: true, publicAccess: true, languageMode: true } } } },
      // isLocked của bài nằm sẵn trong `lesson`; của module lấy qua include ở trên.
      contentItems: { orderBy: { orderIndex: "asc" } },
      quizzes: {
        select: {
          id: true,
          title: true,
          isHidden: true,
          createdAt: true,
          cuepointOnly: true,
          scoringPolicy: true,
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
          submissionMode: true,
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
              // Nộp theo nhóm — ai nộp lần cuối, lúc nào, và "Phần việc của tôi".
              teamId: true,
              teamSubmittedAt: true,
              contributionNote: true,
              submittedBy: { select: { displayName: true } },
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
  // Đang chọn vai "học viên" (RoleSwitcher) thì trang phải y hệt học viên thật: không nút Slide, không ghi chú giảng viên,
  // không vào bài khi chưa ghi danh — dù tài khoản này có quyền sửa khoá.
  const viewingAsLearner = getActiveRole(session?.user?.roles ?? []) === "learner";
  const canEdit = userId && !viewingAsLearner ? await canEditCourse(userId, lesson.module.course.id) : false;
  // Ẩn cả module thì bài bên trong cũng phải khoá lại, không thì học viên biết
  // đường dẫn vẫn vào thẳng được. Người dạy khoá này thì vẫn vào — họ cần soạn
  // và chiếu thử nội dung chưa mở cho lớp.
  if (lesson.module.isHidden && !canEdit) notFound();
  const teacherMode = canEdit && searchParams?.gv === "1";
  const stageMode = searchParams?.stage === "1";
  const previewMode = canEdit && searchParams?.preview === "1";
  // Nút "Slide" của giảng viên (docs/tieu-chi/nghe-giang-slide.md): trạng thái bài giảng slide của bài. Lỗi thì không hiện nút,
  // không làm hỏng trang bài.
  let slideInfo: LessonSlideInfo | null = null;
  if (canEdit && userId && !stageMode && !previewMode) {
    const st = await getLessonSlideState(userId, params.lessonId).catch(() => null);
    // Chủ khoá và đồng giảng viên đều thấy nút; bài giảng thuộc người tạo nên chỉ họ mở được trình soạn và trình chiếu.
    if (st) {
      slideInfo = {
        deck: st.deck,
        textWords: st.textWords,
        longEnough: st.textChars >= OUTLINE_MIN_SOURCE_CHARS,
        tokenLabel: formatTokenCount(estimateLessonDeckTokens(st.textChars)),
      };
    }
  }
  // Nghe giảng / Podcast (docs/tieu-chi/nghe-giang-podcast.md): chỉ bản giọng đã tạo xong và khớp kịch bản mới tới
  // được đây. Không có thì không hiện gì. Bắt lỗi để một sự cố ở phần nghe không bao giờ làm hỏng trang bài.
  const narrations =
    stageMode || previewMode
      ? { lecture: null, podcast: null }
      : await getLearnerNarrations(params.lessonId, undefined, { lecturerVideo: lecturerVideoEnabled() }).catch(() => ({ lecture: null, podcast: null }));

  // Giảng viên ảo (docs/tieu-chi/giang-vien-ao.md): chỉ phủ lên Nghe giảng đã có giọng. Mức «Không hiện» (hoặc hệ thống tắt) thì
  // giữ nguyên giao diện Nghe giảng như trước. Mức hiệu lực tính ở core-lms, một chỗ.
  const lecturerChoice =
    narrations.lecture
      ? await getEffectiveVirtualLecturer(lesson.module.course.id, userId)
          .then((e) => {
            const l = findVirtualLecturer(e.lecturerCode);
            return e.mode === "AN" || !l ? null : { mode: e.mode, code: l.code, name: l.name, accent: l.accent };
          })
          .catch(() => null)
      : null;

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
            {t("learn.lesson.lockedBody")}
          </p>
          <Link href={`/learn/${params.slug}`} className="btn-primary mt-6 inline-block">
            {t("learn.lesson.toCoursePage")}
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

  // Khoá "Học liệu có bản quyền": đưa file của bài vào bảng bảo vệ TRƯỚC khi gửi link xuống trình duyệt. Lưới an toàn
  // cho các đường ghi nội dung chưa móc registerLessonMedia (nhập Word/Markdown, AI, sao khoá...). Khoá thường: một truy vấn rồi thoát.
  await registerLessonMedia(params.lessonId);

  // Dữ liệu có cấu trúc cho bài học công khai. Phải dựng trước khi rẽ nhánh:
  // Googlebot luôn rơi vào nhánh "preview" bên dưới (nó không đăng nhập được),
  // nên đặt riêng ở nhánh đã-enroll thì crawler không bao giờ thấy.
  const structuredData = publiclyReadable ? (
    <JsonLd
      data={[
        breadcrumbJsonLd([
          { name: t("learn.lesson.crumbHome"), path: "/" },
          { name: t("learn.lesson.crumbCourses"), path: "/catalog" },
          { name: lesson.module.course.title, path: `/catalog/${params.slug}` },
          { name: lesson.title, path: `/learn/${params.slug}/lessons/${lesson.id}` },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: lesson.title,
          ...(lesson.description ? { description: htmlToPlainText(lesson.description) } : {}),
          learningResourceType: "Lesson",
          isPartOf: {
            "@type": "Course",
            name: lesson.module.course.title,
            url: absoluteUrl(`/catalog/${params.slug}`),
          },
          provider: { "@type": "EducationalOrganization", name: SITE_NAME },
          isAccessibleForFree: true,
          dateModified: lesson.updatedAt.toISOString(),
        },
      ]}
    />
  ) : null;

  const allLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.course.id } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true },
  });
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
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
        {structuredData}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/catalog/${params.slug}`} className="link inline-flex items-center gap-1 text-base font-medium">
            ← {course.title}
          </Link>
        </div>
        {/* Preview banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-soft px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-brand-700">
              {anonymous ? t("learn.lesson.previewPublic") : t("learn.lesson.previewFree")}
            </p>
            <p className="text-sm text-brand-600">
              {anonymous
                ? t("learn.lesson.signInToSave")
                : paid
                  ? t("learn.lesson.buyToAccess")
                  : t("learn.lesson.enrollFreeFull")}
            </p>
          </div>
          {!anonymous && !paid ? (
            // Khoá miễn phí: ghi danh ngay tại đây rồi vào học. Trước đây nút chỉ đưa về trang khoá, nơi nút ghi danh nằm
            // cuối thanh bên — học viên tưởng "đăng ký xong lại bị đá về trang khoá".
            <EnrollButton
              courseId={course.id}
              slug={params.slug}
              alreadyEnrolled={false}
              priceCents={0}
              paymentEnabled={false}
              freeLabel={t("learn.lesson.enrollNow")}
            />
          ) : (
            <a
              href={
                anonymous
                  ? `/signin?callbackUrl=/learn/${params.slug}/lessons/${params.lessonId}`
                  : `/catalog/${params.slug}#dang-ky`
              }
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              {anonymous ? t("learn.lesson.signIn") : t("learn.lesson.viewCourse")}
            </a>
          )}
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
              {t("learn.printPdf")}
            </a>
          </div>
        </header>
        <div className="mt-8">
          <LessonContent
            items={withoutHiddenAudioTranscripts(
              lesson.contentItems
                .filter((c) => !c.isHidden)
                .map((c) => ({ id: c.id, type: c.type, payload: c.payload, orderIndex: c.orderIndex })),
            )}
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
  const [progress, lessonVideos] = await Promise.all([
    getCourseProgress(userId, lesson.module.course.id),
    // Dấu "Có video" trong mục lục / thanh bài. Lỗi ở đây không được làm hỏng trang bài.
    loadCourseLessonVideos(lesson.module.course.id).catch(() => new Map<string, LessonVideoInfo>()),
  ]);
  // Mục lục (client component) nhận dữ liệu thuần JSON: gắn cờ video + số phút vào từng bài.
  const tocModules = progress.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => {
      const v = lessonVideos.get(l.id);
      return v ? { ...l, hasVideo: true, videoMinutes: minutesOf(v.durationSec) } : l;
    }),
  }));
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
  // Hạn hiển thị là hạn của LỚP học viên (nếu GV đặt riêng) hoặc hạn chung.
  const effectiveDues = await effectiveAssignmentDues(
    userId,
    visibleAssignments.map((a) => ({ id: a.id, courseId: lesson.module.course.id, dueAt: a.dueAt })),
  );

  // Nộp theo nhóm — học viên đã có nhóm trong khoá chưa, và danh sách nhóm đã khoá chưa
  // (thẻ bài tập nhóm dùng để chọn lời nhắc). Chỉ truy vấn khi bài có bài tập nhóm.
  const hasTeamAssignment = visibleAssignments.some((a) => a.submissionMode === "team");
  const [teamMembership, teamSettings] = hasTeamAssignment
    ? await Promise.all([
        prisma.courseTeamMember.findUnique({
          where: { courseId_userId: { courseId: lesson.module.course.id, userId } },
          select: { team: { select: { id: true, name: true } } },
        }),
        prisma.course.findUnique({
          where: { id: lesson.module.course.id },
          select: { teamsLockedAt: true },
        }),
      ])
    : [null, null];
  const teamContext = hasTeamAssignment
    ? {
        team: teamMembership?.team ?? null,
        locked: teamSettings?.teamsLockedAt != null,
      }
    : null;

  const quizAttempts = visibleQuizzes.length
    ? await prisma.quizAttempt.findMany({
        where: { userId, quizId: { in: visibleQuizzes.map((q) => q.id) } },
        select: { quizId: true, status: true, scorePct: true, submittedAt: true },
        orderBy: { startedAt: "desc" },
      })
    : [];
  const scoreAttempts = new Map<string, Array<{ scorePct: number | null; submittedAt: Date | null }>>();
  const attemptedQuizzes = new Set<string>();
  const submittedQuizzes = new Set<string>();
  for (const att of quizAttempts) {
    attemptedQuizzes.add(att.quizId);
    if (att.status !== "submitted") continue;
    submittedQuizzes.add(att.quizId);
    const list = scoreAttempts.get(att.quizId) ?? [];
    list.push({ scorePct: att.scorePct ?? null, submittedAt: att.submittedAt });
    scoreAttempts.set(att.quizId, list);
  }
  // Điểm hiển thị theo cách GV chọn cho quiz (cao nhất / cuối cùng / trung bình).
  const bestAttemptByQuiz = new Map<
    string,
    { scorePct: number | null; attempted: boolean; submitted: boolean }
  >();
  for (const q of visibleQuizzes) {
    if (!attemptedQuizzes.has(q.id)) continue;
    bestAttemptByQuiz.set(q.id, {
      attempted: true,
      submitted: submittedQuizzes.has(q.id),
      scorePct: resolveQuizScore(scoreAttempts.get(q.id) ?? [], q.scoringPolicy),
    });
  }

  // LANG G6 — góp ý bài viết bằng AI: chỉ khoá ngoại ngữ và lớp không phải đối chứng.
  const writingFeedbackEnabled =
    lesson.module.course.languageMode &&
    (await resolveFeedbackVariant(userId, lesson.module.course.id)).variant !== "minimal";
  const writingFeedbackBySubmission = new Map<string, Awaited<ReturnType<typeof getWritingFeedbackForLearner>>>();
  // LANG G7 — bài nộp dạng ghi âm dùng góp ý bài NÓI (bản chữ + nhịp nói), không phải góp ý bài viết.
  const speakingFeedbackBySubmission = new Map<string, Awaited<ReturnType<typeof getSpeakingFeedbackForLearner>>>();
  if (writingFeedbackEnabled) {
    for (const a of visibleAssignments) {
      const sub = a.submissions[0];
      if (!sub) continue;
      if (a.responseFormat === "audio") {
        speakingFeedbackBySubmission.set(sub.id, await getSpeakingFeedbackForLearner(userId, sub.id));
      } else {
        writingFeedbackBySubmission.set(sub.id, await getWritingFeedbackForLearner(userId, sub.id));
      }
    }
  }

  const tasks: TaskItem[] = [
    ...visibleQuizzes.map<TaskItem>((q) => {
      const best = bestAttemptByQuiz.get(q.id);
      return {
        kind: "quiz",
        id: q.id,
        title: q.title,
        // "Đã làm" = đã nộp; lượt đang làm dở chưa tính.
        attempted: best?.submitted ?? false,
        scorePct: best?.scorePct ?? null,
        _sort: q.createdAt.getTime(),
      } as TaskItem & { _sort: number };
    }),
    ...visibleAssignments.map<TaskItem>((a) => ({
      kind: "assignment",
      id: a.id,
      title: a.title,
      description: a.description,
      dueAt: effectiveDues.get(a.id) ?? null,
      maxScore: a.maxScore,
      pedagogicalIntent: a.pedagogicalIntent,
      responseFormat: a.responseFormat,
      requireSelfRating: a.requireSelfRating,
      requireReflection: a.requireReflection,
      submissionMode: a.submissionMode,
      submission: a.submissions[0]
        ? {
            id: a.submissions[0].id,
            speakingFeedback:
              writingFeedbackEnabled && a.responseFormat === "audio"
                ? {
                    enabled: true as const,
                    initial: (() => {
                      const f = speakingFeedbackBySubmission.get(a.submissions[0]!.id);
                      return f ? { review: f.review, body: f.body, reviewerNote: f.reviewerNote, transcript: f.transcript } : null;
                    })(),
                  }
                : undefined,
            writingFeedback: writingFeedbackEnabled && a.responseFormat !== "audio"
              ? {
                  enabled: true as const,
                  initial: (() => {
                    const f = writingFeedbackBySubmission.get(a.submissions[0]!.id);
                    return f ? { review: f.review, body: f.body, reviewerNote: f.reviewerNote } : null;
                  })(),
                }
              : undefined,
            status: a.submissions[0].status,
            submittedAt: a.submissions[0].submittedAt,
            score: a.submissions[0].score,
            feedback: a.submissions[0].feedback,
            teamId: a.submissions[0].teamId,
            teamSubmittedAt: a.submissions[0].teamSubmittedAt,
            submittedByName: a.submissions[0].submittedBy?.displayName ?? null,
            contributionNote: a.submissions[0].contributionNote,
          }
        : null,
      _sort: a.createdAt.getTime(),
    }) as TaskItem & { _sort: number }),
  ]
    .sort((a, b) => (a as any)._sort - (b as any)._sort)
    .map(({ _sort, ...rest }: any) => rest);

  const tasksUndone =
    tasks.filter((task) =>
      task.kind === "quiz" ? !task.attempted : task.submission?.status !== "graded",
    ).length;

  const defaultTab: TabKey = tasksUndone > 0 ? "tasks" : "forum";

  // Auto-complete criteria. Computed server-side because we already know all
  // the inputs here (content shape + per-user activity status). Client-side
  // tracker (LessonCompletionPrompt) only handles the live signals we can't
  // determine from the server: ongoing video watch %, and scroll-to-end.
  //
  // Rules:
  //   - Video required iff the lesson has at least one native (<video>-playable)
  //     video ContentItem. Provider iframes (YouTube/Vimeo) can't be tracked.
  //   - Activities required iff the lesson has any visible quiz or assignment.
  //   - Scroll-to-end ONLY when neither video nor activities apply (text/PDF/
  //     embed lessons). Avoids forcing a scroll on lessons where the video or
  //     quiz already verifies engagement.
  // Bài slide tương tác có giọng: màn hình bìa là lối vào duy nhất, và phải nghe đủ lời giảng mới xong (docs/tieu-chi/bai-slide-man-hinh-bia.md).
  const coverDeckId = deckCoverId(
    lesson.contentItems.filter((c) => !c.isHidden),
    narrations.lecture?.segments.map((s) => s.anchor) ?? null,
    !!lecturerChoice,
  );
  const coverDeck = coverDeckId ? loadDeck(coverDeckId) : null;
  const listenThresholdPct = lesson.completionThresholdPct ?? 80;
  const deckCover: DeckCoverInfo | null =
    coverDeckId && coverDeck && narrations.lecture && lecturerChoice
      ? {
          deckId: coverDeckId,
          lessonId: lesson.id,
          version: narrations.lecture.version,
          durationSec: narrations.lecture.durationSec,
          segments: narrations.lecture.segments.map(({ anchor, startSec, endSec }) => ({ anchor, startSec, endSec })),
          slideCount: coverDeck.slides.length,
          lecturerName: lecturerChoice.name,
          lecturerAccent: lecturerChoice.accent,
          completed: completedEvent !== null,
          thresholdPct: listenThresholdPct,
        }
      : null;
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
  // động" sang "đã nộp"; quiz không còn ngưỡng đạt hiển thị cho học viên.
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
    requireScrollToEnd: !hasNativeVideo && !hasAnyActivity && !deckCover,
    requireListen: !!deckCover,
    listenThresholdPct,
  };

  // Ghi chú giảng viên là một LOẠI nội dung riêng, không phải khối bị ẩn: học
  // viên không bao giờ nhận được nó, kể cả khi ai đó lỡ bật `isHidden` sai.
  const teacherNotes = lesson.contentItems.filter((c) => c.type === "teacher_note");
  const allVisibleItems = withoutHiddenAudioTranscripts(
      lesson.contentItems
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
      })),
  );
  const visibleItems = deckCover ? withoutDeckIntro(allVisibleItems) : allVisibleItems;

  // Khung bài học 3 cột (thanh bài · nội dung · panel AI trợ giảng + Ghi chú) cho MỌI khoá — docs/tieu-chi/limio-language-bai-hoc-3-cot.md.
  // Bật cho học viên ĐÃ GHI DANH; giữ giao diện cũ cho chưa ghi danh, xem thử, chiếu lớp, giảng viên đứng lớp và bài có bài giảng slide
  // (`lessonFrameApplies`). Công tắc `lesson_frame.all_courses` = "false" thì chỉ còn khoá ngoại ngữ. Tính năng riêng của ngoại ngữ
  // (đánh số lời thoại, tab Từ vựng) vẫn theo khoá `languageMode` (`languageSkin`).
  const languageMode = lesson.module.course.languageMode;
  const frameOn = lessonFrameApplies({
    languageMode,
    allCoursesEnabled: isLessonFrameAllCoursesEnabled(await getSiteSetting(LESSON_FRAME_ALL_COURSES_KEY)),
    enrolled: !!enrolled,
    learnerRole: isLearnerRole(getActiveRole(session?.user?.roles ?? [])),
    previewMode: !!previewMode,
    stageMode: !!stageMode,
    teacherMode: !!teacherMode,
    hasDeckCover: !!deckCover,
  });
  const languageSkin = frameOn && languageMode;
  const lessonFrame = frameOn
    ? buildLessonFrame(progress, lesson.id, await loadLessonDurations(progress.modules.flatMap((m) => m.lessons.map((l) => l.id))))
    : null;
  const notesCount = lessonFrame && userId ? await prisma.note.count({ where: { lessonId: lesson.id, userId } }) : 0;
  const frameHasExams = lessonFrame
    ? (await listMockExamsForLearner(userId, lesson.module.course.id).catch(() => [])).length > 0
    : false;
  // Bài chỉ toàn từ vựng thì không tách tab (tab "Bài học" sẽ trống): hiện thẳng như cũ.
  const rawSplit = languageSkin && lessonFrame ? splitLessonItems(visibleItems) : null;
  const split = rawSplit && rawSplit.count > 0 && rawSplit.lesson.length > 0 ? rawSplit : null;
  const lessonView = split ? parseLessonView(searchParams?.view) : "lesson";
  const shownItems = split ? (lessonView === "vocab" ? split.vocab : split.lesson) : visibleItems;

  // LANG đợt 3b — khối "Bài luyện": dựng sẵn ở máy chủ theo dữ liệu của người xem. Học viên đã ghi danh ở trang bài thường
  // (không chiếu lớp, không chế độ giảng viên) làm thật; giảng viên bấm "Xem như học viên" (`?preview=1`) cũng thấy khối, ở chế
  // độ xem thử (chấm như học viên nhưng không tạo buổi luyện, không lưu đáp án); nơi khác khối không hiện gì.
  const practiceBlocks: Record<string, React.ReactNode> = {};
  const practiceForLearner = enrolled && !previewMode && !stageMode && !teacherMode;
  const practiceForPreview = previewMode && !stageMode && !!userId;
  if (practiceForLearner || practiceForPreview) {
    // Nội dung Bài luyện nằm trong đề ẩn của chính khối (Exam.ownerContentItemId); khối chưa có câu nào thì học viên không thấy.
    const practiceItems = shownItems.filter((it) => it.type === "exam_practice");
    const summaries = await getPracticeBlockSummaries(practiceItems.map((it) => it.id));
    for (const it of practiceItems) {
      const p = (it.payload ?? {}) as { title?: string };
      const info = summaries[it.id];
      if (!info?.examId || info.questions === 0) continue;
      const examId = info.examId;
      const title = p.title || t("learn.lesson.practiceDefaultTitle");
      if (practiceForPreview) {
        // Xem như học viên: giảng viên thường không ghi danh khoá của mình nên không thể dẫn sang trang luyện đề (sẽ bị chặn);
        // nhúng thẳng bản xem thử, giống nút "Xem trước" ở trang soạn Bài luyện.
        try {
          const embed = await getPracticePreview(userId!, examId);
          practiceBlocks[it.id] = <LessonPractice slug={params.slug} embed={embed} blockTitle={p.title} lessonId={lesson.id} preview />;
        } catch (e) {
          if (!(e instanceof ExamError)) throw e;
          practiceBlocks[it.id] = <PracticeBlockNotice title={title} message={t("learn.lesson.practiceUnavailable")} />;
        }
        continue;
      }
      if (!lessonFrame) {
        // Ngoài khung (chiếu lớp, bài có slide, công tắc tắt…) chưa có giao diện nhúng: dẫn sang trang luyện đề sẵn có của đề.
        practiceBlocks[it.id] = (
          <PracticeBlockNotice
            title={title}
            message={t("learn.lesson.practiceNotice")}
            href={`/learn/${params.slug}/exams/${examId}/practice`}
            cta={t("learn.lesson.practiceOpen")}
          />
        );
        continue;
      }
      try {
        const embed = await getPracticeForEmbed(userId, examId);
        practiceBlocks[it.id] = <LessonPractice slug={params.slug} embed={embed} blockTitle={p.title} lessonId={lesson.id} />;
      } catch (e) {
        if (!(e instanceof ExamError)) throw e;
        practiceBlocks[it.id] = <PracticeBlockNotice title={title} message={t("learn.lesson.practiceUnavailable")} />;
      }
    }
  }

  // Khối "Đề thi" (exam_ref): gắn một đề thi thử của khoá vào bài. Học viên đã ghi danh thấy đúng thẻ như ở trang khoá (chỉ khi đề dùng
  // được); giảng viên bấm "Xem như học viên" thấy thẻ hoặc nhãn lý do. Chiếu lớp và trang in không hiện.
  const examRefBlocks: Record<string, React.ReactNode> = {};
  const examRefItems = shownItems.filter((it) => it.type === "exam_ref");
  if (examRefItems.length > 0 && !stageMode && userId) {
    const courseId = lesson.module.course.id;
    const refOf = (it: (typeof examRefItems)[number]) => (it.payload ?? {}) as { examId?: string | null; title?: string };
    if (enrolled && !previewMode && !teacherMode) {
      const cards = await listMockExamsForLearner(userId, courseId).catch(() => []);
      for (const it of examRefItems) {
        const { examId, title } = refOf(it);
        const card = cards.find((c) => c.examId === examId);
        if (card) examRefBlocks[it.id] = <ExamRefLearnerBlock slug={params.slug} exam={card} title={title} lang={lang} />;
      }
    } else if (previewMode) {
      const states = await getExamRefStates(courseId, examRefItems.map((it) => refOf(it).examId ?? null));
      for (const it of examRefItems) {
        const { examId, title } = refOf(it);
        const st = states.get(examId ?? null);
        const issue = st?.issue ?? "not_selected";
        const card = issue === "ok" && examId ? await getExamRefPreviewCard(courseId, examId) : null;
        examRefBlocks[it.id] = <ExamRefPreviewBlock slug={params.slug} exam={card} issue={card ? "ok" : issue === "ok" ? "missing" : issue} title={title} />;
      }
    }
  }

  const body = (
    <main
      // `data-stage` bật bộ CSS biến trang thành màn chiếu: giấu mọi thứ trừ
      // khối nội dung, phóng cỡ chữ. Làm bằng CSS chứ không dựng một trang
      // riêng — hai bản nội dung khác nhau là hai bản có thể lệch nhau.
      data-stage={stageMode ? "1" : undefined}
      // Trạng thái ban đầu của công tắc ghi chú; sau đó TeacherBar tự đổi thuộc
      // tính này trên <html> để bật/tắt tức thì, không tải lại trang.
      data-gv={teacherMode ? "1" : undefined}
      data-preview={previewMode ? "1" : undefined}
      // w-full: <main> là item của một flex column (layout gốc) và có mx-auto, nên
      // không có w-full thì nó co theo nội dung — bài ngắn/không mục lục hẹp hơn
      // hẳn bài có mục lục, chuyển bài qua lại thì độ rộng trang nhảy.
      // Trong khung 3 cột, khung ngoài đã lo lề: bỏ max-w-6xl + px-6 (chúng làm cột giữa hẹp thêm ~3rem) và dùng hết bề ngang cột giữa
      // (không căn giữa/giới hạn: thầy thấy khoảng trắng hai bên thừa).
      className={lessonFrame ? "w-full py-6" : "mx-auto w-full max-w-6xl px-4 py-6 lg:px-6"}
    >
      {stageMode && <StageListener lessonId={lesson.id} />}
      {structuredData}
      {/*
        Hàng trên chỉ còn đường quay lại khoá. Mục lục đã có sẵn ở thanh dính
        dưới đáy — luôn trong tầm tay dù đang đọc tới đâu — nên đặt thêm một
        nút nữa ở đây chỉ là hai lối vào cùng một ngăn kéo. Vị trí bài và phần
        trăm hoàn thành chuyển xuống nằm ngay cạnh thanh tiến độ, vì đó chính
        là thứ chúng nói về.
      */}
      {/* Trong khung 3 cột hàng này không còn gì ngoài nút của giảng viên, nên nút dời vào thẻ tiêu đề (cùng hàng với chip) và bỏ cả hàng. */}
      {!previewMode && !lessonFrame && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* Khung Language đã có đường dẫn "Học / Khoá / Unit / Bài" và "Về lộ trình" nên bỏ liên kết trùng này. */}
          {!lessonFrame && (
          <Link
            href={`/learn/${params.slug}`}
            className="link inline-flex items-center gap-1 text-base font-medium"
          >
            ← {lesson.module.course.title}
          </Link>
          )}
          {/* Lối thoát của giảng viên: chế độ đứng lớp mở ở tab mới nên cần một
              nút rõ ràng để về màn soạn bài này. Nằm cùng hàng với link về
              khoá học, không thả nổi để khỏi đè lên mục lục. */}
          {canEdit && (
            <Link
              href={`/instructor/courses/${lesson.module.course.id}?tab=content&lesson=${lesson.id}`}
              title={t("learn.lesson.backToEditorTitle")}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-soft px-3 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              {t("learn.lesson.backToEditor")}
            </Link>
          )}
        </div>
      )}
      {previewMode && !lessonFrame && (
        <Link
          href={`/learn/${params.slug}?preview=1`}
          className="link inline-flex items-center gap-1 text-sm font-medium"
        >
          {t("learn.lesson.backToCoursePage")}
        </Link>
      )}

      {/*
        Tiêu đề bài nằm trong panel riêng, và hai nút công cụ đứng ngay dưới nó:
        chúng thao tác lên chính bài này, nên đặt cạnh tên bài thì rõ phạm vi
        hơn là thả nổi ở mép trên trang. Thanh tiến độ khoá khép panel lại.
      */}
      <header className={`rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card ${lessonFrame ? "mt-2 p-3 sm:p-4" : "mt-3 p-4 sm:p-5"}`}>
        {lessonFrame ? (
          // Trong khung 3 cột: một hàng gọn — chip kỹ năng + tên bài bên trái, nút "Về soạn nội dung" của giảng viên bên phải. Tên module đã có
          // ở đường dẫn phía trên nên không lặp lại. Tiêu đề cỡ vừa (2xl) vì cạnh còn thanh bài, nội dung và panel.
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {lesson.languageSkill && <span className="chip-brand">{LANGUAGE_SKILL_LABEL[lesson.languageSkill]}</span>}
              <h1 className="h-display min-w-0 text-xl font-bold sm:text-2xl">{lesson.title}</h1>
            </div>
            {!previewMode && canEdit && (
              <Link
                href={`/instructor/courses/${lesson.module.course.id}?tab=content&lesson=${lesson.id}`}
                title={t("learn.lesson.backToEditorTitle")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-soft px-3 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
              >
                <PenLine className="h-4 w-4" aria-hidden />
                {t("learn.lesson.backToEditor")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="chip">{lesson.module.title}</span>
            </div>
            <h1 className="h-display mt-2 text-3xl font-bold sm:text-4xl">{lesson.title}</h1>
          </>
        )}
        {lesson.description &&
          // Trong khung, mô tả trùng tên unit/module (vd. "Lifestyle") chỉ lặp lại thanh bài và đường dẫn nên bỏ.
          !(
            lessonFrame &&
            [lessonFrame.unitTitle, lesson.module.title].some((x) => x.trim().toLowerCase() === htmlToPlainText(lesson.description).trim().toLowerCase())
          ) && (
            <SafeHtml
              html={plainToRichHtml(lesson.description)}
              className={`prose max-w-none text-muted dark:prose-invert ${lessonFrame ? "mt-1 text-sm" : "mt-2 text-base"}`}
            />
          )}
        {lecturerChoice?.mode === "HIEN" && !deckCover && (
          <LecturerInvite courseSlug={params.slug} userId={userId ?? null} name={lecturerChoice.name} accent={lecturerChoice.accent} />
        )}
        <div className={lessonFrame ? "mt-2 flex flex-wrap items-center gap-x-5 gap-y-2" : undefined}>
        {!previewMode && (
          <div className={`${lessonFrame ? "" : "mt-3 "}flex flex-wrap items-center gap-2`}>
            {/* Các nút nghe nổi bật (Nghe giảng, Podcast, Slide) đứng bên trái; nút công cụ (in) dồn sang phải cùng hàng để đỡ tốn thêm một hàng. */}
            {/* Màn hẹp: các nút nghe chia đều cột, nằm riêng một hàng; từ sm: xếp ngang theo bề rộng cố định của nút. */}
            {(narrations.lecture || narrations.podcast || slideInfo) && (
              <div className="grid w-full auto-cols-fr grid-flow-col gap-2 sm:flex sm:w-auto">
                {narrations.lecture && !deckCover && (
                  <NarrationButton durationSec={narrations.lecture.durationSec} inviteCourseSlug={lecturerChoice?.mode === "HIEN" ? params.slug : undefined} userId={userId ?? null} />
                )}
                {narrations.podcast && <PodcastButton durationSec={narrations.podcast.durationSec} title={narrations.podcast.title} />}
                {slideInfo && (
                  <LessonSlideButton lessonId={params.lessonId} lessonTitle={lesson.title} courseSlug={params.slug} info={slideInfo} />
                )}
              </div>
            )}
            {/* Khung 3 cột (thầy chốt 10/11/2026): bỏ nút "In / Lưu PDF". Trang /print vẫn còn, các bài ngoài khung vẫn có nút. */}
            {!lessonFrame && (
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full sm:ml-auto">
                {/* Bản in mở tab mới, trang in tự gọi hộp thoại in. */}
                <LessonContentToolbar
                  printHref={`/learn/${params.slug}/lessons/${params.lessonId}/print${
                    teacherMode ? "?gv=1" : ""
                  }`}
                  lang={lang}
                />
              </div>
            )}
          </div>
        )}
        {/* Thanh tiến độ + dải chip "để hoàn thành bài" gộp thành 1 số duy
            nhất từ video%/hoạt động done-total/đã cuộn hết — tự cập nhật
            theo dõi trực tiếp (video đang xem, đã cuộn tới đâu), nên phải
            là client component; xem LessonCompletionPrompt để biết công
            thức gộp. */}
        {!previewMode && (
          <div className={lessonFrame ? "min-w-[14rem] flex-1" : "mt-3"}>
            <LessonCompletionPrompt
              inline={!!lessonFrame}
              lessonId={lesson.id}
              courseSlug={params.slug}
              initiallyCompleted={completedEvent !== null}
              autoComplete={autoCompleteConfig}
            />
          </div>
        )}
        </div>
      </header>

      {split && (
        <LessonViewTabs slug={params.slug} lessonId={lesson.id} view={lessonView} vocabCount={split.count} preview={previewMode} lang={lang} />
      )}

      {!previewMode && skipSuggestion?.shouldSkip && (
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
      {enrollment && !stageMode && !previewMode && <LessonEngagementTracker lessonId={lesson.id} />}

      {/* Bài học là trang dài nhất hệ thống có. Xếp tiếp vào cột nút nổi bên
          phải; ẩn khi đang chiếu, vì lúc đó cả lớp nhìn vào màn hình. */}
      {!stageMode && <ScrollEnds className={`narration-lift fixed bottom-[17rem] right-4 z-30${lessonFrame ? " lesson-fab-scroll" : ""}`} />}
      {(narrations.lecture || narrations.podcast) && (
        <NarrationPlayer
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lecture={narrations.lecture}
          podcast={narrations.podcast}
          deckCover={!!deckCover}
          lecturer={lecturerChoice && { code: lecturerChoice.code, name: lecturerChoice.name, accent: lecturerChoice.accent, locked: lecturerChoice.mode === "BAT_BUOC" }}
        />
      )}

      {canEdit && !stageMode && !previewMode && (
        <TeacherBar
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          teacherMode={teacherMode}
          noteCount={teacherNotes.length}
          containerId="lesson-content"
          editHref={`/instructor/courses/${lesson.module.course.id}?tab=content&lesson=${lesson.id}`}
        />
      )}

      {/* Khối phóng toàn màn hình là #lesson-stage. Bài không còn mục lục
          "Trong bài này" (đã bỏ 2026-11-10: chỉ bài có từ 2 tiêu đề mới có, nên
          các bài không đồng nhất), nội dung thẳng hàng với tiêu đề bài. */}
      <div id="lesson-stage" className="mt-8">
        <div>
        {/* Trên màn chiếu, tên bài nằm ở đầu trang và cuộn đi cùng nội dung. Từng
            dính theo mép trên, nhưng header site bị ẩn nên offset 74px chừa một
            khoảng hở cho nội dung chạy xuyên qua phía trên tiêu đề, và tiêu đề
            che mất một phần màn chiếu dù giảng viên đã cuộn đi. */}
        {stageMode && (
          <div className="stage-title mb-4 border-b border-token pb-2">
            <p className="text-sm font-medium text-muted">{lesson.module.title}</p>
            <p className="h-display text-2xl font-bold leading-tight">{lesson.title}</p>
          </div>
        )}
        {/* Bọc ngoài để lề annotation (absolute, bên phải) nằm NGOÀI #lesson-content: LessonAnnotations
            quan sát DOM của #lesson-content, nên dấu ở lề đặt trong đó sẽ tự kích hoạt vòng vẽ lại. */}
        <div className="relative">
        <div id="lesson-content">
        <LessonContent
          items={shownItems}
          courseId={lesson.module.course.id}
          lessonId={lesson.id}
          deckCover={deckCover}
          blocks={{ ...practiceBlocks, ...examRefBlocks }}
          numberTranscripts={languageSkin}
        />
        </div>
        <div
          id="lesson-annotation-gutter"
          // Trong khung 3 cột panel phải đã chiếm chỗ bên phải: lề annotation thu về sát (không chồng lên nội dung).
          className={`pointer-events-none absolute bottom-0 right-0 top-0 hidden w-14 lg:block ${lessonFrame ? "" : "xl:w-44"}`}
        />
        </div>
        </div>
      </div>

      <LessonTabs
        defaultTab={defaultTab}
        tabs={[
          { key: "tasks", label: t("learn.tabs.tasks"), icon: "📝", count: tasksUndone },
          { key: "forum", label: t("learn.tabs.forum"), icon: "💬", count: threads.length },
        ]}
      >
        {{
          tasks: (
            <LessonTasksTab items={tasks} courseSlug={params.slug} teamContext={teamContext} lang={lang} />
          ),
          forum: (
            <LessonForumSection
              lessonId={lesson.id}
              courseSlug={params.slug}
              threads={threads.map((th) => ({
                id: th.id,
                title: th.title,
                body: th.body,
                resolvedPostId: th.resolvedPostId,
                createdAt: th.createdAt,
                author: { displayName: th.author.displayName },
                _count: { posts: th._count.posts },
              }))}
            />
          ),
        }}
      </LessonTabs>

      {!previewMode && !lessonFrame && <LessonNotesDrawer lessonId={lesson.id} />}

      {/* Sentinel for scroll-to-end auto-complete tracker (text-only lessons). */}
      <div id="lesson-end-sentinel" aria-hidden className="h-px w-full" />

      {!previewMode && (
        <LessonViewBeacon
          lessonId={lesson.id}
          initialResumeSec={
            enrollment?.lastLessonId === lesson.id
              ? enrollment.lastPositionSec ?? 0
              : 0
          }
        />
      )}

      {!previewMode && !lessonFrame && (
        <LessonTocDrawer
          slug={params.slug}
          currentLessonId={lesson.id}
          modules={tocModules}
          tooltipLabel={t("learn.toc.tooltip", { n: idx + 1, total: allLessons.length })}
        />
      )}

      {!previewMode && !lessonFrame && <AiTutorPanel lessonId={lesson.id} />}

      {/* Bôi đen → chuột phải → annotation / hỏi AI. Không gắn khi chiếu lớp
          (stage): menu chuột phải bất ngờ hiện trên màn chiếu là điều không ai
          muốn. Cần có tài khoản — người đọc ẩn danh của khoá công khai không
          có annotation để lưu. */}
      {!previewMode && !stageMode && userId && (enrolled || canEdit) && (
        <LessonAnnotations
          lessonId={lesson.id}
          canModerate={canEdit}
          aiEnabled={!previewMode}
        />
      )}
    </main>
  );

  return lessonFrame ? (
    <LessonFrameLayout
      slug={params.slug}
      lessonId={lesson.id}
      courseTitle={lesson.module.course.title}
      lessonTitle={lesson.title}
      frame={lessonFrame}
      hasExams={frameHasExams}
      levelLabel={lessonLevelLabel(languageMode)}
      notesCount={notesCount}
      tocModules={tocModules}
      videos={lessonVideos}
      preview={previewMode}
      lang={lang}
    >
      {body}
    </LessonFrameLayout>
  ) : (
    body
  );
}
