import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { getSubmissionGradingContext } from "@feedbackme/core-lms";
import { reviewSpeakingFeedback } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { mapSpeakingError } from "@/lib/speakingFeedbackApi";

export const runtime = "nodejs";

/**
 * Duyệt/từ chối một bản góp ý bài nói. Body: { action: "approve"|"reject", note?, removeErrorIds?, editErrors? }.
 * Quyền: người chấm được bài nộp chứa bản góp ý này (cùng luật với chấm bài).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  try {
    const row = await prisma.speakingFeedback.findUnique({ where: { id: params.id }, select: { submissionId: true } });
    if (!row) return NextResponse.json({ error: "feedback_not_found" }, { status: 404 });
    await getSubmissionGradingContext(userId, row.submissionId);
    await reviewSpeakingFeedback(userId, params.id, (body ?? {}) as Parameters<typeof reviewSpeakingFeedback>[2]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const w = mapSpeakingError(e);
    if (w) return w;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
