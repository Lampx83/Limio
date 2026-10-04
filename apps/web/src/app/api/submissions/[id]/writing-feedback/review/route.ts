import { NextResponse } from "next/server";
import { getSubmissionGradingContext } from "@feedbackme/core-lms";
import { listWritingFeedbackForReview } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Giảng viên (có quyền chấm khoá) xem các bản góp ý AI của một bài nộp. Quyền kiểm bằng cùng luật với chấm bài. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await getSubmissionGradingContext(userId, params.id);
    const rows = await listWritingFeedbackForReview(params.id);
    return NextResponse.json({
      feedbacks: rows.map((r) => ({
        id: r.id,
        status: r.status,
        body: r.body,
        generatedAt: r.generatedAt,
        reviewedAt: r.reviewedAt,
        reviewerNote: r.reviewerNote,
      })),
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
