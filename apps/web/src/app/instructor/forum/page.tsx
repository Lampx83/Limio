import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { EmptyState, KpiCard, DateTime } from "@/components/ui";

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
      <main>
        <h1 className="h-display text-h1">Forum Q&amp;A</h1>
        <EmptyState
          className="mt-6"
          icon="💬"
          title="Bạn chưa là instructor của khoá nào"
          description="Tạo khoá học để học viên có thể post câu hỏi trong forum."
          actions={[{ label: "+ Tạo khoá", href: "/instructor/courses/new" }]}
        />
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
    <main>
      <header>
        <h1 className="h-display text-h1">Forum Q&amp;A</h1>
        <p className="mt-2 text-muted">
          Thread hỏi-đáp của học viên gắn theo từng bài học. Đánh dấu một reply là
          &ldquo;resolved&rdquo; để chốt đáp án.
        </p>
      </header>

      {/* KPI cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard label="Tổng thread" value={totalThreads} tone="brand" />
        <KpiCard
          label="Chưa giải đáp"
          value={unresolved}
          tone={unresolved > 0 ? "accent" : "success"}
        />
        <KpiCard label="Đã resolved" value={resolved} tone="success" />
        <KpiCard
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
            prefetch={false}
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
            prefetch={false}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* List */}
      <section className="mt-8">
        {threads.length === 0 ? (
          <EmptyState
            icon="💬"
            title="Chưa có thread nào"
            description={status !== "all" || courseFilter ? "Đổi filter để xem thread khác." : "Học viên sẽ post câu hỏi trong từng bài học — thread sẽ hiện tại đây."}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card lg:block">
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
                          <DateTime value={t.createdAt} format="relative" />
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
                            prefetch={false}
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

            {/* Mobile card stack */}
            <ul className="space-y-3 lg:hidden">
              {threads.map((t) => {
                const ageHours =
                  (Date.now() - new Date(t.createdAt).getTime()) /
                  (1000 * 3600);
                const isStale = !t.resolvedPostId && ageHours > STALE_HOURS;
                return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 flex-1 font-medium">{t.title}</p>
                      {t.resolvedPostId ? (
                        <span className="chip-success shrink-0">Resolved</span>
                      ) : isStale ? (
                        <span className="chip-danger shrink-0">Stale</span>
                      ) : (
                        <span className="chip-accent shrink-0">Chưa giải đáp</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-faint">{t.body}</p>
                    <p className="mt-2 text-xs text-muted">
                      {t.lesson.module.course.title} · {t.lesson.title}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-token pt-3 text-xs text-faint">
                      <span>
                        {t.author.displayName} · {t._count.posts} replies ·{" "}
                        <DateTime value={t.createdAt} format="relative" />
                      </span>
                      <Link
                        href={`/learn/${t.lesson.module.course.slug}/threads/${t.id}`}
                        className="btn-secondary btn-sm"
                        prefetch={false}
                      >
                        Mở
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

