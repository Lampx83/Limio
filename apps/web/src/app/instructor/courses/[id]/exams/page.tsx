import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

export default async function InstructorExamsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/exams`);
  }
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, slug: true },
  });
  if (!course) notFound();
  if (!(await canEditCourse(session.user.id, course.id))) {
    redirect("/instructor/courses");
  }

  const exams = await prisma.exam.findMany({
    where: { courseId: course.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      durationMin: true,
      openAt: true,
      closeAt: true,
      publishedAt: true,
      _count: {
        select: { passages: true, questions: true, attempts: true },
      },
    },
  });

  return (
    <main>
      <Link
        href={`/instructor/courses/${course.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {course.title}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bài thi</h1>
          <p className="mt-1 text-sm text-faint">
            {exams.length === 0
              ? "Chưa có bài thi nào."
              : `${exams.length} bài thi.`}
          </p>
        </div>
        <Link
          href={`/instructor/courses/${course.id}/exams/new`}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Tạo bài thi
        </Link>
      </div>

      {exams.length > 0 && (
        <ul className="mt-6 space-y-3">
          {exams.map((e) => (
            <li
              key={e.id}
              className="rounded border border-default bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold">
                      {e.title}
                    </h2>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[e.status] ?? "bg-slate-100"}`}
                    >
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-faint sm:grid-cols-4">
                    <Stat label="Thời lượng" value={`${e.durationMin} phút`} />
                    <Stat
                      label="Câu hỏi"
                      value={`${e._count.questions} (${e._count.passages} đoạn)`}
                    />
                    <Stat label="Lượt thi" value={String(e._count.attempts)} />
                    <Stat
                      label="Cửa sổ"
                      value={`${formatDate(e.openAt)} → ${formatDate(e.closeAt)}`}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/instructor/courses/${course.id}/exams/${e.id}`}
                    className="rounded border border-default px-3 py-1.5 text-sm hover:bg-slate-50"
                    prefetch={false}
                  >
                    Chỉnh sửa
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="uppercase tracking-wide">{label}</div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}

function formatDate(d: Date): string {
  return formatDateTime(d);
}
