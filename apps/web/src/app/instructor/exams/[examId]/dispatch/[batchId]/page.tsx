import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getBatchWithItems, renderTemplate } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import DispatchReviewClient from "./DispatchReviewClient";

export const dynamic = "force-dynamic";

export default async function ExamDispatchReviewPage({
  params,
}: {
  params: { examId: string; batchId: string };
}) {
  const userId = await requireUserId();
  if (!userId) redirect(`/signin?callbackUrl=/instructor/exams/${params.examId}/dispatch/${params.batchId}`);

  let batch;
  try {
    batch = await getBatchWithItems(params.batchId, userId);
  } catch {
    notFound();
  }
  if (!batch || batch.targetType !== "exam" || batch.targetId !== params.examId) {
    notFound();
  }

  // Render the email for the FIRST recipient as the on-screen preview
  // (per spec — instructor sees a real example, not a generic mock).
  const first = batch.items[0];
  const preview = first
    ? await renderTemplate({
        key: batch.templateKey as "exam.access_code",
        organizationId: batch.organizationId,
        variables: first.variables as Record<string, string | number>,
      })
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <Link
          href={`/instructor/courses/${"-"}/exams/${params.examId}#candidates`}
          className="text-sm text-brand-700 hover:underline"
        >
          ← Quay lại danh sách thí sinh
        </Link>
      </div>
      <DispatchReviewClient
        examId={params.examId}
        batch={{
          id: batch.id,
          title: batch.title,
          status: batch.status,
          totalItems: batch.totalItems,
          sentCount: batch.sentCount,
          failedCount: batch.failedCount,
          skippedCount: batch.skippedCount,
          createdByName: batch.createdBy.displayName,
          approvedByName: batch.approvedBy?.displayName ?? null,
          approvedAt: batch.approvedAt?.toISOString() ?? null,
          completedAt: batch.completedAt?.toISOString() ?? null,
          items: batch.items.map((i) => ({
            id: i.id,
            recipientEmail: i.recipientEmail,
            recipientName: i.recipientName,
            selected: i.selected,
            status: i.status,
            errorMessage: i.errorMessage,
            sentAt: i.sentAt?.toISOString() ?? null,
            attemptCount: i.attemptCount,
          })),
        }}
        preview={preview ? { subject: preview.subject, html: preview.html, recipientName: first!.recipientName, recipientEmail: first!.recipientEmail } : null}
      />
    </main>
  );
}
