import { NextResponse } from "next/server";
import { savePracticeAnswer } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Lưu đáp án một câu trong buổi luyện. Body: { answerJson }. */
export async function PUT(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { answerJson?: unknown } | null;
  try {
    await savePracticeAnswer(userId, params.id, params.questionId, body?.answerJson);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
