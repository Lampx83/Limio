import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseDetail, CourseError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EnrollButton from "@/components/EnrollButton";

export const dynamic = "force-dynamic";

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/catalog" className="text-sm underline">
        ← Catalog
      </Link>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{course.level}</span>
        {course.category && (
          <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{course.category}</span>
        )}
        <span>{course.language}</span>
        {course.status !== "published" && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            {course.status}
          </span>
        )}
      </div>
      <h1 className="mt-2 text-4xl font-bold">{course.title}</h1>
      <p className="mt-3 text-slate-700 dark:text-slate-300">{course.description}</p>
      <p className="mt-2 text-sm text-slate-500">
        {course.instructors.map((i) => i.user.displayName).join(", ")}
      </p>

      {course.status === "published" && (
        <div className="mt-6">
          <EnrollButton slug={params.slug} alreadyEnrolled={enrolled} />
        </div>
      )}

      <h2 className="mt-10 text-xl font-semibold">Nội dung</h2>
      {course.modules.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Chưa có nội dung.</p>
      ) : (
        <ol className="mt-3 space-y-4">
          {course.modules.map((m) => (
            <li key={m.id} className="rounded border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-medium">{m.title}</h3>
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    <span>{l.title}</span>
                    {l.skillTags.length > 0 && (
                      <span className="ml-2 text-xs text-slate-500">
                        ({l.skillTags.map((t) => t.skill.code).join(", ")})
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
