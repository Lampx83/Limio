import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseDetail, CourseError, isUserEnrolled, minutesOf } from "@feedbackme/core-lms";
import { getLeaderboard } from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";
import EnrollButton, { type AccessPlanOption } from "@/components/EnrollButton";
import EnrollNudgeAction from "@/components/EnrollNudgeAction";
import SafeHtml from "@/components/SafeHtml";
import CourseLeaderboardCard from "@/components/CourseLeaderboardCard";
import { htmlToPlainText, plainToRichHtml } from "@/lib/richText";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME, breadcrumbJsonLd, courseJsonLd, pageMetadata } from "@/lib/seo";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { getPaymentEnabled } from "@/lib/site-settings";
import { getConfiguredPaymentProviders } from "@/lib/paymentProviders";
import { LessonVideoBadge, StickyMobileCTA } from "@/components/ui";
import { Lock } from "lucide-react";
import { getSpaceForCourseSlug, spaceHomePath } from "@/lib/space/resolve";
import { getT, getUiLang } from "@/lib/i18n/server";
import { summarizeLessonVideos } from "@/lib/lessonVideo";
import { courseLanguageLabel, courseLevelLabel, modulePrefix } from "@/lib/courseLabels";

export const dynamic = "force-dynamic";

/**
 * Đây là trang đích cho truy vấn kiểu "khoá học <chủ đề>" nên phải tự khai
 * title/description/canonical — không thì nó thừa hưởng title chung của site và
 * mọi khoá học trông giống hệt nhau trên SERP và khi dán link vào Zalo/Facebook.
 *
 * Chỉ khoá đã publish mới được index: bản nháp chỉ chủ khoá xem được, còn với
 * khách `getCourseDetail` trả 404 — query nhẹ ở đây không include modules vì
 * `generateMetadata` chạy thêm một lần nữa ngoài page.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: {
      title: true,
      description: true,
      category: true,
      language: true,
      coverUrl: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  const t = await getT();
  if (!course) return { title: t("catalog.detail.notFound"), robots: { index: false } };

  const space = await getSpaceForCourseSlug(params.slug);
  const base = pageMetadata({
    title: course.title,
    description:
      htmlToPlainText(course.description ?? "") ||
      (course.category
        ? t("catalog.detail.metaDescriptionCat", { title: course.title, category: course.category, site: SITE_NAME })
        : t("catalog.detail.metaDescription", { title: course.title, site: SITE_NAME })),
    path: `/catalog/${params.slug}`,
    // Khoá thuộc một space: link gửi đi mang nhận diện của space (ảnh /<space>/og) thay vì ảnh Limio mặc định.
    image: space ? `${spaceHomePath(space)}/og` : course.coverUrl,
    type: "website",
    locale: course.language === "en" ? "en_US" : undefined,
    noIndex: course.status !== "published",
  });
  if (!space) return base;
  return {
    ...base,
    title: { absolute: `${course.title} | ${space.name} · ${space.titleSuffix}` },
    openGraph: { ...base.openGraph, siteName: `${space.name} × ${space.titleSuffix}` },
  };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { paywall?: string; locked?: string; cancelled?: string };
}) {
  const t = await getT();
  const lang = await getUiLang();
  const showPaywall = searchParams?.paywall === "1";
  const showCancelled = searchParams?.cancelled === "1";
  const [session, paymentEnabled, space] = await Promise.all([
    auth(),
    getPaymentEnabled(),
    getSpaceForCourseSlug(params.slug),
  ]);
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
  const [enrolled, weeklyLeaderboard, allTimeLeaderboard, accessPlans, paymentProviders] = await Promise.all([
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
    // Chỉ hỏi cổng nào đã cấu hình khi trang thật sự có nút thanh toán (bật thanh toán toàn hệ thống).
    paymentEnabled ? getConfiguredPaymentProviders().catch(() => []) : Promise.resolve([]),
  ]);

  const cheapestPlan = accessPlans[0];
  const priceLabel = !paymentEnabled
    ? t("catalog.free")
    : cheapestPlan
      ? t("catalog.from", { price: formatPrice(cheapestPlan.priceCents, cheapestPlan.currency) })
      : !isFree(course.priceCents)
        ? formatPrice(course.priceCents!, course.currency)
        : t("catalog.free");

  // Banner "chưa đăng ký" trong section Nội dung khóa học đã có đủ message +
  // action (Đăng ký ngay / liên hệ giáo viên) — sidebar không lặp lại nút nữa.
  const showEnrollNudge = !enrolled && !publiclyReadable && course.modules.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-28 lg:pb-10">
      {/* Bản nháp (chủ khoá xem trước) không khai schema: không có gì để lên SERP. */}
      {course.status === "published" && (
        <JsonLd
          data={[
            breadcrumbJsonLd([
              { name: t("catalog.home"), path: "/" },
              { name: t("catalog.courses"), path: "/catalog" },
              { name: course.title, path: `/catalog/${params.slug}` },
            ]),
            courseJsonLd({
              slug: params.slug,
              title: course.title,
              description:
                htmlToPlainText(course.description ?? "") ||
                t("catalog.detail.metaDescription", { title: course.title, site: SITE_NAME }),
              language: course.language,
              level: course.level,
              category: course.category,
              coverUrl: course.coverUrl,
              priceCents: cheapestPlan?.priceCents ?? course.priceCents,
              currency: cheapestPlan?.currency ?? course.currency,
              publishedAt: course.publishedAt,
              paymentEnabled,
              instructors: leadInstructors.map((i) => i.user.displayName),
              modules: course.modules.map((m) => m.title),
            }),
          ]}
        />
      )}
      {space ? (
        <Link href={`${spaceHomePath(space)}#courses`} className="link inline-flex items-center gap-1 text-sm">
          ← {space.name}
        </Link>
      ) : (
        <Link href="/catalog" className="link inline-flex items-center gap-1 text-sm">
          ← {t("catalog.backToCatalog")}
        </Link>
      )}

      {/* Paywall notice */}
      {showPaywall && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-5 py-4">
          <span className="text-xl"></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger-700">{t("catalog.detail.paywallTitle")}</p>
            <p className="text-xs text-danger-600">
              {t("catalog.detail.paywallBody")}
            </p>
          </div>
        </div>
      )}

      {/* Thanh toán Stripe bị huỷ giữa chừng — không phải lỗi, chỉ nhắc có thể thử lại */}
      {showCancelled && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-token bg-base-50 px-5 py-4">
          <div className="flex-1">
            <p className="text-sm font-semibold">{t("catalog.detail.cancelledTitle")}</p>
            <p className="text-xs text-muted">{t("catalog.detail.cancelledBody")}</p>
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
                {courseLevelLabel(course.level, lang)}
              </span>
            )}
            {course.category && (
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                {course.category}
              </span>
            )}
            {course.language !== "vi" && (
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                {courseLanguageLabel(course.language, lang)}
              </span>
            )}
            {course.status !== "published" && (
              <span className="inline-flex items-center rounded-full bg-accent-400/90 px-2.5 py-0.5 text-xs font-semibold text-accent-900">
                {course.status}
              </span>
            )}
            {/* Học viên chỉ cần biết khi khoá CÓ phản hồi cá nhân hoá; nhãn
                "khoá thường" không giúp họ quyết định gì. */}
            {course.personalizationEnabled && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
                title={t("catalog.personalizationHint")}
              >
                🤖 {t("catalog.personalization")}
              </span>
            )}
            {publiclyReadable && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
                title={t("catalog.detail.publicHint")}
              >
                🌐 {t("catalog.detail.public")}
              </span>
            )}
          </div>
          <h1 className="mt-4 h-display text-3xl font-bold leading-tight sm:text-5xl">
            {course.title}
          </h1>
          {leadInstructors.length > 0 && (
            <p className="mt-3 text-sm text-white/85">
              <span className="opacity-70">{t("catalog.detail.taughtBy")}</span>{" "}
              <span className="font-medium">
                {leadInstructors.map((i) => i.user.displayName).join(", ")}
              </span>
            </p>
          )}

          {/* Stats — price + enroll moved to sticky sidebar below */}
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroStat label={t("catalog.detail.statModules")} value={course.modules.length} />
            <HeroStat label={t("catalog.detail.statLessons")} value={totalLessons} />
            {paymentEnabled && (
              <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
                <div className="text-xs uppercase tracking-wide opacity-70">{t("catalog.detail.tuition")}</div>
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
            {t("catalog.detail.about")}
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
              ? t("catalog.detail.alreadyEnrolled")
              : t("catalog.detail.moduleLessonCount", { modules: course.modules.length, lessons: totalLessons })
          }
          action={
            course.enrollMode === "invite_only" && !enrolled ? (
              <span className="text-sm text-muted">{t("catalog.detail.inviteNeeded")}</span>
            ) : (
              <EnrollButton
                courseId={course.id}
                slug={params.slug}
                alreadyEnrolled={enrolled}
                priceCents={course.priceCents}
                currency={course.currency}
                paymentEnabled={paymentEnabled}
                accessPlans={accessPlans}
                paymentProviders={paymentProviders}
              />
            )
          }
        />
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Curriculum — main column */}
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{t("catalog.detail.curriculum")}</h2>
            <span className="text-xs text-faint">
              {t("catalog.detail.moduleLessonCount", { modules: course.modules.length, lessons: totalLessons })}
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
                  {t("catalog.detail.notEnrolledTitle")}
                </p>
                {course.enrollMode === "invite_only" ? (
                  // invite_only không có nút đăng ký tự phục vụ nào để bấm —
                  // nói luôn cần gì ở đây thay vì mời bấm vào ngõ cụt.
                  <p className="text-xs">
                    {t("catalog.detail.contactTeacher")}
                  </p>
                ) : (
                  <p className="text-xs">
                    {t("catalog.detail.enrollToStart")}
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
                  paymentProviders={paymentProviders}
                />
              )}
            </div>
          )}

          {course.modules.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-token p-10 text-center text-sm text-muted">
              {t("catalog.detail.noContent")}
            </div>
          ) : (
            <ol className="mt-4 space-y-4">
              {course.modules.map((m, mi) => {
                const prefix = modulePrefix(m.title, mi);
                return (
                <li key={m.id} id={`module-${m.id}`} className="card">
                <header className="flex items-baseline justify-between gap-3 border-b border-token pb-3">
                  <h3 className="text-base font-semibold">
                    {prefix && <span className="mr-2 text-faint">{prefix}</span>}
                    {m.title}
                  </h3>
                  <span className="text-xs text-faint">
                    {t("catalog.detail.lessonCount", { n: m.lessons.length })}
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
                              title={t("catalog.detail.lockedLesson")}
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
                              {t("catalog.detail.preview")}
                            </span>
                          )}
                          {(() => {
                            // Surface which lessons carry a lecture video, and how
                            // long it runs — otherwise the list gives no hint that
                            // some entries are 45 minutes of video and others a read.
                            // getCourseDetail already returns only visible video items.
                            const v = summarizeLessonVideos(
                              l.contentItems.map((c) => ({ lessonId: l.id, payload: c.payload })),
                            ).get(l.id);
                            if (!v) return null;
                            const mins = minutesOf(v.durationSec);
                            return (
                              <LessonVideoBadge
                                label={t("learn.video.has")}
                                duration={mins ? t("learn.minutes", { n: mins }) : null}
                              />
                            );
                          })()}
                        </div>
                        {l.skillTags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {/* Learners see the skill's human name; the code is
                                an internal identifier and reads as noise here. */}
                            {l.skillTags.map((tag) => (
                              <span
                                key={tag.skill.code}
                                title={tag.skill.code}
                                className="inline-flex rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[11px] text-faint"
                              >
                                {tag.skill.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Sidebar TOC */}
        <aside className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
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
                        {t("catalog.detail.tuition")}
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
                      paymentProviders={paymentProviders}
                    />
                  )}
                </div>
              )}
            {/* Bảng xếp hạng đứng SAU thẻ đăng ký: học viên chưa ghi danh phải thấy nút vào học trước, không phải cuộn qua bảng. */}
            <CourseLeaderboardCard
              courseId={course.id}
              weekly={weeklyLeaderboard}
              allTime={allTimeLeaderboard}
            />
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
