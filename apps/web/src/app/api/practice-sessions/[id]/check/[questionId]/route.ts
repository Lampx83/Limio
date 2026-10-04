import { NextResponse } from "next/server";
import { checkPracticeAnswer } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * LANG G5e.4 — Kiểm tra một câu: trả đúng/sai và đáp án đúng. CHỈ dành cho buổi luyện — id lượt
 * thi thử không thuộc bảng này nên luôn bị từ chối (không có đường lộ đáp án trong lúc thi).
 */
export async function POST(_req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await checkPracticeAnswer(userId, params.id, params.questionId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
