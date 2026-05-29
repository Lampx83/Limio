import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Users,
  FlaskConical,
  CalendarClock,
  Eye,
  PencilLine,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  string,
  { label: string; chip: string; rail: string; dot: string; header: string; title: string }
> = {
  draft: {
    label: "Nháp",
    chip: "bg-amber-100 text-amber-800",
    rail: "bg-amber-300",
    dot: "bg-amber-500",
    header: "bg-amber-50 border-b border-amber-100",
    title: "text-amber-900",
  },
  published: {
    label: "Đã publish",
    chip: "bg-emerald-100 text-emerald-800",
    rail: "bg-gradient-to-b from-emerald-400 to-emerald-600",
    dot: "bg-emerald-500",
    header: "bg-emerald-50 border-b border-emerald-100",
    title: "text-emerald-900",
  },
  archived: {
    label: "Lưu trữ",
    chip: "bg-slate-100 text-slate-700",
    rail: "bg-slate-300",
    dot: "bg-slate-400",
    header: "bg-slate-50 border-b border-slate-200",
    title: "text-slate-900",
  },
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
      _count: { select: { enrollments: true, modules: true, exams: true } },
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
          {courses.map((c) => {
            const status = STATUS_META[c.status] ?? STATUS_META.draft!;
            return (
              <li key={c.id}>
                <div className="group relative overflow-hidden rounded-2xl border border-default bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  {/* Left rail status */}
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${status.rail}`}
                    aria-hidden
                  />
                  {/* Header band — tinted theo status */}
                  <div className={`px-5 pl-6 py-3 ${status.header}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link
                        href={`/instructor/courses/${c.id}`}
                        className={`min-w-0 break-words text-base font-semibold transition group-hover:text-brand-700 ${status.title}`}
                      >
                        {c.title}
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
                    {/* Slug + version + updated */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                      <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-slate-600">
                        /{c.slug}
                      </code>
                      <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-slate-600">
                        v{c.version}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <CalendarClock className="h-3 w-3" aria-hidden />
                        {formatDate(c.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 pl-6">
                    {/* Stats — 3 chip có icon */}
                    <div className="grid grid-cols-3 gap-2">
                      <StatChip
                        icon={BookOpen}
                        tone="sky"
                        label="Module"
                        value={String(c._count.modules)}
                      />
                      <StatChip
                        icon={Users}
                        tone="emerald"
                        label="Học viên"
                        value={String(c._count.enrollments)}
                      />
                      <StatChip
                        icon={FlaskConical}
                        tone="violet"
                        label="Bài thi"
                        value={String(c._count.exams)}
                      />
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Link
                        href={`/catalog/${c.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-default bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        title="Xem dưới góc nhìn học viên"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        Learner view
                      </Link>
                      <Link
                        href={`/instructor/courses/${c.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-default bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <PencilLine className="h-3.5 w-3.5" aria-hidden />
                        Sửa
                      </Link>
                      <Link
                        href={`/instructor/courses/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                      >
                        Mở
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
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
};

function StatChip({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof BookOpen;
  tone: keyof typeof STAT_TONE;
  label: string;
  value: string;
}) {
  const t = STAT_TONE[tone] ?? STAT_TONE.sky!;
  return (
    <div className={`flex items-center gap-2 rounded-lg ${t.bg} px-2.5 py-1.5`}>
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
        </div>
      </div>
    </div>
  );
}
