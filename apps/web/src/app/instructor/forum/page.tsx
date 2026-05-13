import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STALE_HOURS = 48;

export default async function InstructorForumHubPage({
  searchParams,
}: {
  searchParams?: { course?: string; status?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/forum");
  }
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });
  if (ownedCourses.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="h-display text-3xl font-bold">Forum Q&amp;A</h1>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm">
          Bạn chưa là instructor của khoá nào.
        </div>
      </main>
    );
  }

  const courseFilter =
    searchParams?.course &&
    ownedCourses.some((c) => c.id === searchParams.course)
      ? searchParams.course
      : null;
  const status =
    searchParams?.status === "resolved" ||
    searchParams?.status === "unresolved" ||
    searchParams?.status === "stale"
      ? searchParams.status
      : "all";

  const courseIds = courseFilter ? [courseFilter] : ownedCourses.map((c) => c.id);
  const staleCutoff = new Date(Date.now() - STALE_HOURS * 3600 * 1000);

  const baseWhere = {
    lesson: { module: { courseId: { in: courseIds } } },
  };

  const [allThreadsForStats, threads] = await Promise.all([
    prisma.forumThread.findMany({
      where: baseWhere,
      select: {
        id: true,
        resolvedPostId: true,
        createdAt: true,
        _count: { select: { posts: true } },
      },
    }),
    prisma.forumThread.findMany({
      where: {
        ...baseWhere,
        ...(status === "resolved"
          ? { resolvedPostId: { not: null } }
          : status === "unresolved"
            ? { resolvedPostId: null }
            : status === "stale"
              ? { resolvedPostId: null, createdAt: { lt: staleCutoff } }
              : {}),
      },
      orderBy: [{ resolvedPostId: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        resolvedPostId: true,
        author: { select: { displayName: true } },
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                title: true,
                course: { select: { id: true, title: true, slug: true } },
              },
            },
          },
        },
        _count: { select: { posts: true } },
      },
    }),
  ]);

  const totalThreads = allThreadsForStats.length;
  const unresolved = allThreadsForStats.filter((t) => !t.resolvedPostId).length;
  const resolved = totalThreads - unresolved;
  const stale = allThreadsForStats.filter(
    (t) => !t.resolvedPostId && t.createdAt < staleCutoff,
  ).length;

  const filterHref = (next: {
    course?: string | null;
    status?: string;
  }) => {
    const params = new URLSearchParams();
    const c = next.course === undefined ? courseFilter : next.course;
    if (c) params.set("course", c);
    const s = next.status ?? status;
    if (s && s !== "all") params.set("status", s);
    const qs = params.toString();
    return `/instructor/forum${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="h-display text-3xl font-bold sm:text-4xl">
          Forum Q&amp;A
        </h1>
        <p className="mt-2 text-muted">
          Thread hỏi-đáp của học viên gắn theo từng bài học. Đánh dấu một reply là
          &ldquo;resolved&rdquo; để chốt đáp án.
        </p>
      </header>

      {/* KPI cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi label="Tổng thread" value={totalThreads} tone="brand" />
        <Kpi
          label="Chưa giải đáp"
          value={unresolved}
          tone={unresolved > 0 ? "accent" : "success"}
        />
        <Kpi label="Đã resolved" value={resolved} tone="success" />
        <Kpi
          label={`Stale (>${STALE_HOURS}h chưa resolve)`}
          value={stale}
          tone={stale > 0 ? "danger" : "success"}
        />
      </section>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Khoá:
        </span>
        <Link
          href={filterHref({ course: null })}
          className={!courseFilter ? "chip-brand" : "chip"}
        >
          Tất cả
        </Link>
        {ownedCourses.map((c) => (
          <Link
            key={c.id}
            href={filterHref({ course: c.id })}
            className={courseFilter === c.id ? "chip-brand" : "chip"}
          >
            {c.title}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Trạng thái:
        </span>
        {(
          [
            { id: "all", label: "Tất cả" },
            { id: "unresolved", label: "Chưa giải đáp" },
            { id: "stale", label: `Stale >${STALE_HOURS}h` },
            { id: "resolved", label: "Đã resolved" },
          ] as const
        ).map((f) => (
          <Link
            key={f.id}
            href={filterHref({ status: f.id })}
            className={status === f.id ? "chip-brand" : "chip"}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* List */}
      <section className="mt-8">
        {threads.length === 0 ? (
          <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-10 text-center text-sm text-muted">
            Không có thread nào khớp bộ lọc.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Thread</th>
                  <th className="px-4 py-3">Khoá / Bài học</th>
                  <th className="px-4 py-3">Tác giả</th>
                  <th className="px-4 py-3 text-right">Replies</th>
                  <th className="px-4 py-3">Tuổi</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {threads.map((t) => {
                  const ageHours =
                    (Date.now() - new Date(t.createdAt).getTime()) /
                    (1000 * 3600);
                  const isStale = !t.resolvedPostId && ageHours > STALE_HOURS;
                  return (
                    <tr
                      key={t.id}
                      className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="line-clamp-1 font-medium">{t.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-faint">
                          {t.body}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-xs text-muted">
                          {t.lesson.module.course.title}
                        </p>
                        <p className="mt-0.5 text-xs text-faint">
                          {t.lesson.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-xs">{t.author.displayName}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-right tabular-nums">
                        {t._count.posts}
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        {formatAge(ageHours)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {t.resolvedPostId ? (
                          <span className="chip-success">Resolved</span>
                        ) : isStale ? (
                          <span className="chip-danger">Stale</span>
                        ) : (
                          <span className="chip-accent">Chưa giải đáp</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Link
                          href={`/learn/${t.lesson.module.course.slug}/threads/${t.id}`}
                          className="btn-secondary btn-sm"
                        >
                          Mở thread
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "brand" | "success" | "accent" | "danger";
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
  }[tone];
  return (
    <div className="card">
      <div className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </div>
  );
}
