import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Users,
  CalendarClock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  string,
  { label: string; chip: string; rail: string; dot: string }
> = {
  draft: {
    label: "Nháp",
    chip: "bg-amber-100 text-amber-800",
    rail: "bg-amber-300",
    dot: "bg-amber-500",
  },
  published: {
    label: "Đã publish",
    chip: "bg-emerald-100 text-emerald-800",
    rail: "bg-gradient-to-b from-emerald-400 to-emerald-600",
    dot: "bg-emerald-500",
  },
  archived: {
    label: "Lưu trữ",
    chip: "bg-slate-100 text-slate-700",
    rail: "bg-slate-300",
    dot: "bg-slate-400",
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
      personalizationEnabled: true,
      updatedAt: true,
      _count: { select: { enrollments: true, modules: true } },
    },
  });

  return (
    <main>
      {/* Header — tiêu đề, công cụ và CTA chung 1 hàng để nhường chỗ cho lưới thẻ */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="h-display text-h2">Khóa học của tôi</h1>
          <p className="mt-1 text-sm text-muted">
            {courses.length > 0
              ? `${courses.length} khóa bạn đang phụ trách`
              : "Bạn chưa tạo khóa học nào."}
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link href="/instructor/courses/new" className="btn-primary btn-sm">
            + Tạo khóa học
          </Link>
        </nav>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon="📚"
          title="Chưa có khóa học nào"
          description="Tạo khóa đầu tiên để bắt đầu xây dựng module, lesson và quiz."
          actions={[{ label: "+ Tạo khóa học", href: "/instructor/courses/new" }]}
        />
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {courses.map((c) => {
            const status = STATUS_META[c.status] ?? STATUS_META.draft!;
            return (
              <li key={c.id}>
                <div className="group relative h-full overflow-hidden rounded-xl border border-default bg-white py-3 pl-5 pr-4 shadow-sm transition-all hover:border-brand-300 hover:shadow-md">
                  <span className={`absolute inset-y-0 left-0 w-1 ${status.rail}`} aria-hidden />

                  {/* Tiêu đề + trạng thái */}
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/instructor/courses/${c.id}`}
                      className="min-w-0 break-words text-base font-semibold leading-snug text-slate-900 transition group-hover:text-brand-700"
                      prefetch={false}
                    >
                      {c.title}
                    </Link>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {c.personalizationEnabled && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-medium text-pink-700"
                          title="Khoá bật cá nhân hoá: AI feedback theo skill (BKT, chẩn đoán, lộ trình thích ứng, huy hiệu kỹ năng)"
                        >
                          <Sparkles className="h-3 w-3" aria-hidden />
                          AI feedback
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Ngày cập nhật gần nhất (updatedAt) — danh sách cũng sắp theo ngày này */}
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-faint">
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    Cập nhật {formatDate(c.updatedAt)}
                  </p>

                  {/* Số liệu + hành động chung 1 hàng */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-4 text-sm">
                      <Stat icon={BookOpen} label="Module" value={c._count.modules} />
                      <Stat icon={Users} label="Học viên" value={c._count.enrollments} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/instructor/courses/${c.id}`}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                        prefetch={false}
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

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon className="h-4 w-4 text-slate-400" aria-hidden />
      <span className="font-semibold text-slate-900">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
