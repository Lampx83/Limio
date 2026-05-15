import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, FlaskConical } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

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

export default async function InstructorExamsHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/exams");
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true, slug: true },
    orderBy: { updatedAt: "desc" },
  });
  const courseIds = ownedCourses.map((c) => c.id);
  const courseById = new Map(ownedCourses.map((c) => [c.id, c]));

  const exams =
    courseIds.length === 0
      ? []
      : await prisma.exam.findMany({
          where: { courseId: { in: courseIds } },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            durationMin: true,
            openAt: true,
            closeAt: true,
            courseId: true,
            updatedAt: true,
            _count: {
              select: { passages: true, questions: true, attempts: true },
            },
          },
        });

  // Pending-grade counts per exam — show badges to nudge instructor to grade.
  const pendingByExam = new Map<string, number>();
  if (exams.length > 0) {
    const rows = await prisma.examAnswer.groupBy({
      by: ["attemptId"],
      where: {
        needsGrading: true,
        attempt: { examId: { in: exams.map((e) => e.id) } },
        question: { type: { in: ["essay", "short_answer"] } },
      },
      _count: { _all: true },
    });
    // attemptId → examId mapping
    const attempts = await prisma.examAttempt.findMany({
      where: { id: { in: rows.map((r) => r.attemptId) } },
      select: { id: true, examId: true },
    });
    const attemptToExam = new Map(attempts.map((a) => [a.id, a.examId]));
    for (const r of rows) {
      const examId = attemptToExam.get(r.attemptId);
      if (!examId) continue;
      pendingByExam.set(examId, (pendingByExam.get(examId) ?? 0) + r._count._all);
    }
  }

  const draftCount = exams.filter((e) => e.status === "draft").length;
  const publishedCount = exams.filter((e) => e.status === "published").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/instructor/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FlaskConical className="h-6 w-6 shrink-0 text-amber-600" /> Bài thi trực tuyến</h1>
          <p className="mt-1 text-sm text-faint">
            {exams.length} bài thi · {draftCount} nháp · {publishedCount} đã publish
          </p>
        </div>
        <Link
          href="/instructor/exams/new"
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Tạo bài thi mới
        </Link>
      </div>

      {ownedCourses.length === 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          Bạn chưa phải instructor của khóa nào. Hãy{" "}
          <Link href="/instructor/courses/new" className="font-medium underline">
            tạo khóa đầu tiên
          </Link>
          .
        </div>
      )}

      {ownedCourses.length > 0 && exams.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint">
          Chưa có bài thi nào. Click "+ Tạo bài thi mới" để bắt đầu.
        </div>
      )}

      {exams.length > 0 && (
        <ul className="mt-6 space-y-3">
          {exams.map((e) => {
            const course = courseById.get(e.courseId);
            const pending = pendingByExam.get(e.id) ?? 0;
            return (
              <li
                key={e.id}
                className="rounded border border-default bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/instructor/courses/${e.courseId}/exams/${e.id}`}
                        className="truncate text-base font-semibold hover:text-blue-700"
                      >
                        {e.title}
                      </Link>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[e.status] ?? "bg-slate-100"}`}
                      >
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                      {pending > 0 && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                          {pending} chờ chấm
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-faint">
                      <BookOpen className="inline h-3 w-3 align-text-bottom text-slate-400" /> {course?.title ?? "(course unknown)"}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-faint sm:grid-cols-4">
                      <Stat label="Thời lượng" value={`${e.durationMin}p`} />
                      <Stat
                        label="Nội dung"
                        value={`${e._count.questions} câu / ${e._count.passages} đoạn`}
                      />
                      <Stat label="Lượt thi" value={String(e._count.attempts)} />
                      <Stat label="Cập nhật" value={formatRel(e.updatedAt)} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    <Link
                      href={`/instructor/courses/${e.courseId}/exams/${e.id}`}
                      className="rounded border border-default px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      Chỉnh sửa
                    </Link>
                    {(pending > 0 || e._count.attempts > 0) && (
                      <Link
                        href={`/instructor/courses/${e.courseId}/exams/${e.id}/grading`}
                        className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-100"
                      >
                        Chấm bài
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
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

function formatRel(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} ngày trước`;
  return d.toLocaleDateString("vi-VN");
}
