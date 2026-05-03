import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseDetail, CourseError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EnrollButton from "@/components/EnrollButton";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

export default async function CourseDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await auth();
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/catalog" className="link inline-flex items-center gap-1 text-sm">
        ← Catalog
      </Link>

      {/* Hero */}
      <header className="mt-4 overflow-hidden rounded-2xl bg-brand-gradient p-8 text-white shadow-card-hover sm:p-10">
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
          </div>
          <h1 className="mt-4 h-display text-3xl font-bold leading-tight sm:text-5xl">
            {course.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
            {course.description}
          </p>
          {course.instructors.length > 0 && (
            <p className="mt-3 text-sm text-white/80">
              <span className="opacity-70">Giảng dạy bởi</span>{" "}
              <span className="font-medium">
                {course.instructors.map((i) => i.user.displayName).join(", ")}
              </span>
            </p>
          )}

          {/* Stats */}
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroStat label="Modules" value={course.modules.length} />
            <HeroStat label="Bài học" value={totalLessons} />
          </div>

          {course.status === "published" && (
            <div className="mt-7">
              <EnrollButton slug={params.slug} alreadyEnrolled={enrolled} />
            </div>
          )}
        </div>
      </header>

      {/* Curriculum */}
      <section className="mt-10">
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
              <li key={m.id} className="card">
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
                        <p className="text-sm">{l.title}</p>
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
