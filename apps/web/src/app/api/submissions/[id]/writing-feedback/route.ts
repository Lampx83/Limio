import { NextResponse } from "next/server";
import { getWritingFeedbackForLearner, requestWritingFeedback } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { mapWritingError } from "@/lib/writingFeedbackApi";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/** LANG G6 — góp ý hiện hành cho bài nộp CỦA MÌNH (nháp kèm nhãn "chưa duyệt", hoặc đã duyệt). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ feedback: await getWritingFeedbackForLearner(userId, params.id) });
}

/**
 * Học viên bấm "Nhận góp ý bài viết": gửi bài viết tới nhà cung cấp AI và trừ ví token AI của CHÍNH
 * học viên. Cùng nội dung đã phân tích thì trả bản cũ, không gọi AI/trừ token lại.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    // Lấy khách hàng AI CHẬM: bản cũ/lỗi điều kiện không đòi cấu hình AI.
    const r = await requestWritingFeedback(userId, params.id, () => getOpenaiClient());
    return NextResponse.json(r, { status: r.reused ? 200 : 201 });
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    const w = mapWritingError(e);
    if (w) return w;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
