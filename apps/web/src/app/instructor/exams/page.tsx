import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Clock,
  FileQuestion,
  Users,
  PencilLine,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

// Màu chỉ để báo trạng thái (thanh cạnh trái + chấm nhỏ); phần còn lại của thẻ
// trung tính, nhấn duy nhất bằng màu thương hiệu ở nút "Mở" / "Chấm bài".
const STATUS_META: Record<string, { label: string; rail: string; dot: string; text: string }> = {
  draft: { label: "Nháp", rail: "bg-slate-300", dot: "bg-slate-400", text: "text-slate-600" },
  published: { label: "Đã publish", rail: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-700" },
  archived: { label: "Lưu trữ", rail: "bg-amber-400", dot: "bg-amber-500", text: "text-amber-700" },
};

const ACTION =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";

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

  const exams = await prisma.exam.findMany({
    where: {
      kind: "written",
      OR: [
        ...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []),
        { courseId: null, createdById: userId },
      ],
    },
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
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Đề thi</h1>
          <p className="mt-1 text-sm text-faint">
            {exams.length} bài thi · {draftCount} nháp · {publishedCount} đã publish
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/instructor/exams/new/blank"
            className="rounded border border-default px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            + Tạo đề không gắn khoá học
          </Link>
          <Link
            href="/instructor/exams/new"
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Tạo bài thi mới
          </Link>
        </div>
      </div>

      {ownedCourses.length === 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          Bạn chưa phải instructor của khóa nào — vẫn tạo được đề{" "}
          <Link href="/instructor/exams/new/blank" className="font-medium underline">
            không gắn khoá học
          </Link>
          , hoặc{" "}
          <Link href="/instructor/courses/new" className="font-medium underline">
            tạo khóa đầu tiên
          </Link>
          .
        </div>
      )}

      {exams.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint">
          Chưa có bài thi nào. Click "+ Tạo bài thi mới" để bắt đầu.
        </div>
      )}

      {exams.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {exams.map((e) => {
            const courseSegment = e.courseId ?? "none";
            const course = e.courseId ? courseById.get(e.courseId) : null;
            const pending = pendingByExam.get(e.id) ?? 0;
            const status = STATUS_META[e.status] ?? STATUS_META.draft!;
            return (
              <li
                key={e.id}
                className="group relative overflow-hidden rounded-xl border border-default bg-white shadow-sm transition hover:shadow-md"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${status.rail}`} aria-hidden />

                <div className="p-4 pl-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                        className="block break-words text-base font-semibold leading-snug text-slate-900 transition group-hover:text-brand-700"
                        prefetch={false}
                      >
                        {e.title}
                      </Link>
                      {e.courseId ? (
                        <Link
                          href={`/instructor/courses/${e.courseId}`}
                          className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-slate-500 transition hover:text-brand-700"
                          prefetch={false}
                        >
                          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{course?.title ?? "(course unknown)"}</span>
                        </Link>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Đề độc lập
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${status.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      <b className="font-semibold text-slate-700">{e.durationMin}</b> phút
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileQuestion className="h-3.5 w-3.5" aria-hidden />
                      <b className="font-semibold text-slate-700">{e._count.questions}</b> câu
                      {e._count.passages > 0 ? ` · ${e._count.passages} đoạn` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      <b className="font-semibold text-slate-700">{e._count.attempts}</b> lượt thi
                    </span>
                    <span className="text-slate-400">Cập nhật {formatRel(e.updatedAt)}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 py-2 pl-4 pr-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Link
                      href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                      className={ACTION}
                      prefetch={false}
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden />
                      Chỉnh sửa
                    </Link>
                    {(pending > 0 || e._count.attempts > 0) && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/grading`}
                        className={`${ACTION} !text-brand-700 hover:!bg-brand-50`}
                        prefetch={false}
                        title={pending > 0 ? `${pending} câu chờ chấm` : undefined}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                        Chấm bài
                        {pending > 0 && (
                          <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
                            {pending}
                          </span>
                        )}
                      </Link>
                    )}
                  </div>
                  <Link
                    href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                    prefetch={false}
                  >
                    Mở
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
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
  return formatDate(d);
}
