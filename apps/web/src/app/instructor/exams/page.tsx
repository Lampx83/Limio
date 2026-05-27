import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  FlaskConical,
  Clock,
  FileQuestion,
  Users,
  CalendarClock,
  PencilLine,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  string,
  { label: string; chip: string; rail: string; dot: string }
> = {
  draft: {
    label: "Nháp",
    chip: "bg-slate-100 text-slate-700",
    rail: "bg-slate-300",
    dot: "bg-slate-400",
  },
  published: {
    label: "Đã publish",
    chip: "bg-emerald-100 text-emerald-800",
    rail: "bg-gradient-to-b from-emerald-400 to-emerald-600",
    dot: "bg-emerald-500",
  },
  archived: {
    label: "Lưu trữ",
    chip: "bg-amber-100 text-amber-800",
    rail: "bg-amber-300",
    dot: "bg-amber-500",
  },
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
    <main>
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
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {exams.map((e) => {
            const course = courseById.get(e.courseId);
            const pending = pendingByExam.get(e.id) ?? 0;
            const status = STATUS_META[e.status] ?? STATUS_META.draft!;
            return (
              <li
                key={e.id}
                className="group relative overflow-hidden rounded-2xl border border-default bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Left rail — màu theo status */}
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${status.rail}`}
                  aria-hidden
                />
                {/* Pending ribbon góc trên-phải */}
                {pending > 0 && (
                  <Link
                    href={`/instructor/courses/${e.courseId}/exams/${e.id}/grading`}
                    className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-amber-600"
                    title={`${pending} câu chờ chấm`}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {pending} chờ chấm
                  </Link>
                )}

                <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                  {/* Header: title + status pill */}
                  <div className="flex flex-wrap items-start gap-2 pr-24">
                    <Link
                      href={`/instructor/courses/${e.courseId}/exams/${e.id}`}
                      className="min-w-0 break-words text-base font-semibold text-slate-900 transition group-hover:text-brand-700"
                    >
                      {e.title}
                    </Link>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.chip}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                  </div>

                  {/* Course chip */}
                  <Link
                    href={`/instructor/courses/${e.courseId}`}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 transition hover:bg-slate-200 hover:text-slate-800"
                  >
                    <BookOpen className="h-3 w-3" aria-hidden />
                    <span className="max-w-[200px] truncate">
                      {course?.title ?? "(course unknown)"}
                    </span>
                  </Link>

                  {/* Stats grid — 4 cột với icon + tinted background */}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatChip
                      icon={Clock}
                      tone="sky"
                      label="Thời lượng"
                      value={`${e.durationMin}p`}
                    />
                    <StatChip
                      icon={FileQuestion}
                      tone="violet"
                      label="Nội dung"
                      value={`${e._count.questions} câu`}
                      sub={
                        e._count.passages > 0
                          ? `${e._count.passages} đoạn`
                          : undefined
                      }
                    />
                    <StatChip
                      icon={Users}
                      tone="emerald"
                      label="Lượt thi"
                      value={String(e._count.attempts)}
                    />
                    <StatChip
                      icon={CalendarClock}
                      tone="slate"
                      label="Cập nhật"
                      value={formatRel(e.updatedAt)}
                    />
                  </div>

                  {/* Action row */}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Link
                      href={`/instructor/courses/${e.courseId}/exams/${e.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-default bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden />
                      Chỉnh sửa
                    </Link>
                    {(pending > 0 || e._count.attempts > 0) && (
                      <Link
                        href={`/instructor/courses/${e.courseId}/exams/${e.id}/grading`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                        Chấm bài
                      </Link>
                    )}
                    <Link
                      href={`/instructor/courses/${e.courseId}/exams/${e.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                    >
                      Mở
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
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

const STAT_TONE: Record<
  string,
  { bg: string; iconBg: string; iconFg: string; valueFg: string }
> = {
  sky: {
    bg: "bg-sky-50/60",
    iconBg: "bg-sky-100",
    iconFg: "text-sky-700",
    valueFg: "text-sky-900",
  },
  violet: {
    bg: "bg-violet-50/60",
    iconBg: "bg-violet-100",
    iconFg: "text-violet-700",
    valueFg: "text-violet-900",
  },
  emerald: {
    bg: "bg-emerald-50/60",
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-700",
    valueFg: "text-emerald-900",
  },
  slate: {
    bg: "bg-slate-50",
    iconBg: "bg-slate-200",
    iconFg: "text-slate-600",
    valueFg: "text-slate-700",
  },
};

function StatChip({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof Clock;
  tone: keyof typeof STAT_TONE;
  label: string;
  value: string;
  sub?: string;
}) {
  const t = STAT_TONE[tone] ?? STAT_TONE.slate!;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg ${t.bg} px-2.5 py-1.5`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${t.iconBg}`}
      >
        <Icon className={`h-3.5 w-3.5 ${t.iconFg}`} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-faint">
          {label}
        </div>
        <div className={`truncate text-sm font-semibold ${t.valueFg}`}>
          {value}
          {sub && (
            <span className="ml-1 text-[10px] font-normal text-faint">
              {sub}
            </span>
          )}
        </div>
      </div>
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
