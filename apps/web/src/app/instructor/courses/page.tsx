import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "chip-accent",
  published: "chip-success",
  archived: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};

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
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-brand">Instructor</span>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
            Khóa học của tôi
          </h1>
          <p className="mt-2 text-muted">
            {courses.length > 0
              ? `${courses.length} khóa bạn đang phụ trách`
              : "Bạn chưa tạo khóa học nào."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/instructor/courses/new" className="btn-primary">
            + Tạo khóa học
          </Link>
          <Link href="/instructor/tournaments/new" className="btn-primary">
            🏆 Tạo tournament
          </Link>
        </div>
      </div>

      {/* Tools */}
      <nav className="mt-6 flex flex-wrap gap-2">
        <Link href="/instructor/feedback-templates" className="btn-secondary btn-sm">
          Feedback templates
        </Link>
        <Link href="/instructor/feedback-generator" className="btn-sm inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-soft px-3 py-1.5 font-medium text-brand-700 transition-colors hover:bg-brand-100">
          AI feedback gen
        </Link>
        <Link href="/instructor/tournaments" className="btn-secondary btn-sm">
          Xem tất cả tournaments
        </Link>
      </nav>

      {/* Courses list */}
      {courses.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                      </div>
          <p className="mt-4 text-muted">
            Chưa có khóa học nào. Tạo khóa đầu tiên để bắt đầu.
          </p>
          <Link href="/instructor/courses/new" className="btn-primary mt-5 inline-flex">
            + Tạo khóa học
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <div className="card-hover group h-full">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="text-base font-semibold transition-colors group-hover:text-brand-600"
                  >
                    {c.title}
                  </Link>
                  <span className={STATUS_TONE[c.status] ?? "chip"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-faint">
                  <code className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 font-mono">
                    /{c.slug}
                  </code>
                  <span>·</span>
                  <span>v{c.version}</span>
                  <span>·</span>
                  <span>cập nhật {new Date(c.updatedAt).toLocaleDateString("vi-VN")}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-token pt-3">
                  <Link
                    href={`/catalog/${c.slug}`}
                    className="link text-xs"
                  >
                    Xem (learner view)
                  </Link>
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
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
