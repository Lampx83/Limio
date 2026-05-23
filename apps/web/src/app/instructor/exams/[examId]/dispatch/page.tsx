import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { listBatchesForExam, DispatchError } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "Đang soạn", cls: "bg-slate-100 text-slate-700" },
  sending: { text: "Đang gửi…", cls: "bg-blue-100 text-blue-800" },
  completed: { text: "Đã gửi xong", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { text: "Đã huỷ", cls: "bg-amber-100 text-amber-800" },
};

export default async function ExamDispatchHistoryPage({
  params,
}: {
  params: { examId: string };
}) {
  const userId = await requireUserId();
  if (!userId)
    redirect(`/signin?callbackUrl=/instructor/exams/${params.examId}/dispatch`);

  // Resolve courseId for back-link to candidates panel.
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { courseId: true, title: true },
  });
  if (!exam) notFound();

  let batches;
  try {
    batches = await listBatchesForExam(params.examId, userId);
  } catch (e) {
    if (e instanceof DispatchError) notFound();
    throw e;
  }

  return (
    <main>
      <div className="mb-4">
        <Link
          href={`/instructor/courses/${exam.courseId}/exams/${params.examId}#candidates`}
          className="text-sm text-brand-700 hover:underline"
        >
          ← Quay lại danh sách thí sinh
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="h-display text-2xl font-bold">
          Lịch sử gửi email — {exam.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Mỗi đợt gửi mã được lưu tại đây để xem lại và gửi lại cho người thất bại.
        </p>
      </div>

      {batches.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Chưa có đợt gửi mã nào. Quay lại trang thí sinh và bấm{" "}
          <strong>"Chuẩn bị gửi mã"</strong> để tạo đợt đầu tiên.
        </div>
      ) : (
        <div className="card divide-y divide-base-200 overflow-hidden">
          {batches.map((b) => {
            const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.draft!;
            return (
              <Link
                key={b.id}
                href={`/instructor/exams/${params.examId}/dispatch/${b.id}`}
                className="block px-4 py-3 transition-colors hover:bg-base-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{b.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
                      >
                        {s.text}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Tạo bởi <strong>{b.createdBy.displayName}</strong> lúc{" "}
                      {new Date(b.createdAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                      {b.approvedBy && (
                        <>
                          {" · "}duyệt bởi{" "}
                          <strong>{b.approvedBy.displayName}</strong>
                        </>
                      )}
                    </div>
                    {b.status !== "draft" && b.status !== "cancelled" && (
                      <div className="mt-1.5 flex gap-3 text-xs">
                        <span>
                          Tổng <strong>{b.totalItems}</strong>
                        </span>
                        <span className="text-emerald-700">
                          ✓ {b.sentCount} đã gửi
                        </span>
                        {b.failedCount > 0 && (
                          <span className="text-red-700">
                            ✗ {b.failedCount} lỗi
                          </span>
                        )}
                        {b.skippedCount > 0 && (
                          <span className="text-amber-700">
                            ⊘ {b.skippedCount} bỏ qua
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-faint">Xem →</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
