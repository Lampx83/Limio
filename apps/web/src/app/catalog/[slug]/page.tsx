import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseDetail, CourseError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EnrollButton from "@/components/EnrollButton";
import EnrollNudgeAction from "@/components/EnrollNudgeAction";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { getPaymentEnabled } from "@/lib/site-settings";
import { StickyMobileCTA, UserAvatar } from "@/components/ui";
import { Trophy, Crown, Lock } from "lucide-react";

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
  searchParams?: { paywall?: string; locked?: string };
}) {
  const showPaywall = searchParams?.paywall === "1";
  // Trước đây khoá miễn phí mà chưa ghi danh thì bị đá về đây KHÔNG kèm cờ nào,
  // nên người dùng quay lại đúng trang vừa đứng và tưởng cú bấm bị nuốt mất.
  const showLocked = searchParams?.locked === "1";
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

  // Mirrors the lesson page's gate: a public course opens every lesson to anyone,
  // but only once published.
  const publiclyReadable = course.publicAccess && course.status === "published";

  // "Giảng dạy bởi" names the lead instructor(s), not everyone with edit rights —
  // co-instructors and TAs keep their access without appearing on the hero.
  const leadInstructors = course.instructors.filter((i) => i.role === "owner");

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  // Top learners (sidebar) — ưu tiên LeaderboardEntry snapshot all_time của course;
  // fallback live: tổng XP từ XpTransaction (course-scoped).
  type TopLearner = { userId: string; xp: number; rank: number; name: string; image: string | null };
  let topLearners: TopLearner[] = [];
  {
    const snapshot = await prisma.leaderboardEntry.findMany({
      where: { scope: "course", courseId: course.id, period: "all_time" },
      orderBy: { rank: "asc" },
      take: 7,
      include: { user: { select: { displayName: true, avatarUrl: true } } },
    });
    if (snapshot.length > 0) {
      topLearners = snapshot.map((s) => ({
        userId: s.userId,
        xp: s.xp,
        rank: s.rank,
        name: s.user.displayName ?? "Học viên",
        image: s.user.avatarUrl,
      }));
    } else {
      const rows = await prisma.xpTransaction.groupBy({
        by: ["userId"],
        where: { courseId: course.id },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 7,
      });
      if (rows.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: rows.map((r) => r.userId) } },
          select: { id: true, displayName: true, avatarUrl: true },
        });
        const uMap = new Map(users.map((u) => [u.id, u]));
        topLearners = rows.map((r, i) => ({
          userId: r.userId,
          xp: r._sum.amount ?? 0,
          rank: i + 1,
          name: uMap.get(r.userId)?.displayName ?? "Học viên",
          image: uMap.get(r.userId)?.avatarUrl ?? null,
        }));
      }
    }
  }

  const priceLabel =
    paymentEnabled && !isFree(course.priceCents)
      ? formatPrice(course.priceCents!, course.currency)
      : "Miễn phí";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-28 lg:pb-10">
      <Link href="/catalog" className="link inline-flex items-center gap-1 text-sm">
        ← Catalog
      </Link>

      {showLocked && (
        <div className="banner-info mt-4 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
          <Lock className="h-5 w-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold">Bạn chưa đăng ký khoá học này</p>
            <p className="text-xs">
              Đăng ký để mở toàn bộ bài học. Việc này miễn phí và chỉ mất một cú
              bấm.
            </p>
          </div>
          <a href="#dang-ky" className="btn-primary btn-sm">
            Đăng ký ngay
          </a>
        </div>
      )}

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
                slug={params.slug}
                alreadyEnrolled={enrolled}
                priceCents={course.priceCents}
                currency={course.currency}
                paymentEnabled={paymentEnabled}
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

          {!enrolled &&
            !publiclyReadable &&
            course.modules.length > 0 &&
            // invite_only không có nút đăng ký tự phục vụ nào để bấm — mời
            // "đăng ký ngay" ở đây là chỉ đường vào ngõ cụt. Khoá đó đã có
            // banner riêng "Cần link mời của lớp" phía dưới.
            course.enrollMode === "open" && (
              /* Trực quan hơn hẳn dòng chữ xám nhỏ trước đây — nói trước một
                 lần, thay vì để người ta tự suy ra từ việc bấm mà không có gì
                 xảy ra. Cùng một banner cho cả khoá miễn phí lẫn có phí: câu
                 chữ không nhắc tới giá, nên đúng cho cả hai. EnrollNudgeAction
                 tự quyết — khoá miễn phí thì bấm là ghi danh luôn; khoá có phí
                 thì bấm "Đăng ký ngay" mở ngay tại chỗ ô giá + nhập mã kích
                 hoạt, không cuộn trang xuống sidebar (sidebar còn ẩn trên
                 mobile, cuộn-tới sẽ không tới đâu cả). */
              <div className="banner-info mt-3 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
                <Lock className="h-5 w-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Bạn chưa đăng ký khoá học này
                  </p>
                  <p className="text-xs">
                    Hãy đăng ký khoá học để bắt đầu nội dung học tập ngay hôm
                    nay.
                  </p>
                </div>
                <EnrollNudgeAction
                  slug={params.slug}
                  priceCents={course.priceCents}
                  currency={course.currency}
                  paymentEnabled={paymentEnabled}
                />
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
            <div className="card">
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  Bảng xếp hạng
                </p>
                <Link
                  href={`/leaderboard?course=${course.id}`}
                  className="link text-[11px]"
                >
                  Tất cả →
                </Link>
              </div>
              {topLearners.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-token px-3 py-4 text-center text-xs text-faint">
                  Chưa có học viên nào tích lũy XP.
                </p>
              ) : (
                <ol className="mt-3 space-y-1.5 text-sm">
                  {topLearners.map((l) => {
                    const crown =
                      l.rank === 1
                        ? {
                            wrap: "h-11 w-11 bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 ring-4 ring-amber-200/70 shadow-[0_0_18px_-2px_rgba(245,158,11,0.7)] animate-pulse",
                            icon: "h-6 w-6 text-white drop-shadow-md",
                            badge: "h-4 w-4 text-[10px] bg-amber-600 text-white ring-2 ring-white",
                          }
                        : l.rank === 2
                          ? {
                              wrap: "h-9 w-9 bg-gradient-to-br from-slate-200 to-slate-400 ring-2 ring-slate-200 shadow-sm",
                              icon: "h-5 w-5 text-white drop-shadow-sm",
                              badge: "h-3.5 w-3.5 text-[9px] bg-white text-slate-700 ring-1 ring-slate-200",
                            }
                          : l.rank === 3
                            ? {
                                wrap: "h-7 w-7 bg-gradient-to-br from-orange-300 to-amber-700 ring-2 ring-orange-200 shadow-sm",
                                icon: "h-3.5 w-3.5 text-white drop-shadow-sm",
                                badge: "h-3 w-3 text-[8px] bg-white text-orange-800 ring-1 ring-orange-200",
                              }
                            : null;
                    return (
                      <li
                        key={l.userId}
                        className={`flex items-center gap-2 rounded px-1.5 ${
                          l.rank === 1 ? "py-2" : "py-1"
                        }`}
                      >
                        {/* Fixed-width rank slot — căn thẳng cột tên bất kể size vương miện */}
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                          {crown ? (
                            <span
                              className={`relative flex items-center justify-center rounded-full ${crown.wrap}`}
                              title={`Hạng ${l.rank}`}
                            >
                              <Crown
                                className={crown.icon}
                                fill="currentColor"
                                aria-hidden
                              />
                              <span
                                className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold tabular-nums ${crown.badge}`}
                              >
                                {l.rank}
                              </span>
                            </span>
                          ) : (
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-[11px] font-bold tabular-nums text-faint"
                            >
                              {l.rank}
                            </span>
                          )}
                        </span>
                        <UserAvatar
                          name={l.name}
                          imageUrl={l.image}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {l.name}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-brand-700">
                          {l.xp.toLocaleString("vi-VN")} XP
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            {course.status === "published" && (
              <div className="card scroll-mt-24" id="dang-ky">
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
                {course.enrollMode === "invite_only" && !enrolled ? (
                  /* Khoá chỉ nhận link mời: nói rõ cần gì để vào, đừng để một
                     nút bấm vào rồi báo lỗi — người học không biết hỏi ai. */
                  <div className="banner-info block rounded-xl px-4 py-3 text-sm">
                    <p className="font-medium">Khoá học này cần link mời</p>
                    <p className="mt-0.5 text-xs">
                      Giảng viên sẽ gửi link mời của lớp bạn. Mở link đó là vào
                      học được ngay.
                    </p>
                  </div>
                ) : (
                  <EnrollButton
                    slug={params.slug}
                    alreadyEnrolled={enrolled}
                    priceCents={course.priceCents}
                    currency={course.currency}
                    paymentEnabled={paymentEnabled}
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
