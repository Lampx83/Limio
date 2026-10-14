import { NextResponse } from "next/server";
import { getSubmissionGradingContext } from "@feedbackme/core-lms";
import { listSpeakingFeedbackForReview } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Giảng viên (có quyền chấm khoá) xem bản chữ + các bản góp ý AI của bài nói. Quyền kiểm bằng cùng luật với chấm bài. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await getSubmissionGradingContext(userId, params.id);
    const { transcript, feedbacks } = await listSpeakingFeedbackForReview(params.id);
    return NextResponse.json({
      transcript,
      feedbacks: feedbacks.map((r) => ({
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
