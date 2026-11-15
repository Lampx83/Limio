import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { listAllUserNotes } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { formatDate } from "@/lib/datetime";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type T = Awaited<ReturnType<typeof getT>>;

function relative(d: Date, t: T): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return t("ai.mynotes.justNow");
  if (m < 60) return t("ai.mynotes.minutesAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("ai.mynotes.hoursAgo", { n: h });
  const day = Math.floor(h / 24);
  if (day < 7) return t("ai.mynotes.daysAgo", { n: day });
  return formatDate(d);
}

export default async function MyNotesPage({
  searchParams,
}: {
  searchParams: { course?: string; q?: string };
}) {
  const t = await getT();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/me/notes");

  const courseFilter = searchParams.course;
  const q = searchParams.q?.trim() || undefined;

  const [notes, enrollments] = await Promise.all([
    listAllUserNotes(userId, { courseId: courseFilter, q, take: 200 }),
    prisma.enrollment.findMany({
      where: { userId },
      select: {
        course: { select: { id: true, slug: true, title: true } },
      },
      orderBy: { enrolledAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
          <Pencil size={18} strokeWidth={2.5} />
        </span>
        <div>
          <h1 className="h-display text-2xl font-bold">{t("ai.notes.heading")}</h1>
          <p className="text-sm text-muted">{t("ai.mynotes.subtitle")}</p>
        </div>
      </header>

      {/* Search + course filter */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("ai.mynotes.search")}
            className="input w-full pl-9 text-sm"
          />
        </div>
        <select
          name="course"
          defaultValue={courseFilter ?? ""}
          className="input text-sm"
        >
          <option value="">{t("ai.mynotes.allCourses")}</option>
          {enrollments.map((e) => (
            <option key={e.course.id} value={e.course.id}>
              {e.course.title}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary btn-sm">
          {t("ai.mynotes.filter")}
        </button>
        {(q || courseFilter) && (
          <Link href="/me/notes" className="btn-ghost btn-sm">
            {t("ai.mynotes.clear")}
          </Link>
        )}
      </form>

      <p className="mt-4 text-xs text-faint">
        {t("ai.mynotes.count", { n: notes.length })}
        {q && (
          <>
            {" "}
            {t("ai.mynotes.matchOpen")}<span className="font-semibold">{q}</span>{t("ai.mynotes.matchClose")}
          </>
        )}
      </p>

      {notes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-token py-16 text-center">
          <div className="text-4xl">✍️</div>
          <p className="mt-3 font-medium">
            {q || courseFilter
              ? t("ai.mynotes.noMatch")
              : t("ai.mynotes.none")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t("ai.mynotes.hint")}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((n) => {
            const slug = n.lesson.module.course.slug;
            const href = `/learn/${slug}/lessons/${n.lesson.id}`;
            return (
              <li
                key={n.id}
                className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <Link
                    href={href}
                    className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {n.lesson.module.course.title} · {n.lesson.title}
                  </Link>
                  <span className="text-faint">
                    {n.timestampSec !== null && (
                      <span className="chip-accent mr-2 font-mono">
                        {n.timestampSec}s
                      </span>
                    )}
                    {relative(n.createdAt, t)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{n.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
