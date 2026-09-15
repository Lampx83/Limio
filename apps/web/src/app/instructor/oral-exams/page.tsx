import Link from "next/link";
import { redirect } from "next/navigation";
import { Mic } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import DeleteOralExamButton from "@/components/exam/DeleteOralExamButton";

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
      _count: { select: { oralMaterials: true, attempts: true } },
    },
  });

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
        <ul className="mt-6 space-y-3">
          {exams.map((e) => {
            const courseSegment = e.courseId ?? "none";
            const course = e.courseId ? courseById.get(e.courseId) : null;
            return (
              <li key={e.id} className="rounded-lg border border-default bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                        className="text-sm font-semibold hover:underline"
                      >
                        {e.title}
                      </Link>
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[e.status] ?? "bg-slate-100"}`}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-faint">
                      {course?.title ?? "Đề độc lập"} · {e._count.oralMaterials} tài liệu ·{" "}
                      {e._count.attempts} lượt thi
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Link
                      href={`/instructor/courses/${courseSegment}/exams/${e.id}`}
                      className="rounded border border-default px-3 py-1 hover:bg-slate-50"
                    >
                      Quản lý
                    </Link>
                    {e.status === "published" && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/live`}
                        className="rounded border border-default px-3 py-1 hover:bg-slate-50"
                      >
                        Live
                      </Link>
                    )}
                    {e._count.attempts > 0 && (
                      <Link
                        href={`/instructor/courses/${courseSegment}/exams/${e.id}/grading`}
                        className="rounded border border-default px-3 py-1 hover:bg-slate-50"
                      >
                        Chấm bài
                      </Link>
                    )}
                    <DeleteOralExamButton examId={e.id} examTitle={e.title} />
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
