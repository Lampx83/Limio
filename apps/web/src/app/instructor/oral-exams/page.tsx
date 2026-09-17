import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Mic,
  BookOpen,
  FileText,
  Users,
  CalendarClock,
  Settings2,
  Radio,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import EmptyState from "@/components/ui/EmptyState";
import DeleteOralExamButton from "@/components/exam/DeleteOralExamButton";

export const dynamic = "force-dynamic";

// Cùng bảng màu theo status với /instructor/exams (đề viết) — nhất quán
// ngôn ngữ hình ảnh giữa 2 hub, chỉ khác nội dung thẻ (tài liệu thay vì
// câu hỏi/đoạn, có thêm nút Live cho buổi thi trực tiếp).
const STATUS_META: Record<
  string,
  { label: string; chip: string; rail: string; dot: string; header: string; title: string }
> = {
  draft: {
    label: "Nháp",
    chip: "bg-slate-100 text-slate-700",
    rail: "bg-slate-300",
    dot: "bg-slate-400",
    header: "bg-slate-50 border-b border-slate-200",
    title: "text-slate-900",
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
    chip: "bg-amber-100 text-amber-800",
    rail: "bg-amber-300",
    dot: "bg-amber-500",
    header: "bg-amber-50 border-b border-amber-100",
    title: "text-amber-900",
  },
};

const STAT_TONE = {
  violet: { bg: "bg-violet-50/60", iconBg: "bg-violet-100", iconFg: "text-violet-700", valueFg: "text-violet-900" },
  emerald: { bg: "bg-emerald-50/60", iconBg: "bg-emerald-100", iconFg: "text-emerald-700", valueFg: "text-emerald-900" },
  slate: { bg: "bg-slate-50", iconBg: "bg-slate-200", iconFg: "text-slate-600", valueFg: "text-slate-700" },
} as const;

function StatChip({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Users;
  tone: keyof typeof STAT_TONE;
  label: string;
  value: string;
}) {
  const t = STAT_TONE[tone];
  return (
    <div className={`flex items-center gap-2 rounded-lg ${t.bg} px-2.5 py-1.5`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${t.iconBg}`}>
        <Icon className={`h-3.5 w-3.5 ${t.iconFg}`} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
        <div className={`truncate text-sm font-semibold ${t.valueFg}`}>{value}</div>
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
  return formatDate(d);
}

/** A6.5 — Trang tổng quan riêng cho Vấn đáp AI, gom mọi đề vấn đáp của GV
 * qua các khoá học, kèm lối tắt tới Quản lý/Live/Chấm bài từng đề. */
export default async function OralExamsHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/oral-exams");
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
  });
  const courseIds = ownedCourses.map((c) => c.id);
  const courseById = new Map(ownedCourses.map((c) => [c.id, c]));

  const exams = await prisma.exam.findMany({
    where: {
      kind: "oral",
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
      courseId: true,
      updatedAt: true,
      _count: { select: { oralMaterials: true, attempts: true } },
    },
  });

  const draftCount = exams.filter((e) => e.status === "draft").length;
  const publishedCount = exams.filter((e) => e.status === "published").length;

  return (
    <main>
      <Link href="/instructor/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Mic className="h-6 w-6 shrink-0 text-amber-600" /> Phòng thi Vấn đáp AI
          </h1>
          <p className="mt-1 text-sm text-faint">
            AI đóng vai giảng viên hỏi-đáp trực tiếp với sinh viên, dựa trên
            tài liệu bạn nộp — điểm luôn do bạn duyệt/sửa, AI chỉ gợi ý.
          </p>
          {exams.length > 0 && (
            <p className="mt-1 text-sm text-faint">
              {exams.length} đề vấn đáp · {draftCount} nháp · {publishedCount} đã publish
            </p>
          )}
        </div>
        <Link
          href="/instructor/oral-exams/new"
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Tạo đề vấn đáp mới
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="🎙️"
            title="Chưa có đề vấn đáp nào"
            description="Tạo đề mới rồi nộp tài liệu để AI dựa vào đó hỏi sinh viên."
            actions={[
              { label: "+ Tạo đề vấn đáp mới", href: "/instructor/oral-exams/new", variant: "primary" },
            ]}
          />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {exams.map((e) => {
            const courseSegment = e.courseId ?? "none";
            const course = e.courseId ? courseById.get(e.courseId) : null;
            const status = STATUS_META[e.status] ?? STATUS_META.draft!;
            return (
              <li
                key={e.id}
                className="group relative overflow-hidden rounded-2xl border border-default bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Left rail — màu theo status */}
                <span className={`absolute inset-y-0 left-0 w-1 ${status.rail}`} aria-hidden />

                {/* Header band — tinted theo status */}
                <div className={`px-4 pl-5 sm:px-5 sm:pl-6 py-3 ${status.header}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                      className={`min-w-0 break-words text-base font-semibold transition group-hover:text-brand-700 ${status.title}`}
                      prefetch={false}
                    >
                      {e.title}
                    </Link>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
                      {status.label}
                    </span>
                  </div>

                  {/* Course chip — đề độc lập không có khoá học để trỏ tới */}
                  {e.courseId ? (
                    <Link
                      href={`/instructor/courses/${e.courseId}`}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 transition hover:bg-white hover:text-slate-800"
                      prefetch={false}
                    >
                      <BookOpen className="h-3 w-3" aria-hidden />
                      <span className="max-w-[200px] truncate">{course?.title ?? "(course unknown)"}</span>
                    </Link>
                  ) : (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-slate-600">
                      <BookOpen className="h-3 w-3" aria-hidden />
                      Đề độc lập
                    </span>
                  )}
                </div>

                <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                  <div className="grid grid-cols-3 gap-2">
                    <StatChip icon={FileText} tone="violet" label="Tài liệu" value={String(e._count.oralMaterials)} />
                    <StatChip icon={Users} tone="emerald" label="Lượt thi" value={String(e._count.attempts)} />
                    <StatChip icon={CalendarClock} tone="slate" label="Cập nhật" value={formatRel(e.updatedAt)} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-default bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                      prefetch={false}
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden />
                      Quản lý
                    </Link>
                    {e.status === "published" && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/live`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-default bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                        prefetch={false}
                      >
                        <Radio className="h-3.5 w-3.5" aria-hidden />
                        Live
                      </Link>
                    )}
                    {e._count.attempts > 0 && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/grading`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100"
                        prefetch={false}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                        Chấm bài
                      </Link>
                    )}
                    <DeleteOralExamButton examId={e.id} examTitle={e.title} />
                    <Link
                      href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                      prefetch={false}
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
