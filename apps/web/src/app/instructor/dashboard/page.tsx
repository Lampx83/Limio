import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { listSampleCourses, userIsAnyProctor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { hourVN } from "@/lib/datetime";
import FeatureBlockedToast from "@/components/FeatureBlockedToast";
import HelpTour from "@/components/HelpTour";
import { INSTRUCTOR_TOUR_STEPS, hasSeenHelpTour, type HelpTourCompletionMap } from "@/lib/helpTour";
import {
  INSTRUCTOR_MENU_TOGGLE_EVENT,
  INSTRUCTOR_MENU_PREVIEW_EVENT,
} from "@/components/InstructorLeftMenu";
import InstructorHomeSearch, { type SearchSuggestion } from "@/components/InstructorHomeSearch";
import HomeStatusLine from "@/components/HomeStatusLine";
import { getInstructorPendingSummary } from "@/lib/notifications";
import { isTeachingOnly } from "@/lib/roleWorkspace";
import CenterTeacherHome from "@/components/CenterTeacherHome";

export const dynamic = "force-dynamic";

const COURSES_SHOWN = 3;

function greeting(): string {
  const h = hourVN();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Lối tắt tạo mới dưới ô tìm kiếm: chữ thường, không nhãn bo tròn. */
const MAKE_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Tạo slide", href: "/instructor/limio-live/from-document" },
  { label: "Tạo đề thi", href: "/instructor/exams/new" },
  { label: "Tạo khoá học", href: "/instructor/courses/new" },
  { label: "Hoạt động trên lớp", href: "/instructor/teaching-tools" },
];

export default async function InstructorDashboard({
  searchParams,
}: {
  searchParams: { tour?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/dashboard");
  const userId = session.user.id;

  // Giảng viên trung tâm (chỉ dạy): trang chủ riêng "Hôm nay tôi dạy", không có lối tắt soạn.
  if (isTeachingOnly(session.user.roles ?? [])) {
    return <CenterTeacherHome userId={userId} displayName={session.user.name ?? null} />;
  }

  const meTour = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { helpTourCompletedByRole: true },
  });
  const shouldShowTour =
    searchParams?.tour === "1" ||
    !hasSeenHelpTour(meTour.helpTourCompletedByRole as HelpTourCompletionMap | null, "instructor");

  // Proctor-only users (no CourseInstructor binding) land here when they
  // first log in; redirect them straight to their rooms to skip the empty
  // instructor dashboard.
  const isInstructor = await prisma.courseInstructor.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!isInstructor && (await userIsAnyProctor(userId))) {
    redirect("/instructor/my-rooms");
  }

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const name = session.user.name ?? session.user.email ?? "";
  const makeSuggestion: SearchSuggestion = {
    id: "make-slide",
    title: "Tạo slide mới",
    href: "/instructor/limio-live/from-document",
  };

  if (ownedCourses.length === 0) {
    // Khoá mẫu do admin đánh dấu: cho giảng viên mới xem một khoá dựng xong trông thế nào.
    const sampleCourses = await listSampleCourses();
    return (
      <main className="relative">
        <Glow />
        <div className="mx-auto max-w-3xl">
          <Hero greeting={greeting()} name={name} suggestions={[makeSuggestion]} />
          {/* Cùng ngôn ngữ với thẻ khoá học khi đã có khoá: góc bo 22px, viền và bóng nhẹ, ô biểu tượng chuyển màu lime → hồng
              như tên trong lời chào, nút bo tròn cao bằng ô tìm kiếm. */}
          <section
            aria-labelledby="first-course-heading"
            className="mx-auto mt-12 max-w-xl rounded-[22px] border border-token bg-[rgb(var(--surface))] px-6 py-8 text-center shadow-[0_6px_20px_-10px_rgb(29_36_23/0.14)] sm:px-10 sm:py-10"
          >
            <span
              aria-hidden
              className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-pink-100 text-brand-700 dark:from-brand-900/50 dark:to-pink-900/40 dark:text-brand-300"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15Z" />
                <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z" />
              </svg>
            </span>
            <h2 id="first-course-heading" className="mt-4 text-[1.15rem] font-semibold tracking-[-0.015em]">
              Thầy/cô chưa có khoá học nào
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[0.95rem] leading-relaxed text-muted">
              Tạo khoá đầu tiên để thêm bài học, giao bài và mời học viên vào lớp.
            </p>
            <Link
              href="/instructor/courses/new"
              prefetch={false}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-brand-600 px-7 text-[0.95rem] font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand-700 hover:shadow-brand-glow active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              + Tạo khoá đầu tiên
            </Link>
          </section>
          {sampleCourses.length > 0 && (
            <section className="mx-auto mt-12 max-w-2xl" aria-labelledby="sample-courses-heading">
              <header className="mx-1">
                <h2 id="sample-courses-heading" className="text-base font-semibold">
                  Xem khoá mẫu
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  Xem một khoá đã dựng xong trông thế nào trước khi tạo khoá của thầy/cô.
                </p>
              </header>
              <ul className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
                {sampleCourses.map((c) => (
                  <li key={c.id} className="min-w-0">
                    <Link
                      href={`/catalog/${c.slug}`}
                      className="block h-full rounded-[22px] border border-token bg-[rgb(var(--surface))] p-4 shadow-[0_6px_20px_-10px_rgb(29_36_23/0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgb(29_36_23/0.24)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <span className="line-clamp-2 block text-[0.95rem] font-semibold leading-snug tracking-[-0.01em]">{c.title}</span>
                      <span className="mt-1.5 line-clamp-2 block text-sm text-muted">
                        {c.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                      </span>
                      <span className="mt-3 block text-[0.8125rem] font-medium text-brand-700">Xem khoá →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        {/* Chưa có khoá thì lịch không có gì để hiện (nó chỉ liệt kê hạn nộp của các khoá mình dạy). */}
        {shouldShowTour && (
          <HelpTour
            steps={INSTRUCTOR_TOUR_STEPS}
            role="instructor"
            initiallyOpen
            mobileMenuToggleEvent={INSTRUCTOR_MENU_TOGGLE_EVENT}
            moduleRevealEvent={INSTRUCTOR_MENU_PREVIEW_EVENT}
          />
        )}
      </main>
    );
  }

  const shownCourses = ownedCourses.slice(0, COURSES_SHOWN);
  const pending = await getInstructorPendingSummary(userId);

  // Gợi ý khi ô tìm kiếm còn trống: việc hay làm nhất và khoá vừa sửa.
  const suggestions: SearchSuggestion[] = [makeSuggestion];
  const latest = ownedCourses[0]!;
  suggestions.push({ id: "latest-course", title: `Mở lại ${latest.title}`, meta: "Khoá gần nhất", href: `/instructor/courses/${latest.id}` });

  return (
    <main className="relative">
      <Glow />
      <Suspense fallback={null}>
        <FeatureBlockedToast />
      </Suspense>

      {/* Một cột hẹp, nhiều khoảng trắng. Việc đang chờ nằm trong chuông thông báo, lịch ở nút lịch trên thanh đầu
          trang: không chiếm chỗ ở đây cho trang thoáng. */}
      <div className="mx-auto max-w-2xl">
        <Hero greeting={greeting()} name={name} suggestions={suggestions} status={pending} />

        <section className="mt-10 sm:mt-[clamp(1rem,4vh,3rem)]" aria-labelledby="my-courses-heading">
          <header className="mx-1 flex items-baseline justify-between">
            <h2 id="my-courses-heading" className="text-base font-semibold">Khoá học gần đây</h2>
            <Link href="/instructor/courses" prefetch={false} className="text-sm text-muted transition-colors hover:text-brand-700">
              {ownedCourses.length > shownCourses.length ? `Tất cả khoá học (${ownedCourses.length})` : "Quản lý khoá học"}
            </Link>
          </header>
          <ul className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {shownCourses.map((c, i) => {
              const published = c.status !== "draft";
              return (
                <li key={c.id} className="min-w-0">
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    prefetch={false}
                    className="block h-full rounded-[22px] border border-token bg-[rgb(var(--surface))] p-4 shadow-[0_6px_20px_-10px_rgb(29_36_23/0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgb(29_36_23/0.24)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span
                      className={`mb-3 grid h-9 w-9 place-items-center rounded-xl text-xs font-bold ${
                        !published
                          ? "bg-[rgb(var(--surface-muted))] text-faint"
                          : i % 2 === 0
                            ? "bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 dark:from-brand-900/50 dark:to-brand-900/20 dark:text-brand-300"
                            : "bg-gradient-to-br from-pink-100 to-pink-50 text-pink-700 dark:from-pink-900/40 dark:to-pink-900/20 dark:text-pink-300"
                      }`}
                      aria-hidden
                    >
                      {initials(c.title)}
                    </span>
                    <span className="line-clamp-2 block text-[0.95rem] font-semibold leading-snug tracking-[-0.01em]">{c.title}</span>
                    <span className="mt-2.5 flex items-center gap-1.5 text-[0.8125rem] tabular-nums text-muted">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${published ? "bg-brand-500" : "bg-slate-300"}`} aria-hidden />
                      {published ? "Đang mở" : "Nháp"} · {c._count.enrollments} học viên
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {shouldShowTour && (
        <HelpTour
          steps={INSTRUCTOR_TOUR_STEPS}
          role="instructor"
          initiallyOpen
          mobileMenuToggleEvent={INSTRUCTOR_MENU_TOGGLE_EVENT}
          moduleRevealEvent={INSTRUCTOR_MENU_PREVIEW_EVENT}
        />
      )}
    </main>
  );
}

/**
 * Nền giống phần đầu trang giới thiệu trước khi đăng nhập (LandingPage > Hero): lưới chấm lime mờ, quầng lime ở bên trái,
 * quầng hồng ở bên phải, quầng hổ phách nhạt ở giữa dưới. Phủ hết bề ngang cửa sổ (cố định theo cửa sổ, nằm dưới thanh đầu
 * trang; menu trái có nền riêng nên đè lên), không bị gói trong khung nội dung nên hai mép không có đường cắt. Mờ dần xuống
 * dưới. Chế độ tối giảm độ đậm.
 */
function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[4.6rem] -z-10 h-[620px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)] dark:opacity-30"
    >
      <div className="absolute inset-0 bg-hero-grid opacity-40" style={{ backgroundSize: "24px 24px" }} />
      {/* Lime trội hơn hồng: hai quầng lime (lớn) so với một quầng hồng nhỏ hơn, nhạt hơn ở bên phải. */}
      <div className="absolute -top-24 left-[8%] h-[30rem] w-[30rem] rounded-full bg-brand-200/55 blur-3xl" />
      <div className="absolute left-[28%] top-16 h-80 w-[34rem] rounded-full bg-brand-100/80 blur-3xl" />
      <div className="absolute right-[6%] top-16 h-80 w-80 rounded-full bg-pink-100/70 blur-3xl" />
      <div className="absolute bottom-24 left-1/2 h-64 w-64 rounded-full bg-amber-50/60 blur-3xl" />
    </div>
  );
}

/** Chữ cái đầu của hai từ đầu tiên trong tên khoá, cho ô biểu tượng ở thẻ khoá học. */
function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
}

/** Lời chào, ô tìm kiếm và lối tắt tạo mới, đặt cao hơn giữa trang một chút (như trang chủ Google). */
function Hero({
  greeting,
  name,
  suggestions,
  status,
}: {
  greeting: string;
  name: string;
  suggestions: SearchSuggestion[];
  /** Tóm tắt việc đang chờ; vắng thì không hiện dòng trạng thái (giảng viên chưa có khoá). */
  status?: { grading: number; sessions: number; staleLearners: number };
}) {
  return (
    <header className="pt-6 text-center sm:pt-[clamp(0rem,3vh,2rem)]">
      {/* Một dòng: cỡ chữ co theo bề rộng màn hình để lời chào và tên vừa một dòng; tên quá dài mới xuống dòng (được cân đều). */}
      <h1 className={`text-balance text-[clamp(1.2rem,4.6vw,2rem)] font-semibold leading-[1.25] tracking-[-0.025em]`}>
        {greeting}, <span className="bg-[linear-gradient(110deg,#4d7c0f_0%,#65a30d_45%,#db2777_100%)] bg-clip-text font-bold text-transparent">{name}</span>
      </h1>
      <p className={`mt-3 text-[1.05rem] text-muted`}>
        Thầy/cô muốn tìm gì, hoặc làm gì hôm nay?
      </p>
      {/* relative z-20: các khối cùng cấp bên dưới cũng có hoạt ảnh (tạo lớp xếp chồng riêng), không có z-index ở đây thì chúng đè lên danh sách gợi ý. */}
      <div className={`relative z-20 mt-7`}>
        <InstructorHomeSearch suggestions={suggestions} />
      </div>
      <nav aria-label="Tạo mới" className={`mt-5 flex flex-wrap justify-center gap-x-7 gap-y-2 text-[0.95rem] text-muted`}>
        {MAKE_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            className="py-1 transition-colors before:mr-1.5 before:font-semibold before:text-brand-500 before:content-['+'] hover:text-brand-700"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {status && (
        <div className={`mt-3`}>
          <HomeStatusLine {...status} />
        </div>
      )}
    </header>
  );
}
