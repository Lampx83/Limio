import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InstructorCoursesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/courses");

  const courses = await prisma.course.findMany({
    where: {
      instructors: { some: { userId: session.user.id } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Khóa học của tôi</h1>
        <div className="flex gap-2">
          <Link
            href="/instructor/feedback-templates"
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Feedback templates
          </Link>
          <Link
            href="/instructor/feedback-generator"
            className="rounded border border-violet-300 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            🪄 AI feedback gen
          </Link>
          <Link
            href="/instructor/tournaments/new"
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            🏆 Tournament
          </Link>
          <Link
            href="/instructor/courses/new"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Tạo khóa học
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="mt-12 text-center text-slate-500">
          Chưa có khóa học. <Link href="/instructor/courses/new" className="underline">Tạo mới</Link>.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">
          {courses.map((c) => (
            <li key={c.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    /{c.slug} · v{c.version} · {c.status}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Link
                    href={`/catalog/${c.slug}`}
                    className="text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Xem (learner view)
                  </Link>
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                  >
                    Sửa →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
