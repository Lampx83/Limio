import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseDetail, CourseError, isUserEnrolled } from "@feedbackme/core-lms";
import { getLeaderboard } from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import EnrollButton, { type AccessPlanOption } from "@/components/EnrollButton";
import EnrollNudgeAction from "@/components/EnrollNudgeAction";
import SafeHtml from "@/components/SafeHtml";
import CourseLeaderboardCard from "@/components/CourseLeaderboardCard";
import { plainToRichHtml } from "@/lib/richText";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { getPaymentEnabled } from "@/lib/site-settings";
import { StickyMobileCTA } from "@/components/ui";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { paywall?: string; locked?: string; cancelled?: string };
}) {
  const showPaywall = searchParams?.paywall === "1";
  const showCancelled = searchParams?.cancelled === "1";
  const [session, paymentEnabled] = await Promise.all([auth(), getPaymentEnabled()]);
  let course;
  try {
    course = await getCourseDetail(params.slug, session?.user?.id ?? null);
  } catch (e) {
    if (e instanceof CourseError && e.code === "not_found") notFound();
    throw e;
  }

  // Mirrors the lesson page's gate: a public course opens every lesson to anyone,
  // but only once published.
  const publiclyReadable = course.publicAccess && course.status === "published";

  // "Giảng dạy bởi" names the lead instructor(s), not everyone with edit rights —
  // co-instructors and TAs keep their access without appearing on the hero.
  const leadInstructors = course.instructors.filter((i) => i.role === "owner");

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  // Enrollment check + weekly/all-time leaderboard đều chỉ cần course.id/session,
  // không phụ thuộc nhau — chạy song song thay vì nối đuôi để rút ngắn thời gian
  // loading.tsx hiển thị khi chuyển trang từ catalog.
  const [enrolled, weeklyLeaderboard, allTimeLeaderboard, accessPlans] = await Promise.all([
    session?.user?.id ? isUserEnrolled(session.user.id, course.id) : Promise.resolve(false),
    getLeaderboard({
      scope: "course",
      period: "weekly",
      courseId: course.id,
      viewerId: session?.user?.id ?? null,
      limit: 8,
    }),
    getLeaderboard({
      scope: "course",
      period: "all_time",
      courseId: course.id,
      viewerId: session?.user?.id ?? null,
      limit: 8,
    }),
    paymentEnabled
      ? prisma.courseAccessPlan.findMany({
          where: { courseId: course.id, isActive: true },
          orderBy: { priceCents: "asc" },
          select: { id: true, label: true, durationMonths: true, priceCents: true, currency: true },
        })
      : Promise.resolve([] as AccessPlanOption[]),
  ]);

  const cheapestPlan = accessPlans[0];
  const priceLabel = !paymentEnabled
    ? "Miễn phí"
    : cheapestPlan
      ? `Từ ${formatPrice(cheapestPlan.priceCents, cheapestPlan.currency)}`
      : !isFree(course.priceCents)
        ? formatPrice(course.priceCents!, course.currency)
        : "Miễn phí";

  // Banner "chưa đăng ký" trong section Nội dung khóa học đã có đủ message +
  // action (Đăng ký ngay / liên hệ giáo viên) — sidebar không lặp lại nút nữa.
  const showEnrollNudge = !enrolled && !publiclyReadable && course.modules.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-28 lg:pb-10">
      <Link href="/catalog" className="link inline-flex items-center gap-1 text-sm">
        ← Catalog
      </Link>

      {/* Paywall notice */}
      {showPaywall && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-5 py-4">
          <span className="text-xl"></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger-700">Nội dung có phí</p>
            <p className="text-xs text-danger-600">
              Bài học này yêu cầu đăng ký khoá học. Mua khoá để truy cập toàn bộ nội dung.
            </p>
          </div>
        </div>
      )}

      {/* Thanh toán Stripe bị huỷ giữa chừng — không phải lỗi, chỉ nhắc có thể thử lại */}
      {showCancelled && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-token bg-base-50 px-5 py-4">
          <div className="flex-1">
            <p className="text-sm font-semibold">Thanh toán đã huỷ</p>
            <p className="text-xs text-muted">Bạn có thể chọn lại gói và thử thanh toán bất cứ lúc nào.</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <header className="relative mt-4 overflow-hidden rounded-2xl bg-brand-gradient p-8 text-white shadow-card-hover sm:p-10">
        <div className="absolute inset-0 bg-hero-grid opacity-20" style={{ backgroundSize: "20px 20px" }} aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            {course.level && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                {LEVEL_LABEL[course.level] ?? course.level}
              </span>
            )}
            {course.category && (
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                {course.category}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide backdrop-blur">
              {course.language}
            </span>
            {course.status !== "published" && (
              <span className="inline-flex items-center rounded-full bg-accent-400/90 px-2.5 py-0.5 text-xs font-semibold text-accent-900">
                {course.status}
              </span>
            )}
            {course.personalizationEnabled ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
                title="Course có AI feedback theo skill: BKT, diagnostic, adaptive path, skill badge"
              >
                🤖 AI Feedback
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur"
                title="LMS truyền thống — không AI feedback"
              >
                📚 Standard LMS
              </span>
            )}
            {publiclyReadable && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
                title="Đọc được nội dung bài học mà không cần đăng nhập. Đăng ký để lưu tiến độ, làm bài và nhận phản hồi."
              >
                🌐 Công khai
              </span>
            )}
          </div>
          <h1 className="mt-4 h-display text-3xl font-bold leading-tight sm:text-5xl">
            {course.title}
          </h1>
          {leadInstructors.length > 0 && (
            <p className="mt-3 text-sm text-white/85">
              <span className="opacity-70">Giảng dạy bởi</span>{" "}
              <span className="font-medium">
                {leadInstructors.map((i) => i.user.displayName).join(", ")}
              </span>
            </p>
          )}

          {/* Stats — price + enroll moved to sticky sidebar below */}
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroStat label="Modules" value={course.modules.length} />
            <HeroStat label="Bài học" value={totalLessons} />
            {paymentEnabled && (
              <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
                <div className="text-xs uppercase tracking-wide opacity-70">Học phí</div>
                <div className="text-lg font-bold tabular-nums">{priceLabel}</div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Mô tả khóa học — tách khỏi hero gradient cho dễ đọc */}
      {course.description?.trim() && (
        <section className="card mt-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
            Về khóa học
          </div>
          <SafeHtml
            html={plainToRichHtml(course.description)}
            className="prose max-w-none text-base leading-relaxed text-token"
          />
        </section>
      )}

      {/* Sticky mobile CTA — desktop dùng sidebar */}
      {course.status === "published" && (
        <StickyMobileCTA
          primary={paymentEnabled ? priceLabel : course.title}
          secondary={
            enrolled
              ? "Bạn đã đăng ký"
              : `${course.modules.length} modules · ${totalLessons} bài`
          }
          action={
            course.enrollMode === "invite_only" && !enrolled ? (
              <span className="text-sm text-muted">Cần link mời của lớp</span>
            ) : (
              <EnrollButton
                courseId={course.id}
                slug={params.slug}
                alreadyEnrolled={enrolled}
                priceCents={course.priceCents}
                currency={course.currency}
                paymentEnabled={paymentEnabled}
                accessPlans={accessPlans}
              />
            )
          }
        />
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Curriculum — main column */}
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Nội dung khóa học</h2>
            <span className="text-xs text-faint">
              {course.modules.length} modules · {totalLessons} bài
            </span>
          </div>

          {showEnrollNudge && (
            /* Trực quan hơn hẳn dòng chữ xám nhỏ trước đây — nói trước một
               lần, thay vì để người ta tự suy ra từ việc bấm mà không có gì
               xảy ra. Banner "chưa đăng ký" gộp về đây thay vì nằm riêng ở
               đầu trang — một chỗ duy nhất, không lặp/mâu thuẫn với sidebar. */
            <div className="banner-info mt-3 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
              <Lock className="h-5 w-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Bạn chưa đăng ký khoá học này
                </p>
                {course.enrollMode === "invite_only" ? (
                  // invite_only không có nút đăng ký tự phục vụ nào để bấm —
                  // nói luôn cần gì ở đây thay vì mời bấm vào ngõ cụt.
                  <p className="text-xs">
                    Hãy liên hệ giáo viên để lấy link vào khoá học.
                  </p>
                ) : (
                  <p className="text-xs">
                    Hãy đăng ký khoá học để bắt đầu nội dung học tập ngay hôm
                    nay.
                  </p>
                )}
              </div>
              {course.enrollMode !== "invite_only" && (
                // Cùng một banner cho cả khoá miễn phí lẫn có phí: câu chữ
                // không nhắc tới giá, nên đúng cho cả hai. EnrollNudgeAction tự
                // quyết — khoá miễn phí thì bấm là ghi danh luôn; khoá có phí
                // thì bấm "Đăng ký ngay" mở ngay tại chỗ ô giá + nhập mã kích
                // hoạt, không cuộn trang xuống sidebar (sidebar còn ẩn trên
                // mobile, cuộn-tới sẽ không tới đâu cả).
                <EnrollNudgeAction
                  courseId={course.id}
                  slug={params.slug}
                  priceCents={course.priceCents}
                  currency={course.currency}
                  paymentEnabled={paymentEnabled}
                  accessPlans={accessPlans}
                />
              )}
            </div>
          )}

          {course.modules.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-token p-10 text-center text-sm text-muted">
              Chưa có nội dung.
            </div>
          ) : (
            <ol className="mt-4 space-y-4">
              {course.modules.map((m) => (
                <li key={m.id} id={`module-${m.id}`} className="card">
                <header className="flex items-baseline justify-between gap-3 border-b border-token pb-3">
                  <h3 className="text-base font-semibold">
                    <span className="mr-2 text-faint">Module</span>
                    {m.title}
                  </h3>
                  <span className="text-xs text-faint">
                    {m.lessons.length} bài
                  </span>
                </header>
                <ol className="mt-3 space-y-2">
                  {m.lessons.map((l, li) => (
                    <li
                      key={l.id}
                      className="flex items-start gap-3 rounded-lg px-2 py-1.5"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-700 tabular-nums">
                        {li + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Anyone who can actually open the lesson gets a link.
                              Enrolled learners used to be excluded here, which left
                              them no way into a lesson from this page at all. */}
                          {enrolled || publiclyReadable || l.previewable ? (
                            <Link
                              href={`/learn/${params.slug}/lessons/${l.id}`}
                              className="text-sm font-medium text-brand-600 hover:underline"
                              prefetch={false}
                            >
                              {l.title}
                            </Link>
                          ) : (
                            /* Không để tên bài trơ ra như chữ chết: bấm vào là
                               cuộn xuống ô đăng ký, kèm ổ khoá để biết vì sao
                               nó không mở ra bài. */
                            <a
                              href="#dang-ky"
                              title="Đăng ký khoá học để mở bài này"
                              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-default"
                            >
                              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {l.title}
                            </a>
                          )}
                          {/* A per-lesson "Preview" pill would be noise on a course
                              where every lesson is open — the hero chip says it once. */}
                          {l.previewable && !publiclyReadable && !enrolled && (
                            <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                              Preview
                            </span>
                          )}
                          {(() => {
                            // Surface which lessons carry a lecture video, and how
                            // long it runs — otherwise the list gives no hint that
                            // some entries are 45 minutes of video and others a read.
                            const v = l.contentItems.find((c) => c.type === "video");
                            if (!v) return null;
                            const secs = (v.payload as { durationSec?: number } | null)
                              ?.durationSec;
                            const mins = secs ? Math.round(secs / 60) : null;
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                                ▶ Video{mins ? ` · ${mins} phút` : ""}
                              </span>
                            );
                          })()}
                        </div>
                        {l.skillTags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {/* Learners see the skill's human name; the code is
                                an internal identifier and reads as noise here. */}
                            {l.skillTags.map((t) => (
                              <span
                                key={t.skill.code}
                                title={t.skill.code}
                                className="inline-flex rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[11px] text-faint"
                              >
                                {t.skill.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Sidebar TOC */}
        <aside className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <CourseLeaderboardCard
              courseId={course.id}
              weekly={weeklyLeaderboard}
              allTime={allTimeLeaderboard}
            />
            {course.status === "published" &&
              // Banner "chưa đăng ký"/"liên hệ giáo viên" ở section Nội dung
              // khóa học đã đủ message + action rồi — không lặp lại nút ở
              // đây. Card này chỉ còn lý do tồn tại khi có gì để hiện: học
              // phí, hoặc nút đăng ký (đã enrolled, hoặc chưa có nudge ở trên).
              ((paymentEnabled && (accessPlans.length > 0 || !isFree(course.priceCents))) ||
                !showEnrollNudge) && (
                <div className="card scroll-mt-24" id="dang-ky">
                  {/* Có accessPlans: EnrollButton tự hiện giá từng gói trong
                      picker — flat "Học phí" ở đây sẽ trùng lặp/gây hiểu nhầm
                      là chỉ có 1 mức giá. */}
                  {paymentEnabled && accessPlans.length === 0 && !isFree(course.priceCents) && (
                    <div className="mb-3">
                      <div className="text-xs uppercase tracking-wide text-faint">
                        Học phí
                      </div>
                      <div className="text-2xl font-bold tabular-nums">
                        {formatPrice(course.priceCents!, course.currency)}
                      </div>
                    </div>
                  )}
                  {!showEnrollNudge && (
                    <EnrollButton
                      courseId={course.id}
                      slug={params.slug}
                      alreadyEnrolled={enrolled}
                      priceCents={course.priceCents}
                      currency={course.currency}
                      paymentEnabled={paymentEnabled}
                      accessPlans={accessPlans}
                    />
                  )}
                </div>
              )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
