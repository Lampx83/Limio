import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseDetail, CourseError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EnrollButton from "@/components/EnrollButton";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { getPaymentEnabled } from "@/lib/site-settings";
import { StickyMobileCTA } from "@/components/ui";

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
  searchParams?: { paywall?: string };
}) {
  const showPaywall = searchParams?.paywall === "1";
  const [session, paymentEnabled] = await Promise.all([auth(), getPaymentEnabled()]);
  let course;
  try {
    course = await getCourseDetail(params.slug, session?.user?.id ?? null);
  } catch (e) {
    if (e instanceof CourseError && e.code === "not_found") notFound();
    throw e;
  }

  let enrolled = false;
  if (session?.user?.id) {
    const e = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
      select: { id: true, status: true },
    });
    enrolled = e !== null && e.status !== "dropped" && e.status !== "refunded";
  }

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  const priceLabel =
    paymentEnabled && !isFree(course.priceCents)
      ? formatPrice(course.priceCents!, course.currency)
      : "Miễn phí";

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
          </div>
          <h1 className="mt-4 h-display text-3xl font-bold leading-tight sm:text-5xl">
            {course.title}
          </h1>
          <SafeHtml
            html={plainToRichHtml(course.description)}
            className="prose prose-invert mt-4 max-w-2xl text-base text-white/90 sm:text-lg"
          />
          {course.instructors.length > 0 && (
            <p className="mt-3 text-sm text-white/80">
              <span className="opacity-70">Giảng dạy bởi</span>{" "}
              <span className="font-medium">
                {course.instructors.map((i) => i.user.displayName).join(", ")}
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
            <EnrollButton
              slug={params.slug}
              alreadyEnrolled={enrolled}
              priceCents={course.priceCents}
              currency={course.currency}
              paymentEnabled={paymentEnabled}
            />
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

          {course.modules.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-token p-10 text-center text-sm text-muted">
              Chưa có nội dung.
            </div>
          ) : (
            <ol className="mt-4 space-y-4">
              {course.modules.map((m, mi) => (
                <li key={m.id} id={`module-${m.id}`} className="card">
                <header className="flex items-baseline justify-between gap-3 border-b border-token pb-3">
                  <h3 className="text-base font-semibold">
                    <span className="mr-2 text-faint">Module {mi + 1}</span>
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
                          {l.previewable && !enrolled ? (
                            <Link
                              href={`/learn/${params.slug}/lessons/${l.id}`}
                              className="text-sm font-medium text-brand-600 hover:underline"
                            >
                              {l.title}
                            </Link>
                          ) : (
                            <p className="text-sm">{l.title}</p>
                          )}
                          {l.previewable && !enrolled && (
                            <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                              Preview
                            </span>
                          )}
                        </div>
                        {l.skillTags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {l.skillTags.map((t) => (
                              <span
                                key={t.skill.code}
                                className="inline-flex rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-mono text-[11px] text-faint"
                              >
                                {t.skill.code}
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
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Tổng quan
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {course.modules.map((m, mi) => (
                  <li key={m.id}>
                    <a
                      href={`#module-${m.id}`}
                      className="flex items-baseline justify-between gap-2 rounded px-2 py-1 hover:bg-brand-soft hover:text-brand-700"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-1 text-faint">{mi + 1}.</span>
                        {m.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">
                        {m.lessons.length} bài
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {course.status === "published" && (
              <div className="card">
                {paymentEnabled && !isFree(course.priceCents) && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-faint">
                      Học phí
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {formatPrice(course.priceCents!, course.currency)}
                    </div>
                  </div>
                )}
                <EnrollButton
                  slug={params.slug}
                  alreadyEnrolled={enrolled}
                  priceCents={course.priceCents}
                  currency={course.currency}
                  paymentEnabled={paymentEnabled}
                />
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
