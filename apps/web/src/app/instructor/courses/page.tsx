import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/ui";

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
    <main>
      {/* Back link */}
      <Link
        href="/instructor/dashboard"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-brand">Instructor</span>
          <h1 className="mt-3 h-display text-h1">
            Khóa học của tôi
          </h1>
          <p className="mt-2 text-muted">
            {courses.length > 0
              ? `${courses.length} khóa bạn đang phụ trách`
              : "Bạn chưa tạo khóa học nào."}
          </p>
        </div>
        <Link href="/instructor/courses/new" className="btn-primary">
          + Tạo khóa học
        </Link>
      </div>

      {/* Tools */}
      <nav className="mt-6 flex flex-wrap gap-2">
        <Link href="/instructor/feedback-templates" className="btn-secondary btn-sm">
          Feedback templates
        </Link>
        <Link href="/instructor/feedback-generator" className="btn-sm inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-soft px-3 py-1.5 font-medium text-brand-700 transition-colors hover:bg-brand-100">
          AI feedback gen
        </Link>
      </nav>

      {/* Courses list */}
      {courses.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon="📚"
          title="Chưa có khóa học nào"
          description="Tạo khóa đầu tiên để bắt đầu xây dựng module, lesson và quiz."
          actions={[{ label: "+ Tạo khóa học", href: "/instructor/courses/new" }]}
        />
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
