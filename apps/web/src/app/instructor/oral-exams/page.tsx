import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  FileText,
  Users,
  Clock,
  Settings2,
  Radio,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { formatDate } from "@/lib/datetime";
import EmptyState from "@/components/ui/EmptyState";
import DeleteOralExamButton from "@/components/exam/DeleteOralExamButton";

export const dynamic = "force-dynamic";

// Màu chỉ dùng để báo trạng thái (thanh cạnh trái + chấm nhỏ); phần còn lại của
// thẻ trung tính, nhấn mạnh duy nhất bằng màu thương hiệu ở nút "Mở".
const STATUS_META: Record<string, { label: string; rail: string; dot: string; text: string }> = {
  draft: { label: "Nháp", rail: "bg-slate-300", dot: "bg-slate-400", text: "text-slate-600" },
  published: { label: "Đã publish", rail: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-700" },
  archived: { label: "Lưu trữ", rail: "bg-amber-400", dot: "bg-amber-500", text: "text-amber-700" },
};

const ACTION =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";

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
  const userId = await requireFeature("ai_oral.access");
  if (!userId) redirect("/instructor/dashboard");

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Phòng vấn đáp AI</h1>
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
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      <b className="font-semibold text-slate-700">{e._count.oralMaterials}</b> tài liệu
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      <b className="font-semibold text-slate-700">{e._count.attempts}</b> lượt thi
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {formatRel(e.updatedAt)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 py-2 pl-4 pr-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Link
                      href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                      className={ACTION}
                      prefetch={false}
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden />
                      Quản lý
                    </Link>
                    {e.status === "published" && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/live`}
                        className={`${ACTION} hover:!bg-rose-50 hover:!text-rose-700`}
                        prefetch={false}
                      >
                        <Radio className="h-3.5 w-3.5" aria-hidden />
                        Live
                      </Link>
                    )}
                    {e._count.attempts > 0 && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/grading`}
                        className={`${ACTION} !text-brand-700 hover:!bg-brand-50`}
                        prefetch={false}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                        Chấm bài
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <DeleteOralExamButton examId={e.id} examTitle={e.title} variant="icon" />
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
