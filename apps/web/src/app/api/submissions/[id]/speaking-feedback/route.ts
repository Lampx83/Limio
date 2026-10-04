import { NextResponse } from "next/server";
import { getSpeakingFeedbackForLearner, requestSpeakingFeedback } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { mapSpeakingError } from "@/lib/speakingFeedbackApi";
import { getOpenaiClient } from "@/lib/openaiClient";
import { loadSubmissionAudio } from "@/lib/submissionAudioLoader";

export const runtime = "nodejs";
export const maxDuration = 120; // Whisper + mô hình chấm có thể mất hơn một lượt gọi thường

/** LANG G7 — góp ý hiện hành cho bài nói CỦA MÌNH (nháp kèm nhãn "chưa duyệt", hoặc đã duyệt) kèm bản chữ. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ feedback: await getSpeakingFeedbackForLearner(userId, params.id) });
}

/**
 * Học viên bấm "Nhận góp ý bài nói": bản ghi âm được gửi tới OpenAI (chuyển chữ) rồi AI chấm; trừ ví token
 * AI của CHÍNH học viên. Cùng bản ghi thì dùng lại bản chữ/góp ý cũ, không gọi AI và không trừ lại.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await requestSpeakingFeedback(userId, params.id, {
      // Lấy khách hàng AI CHẬM: bản cũ/lỗi điều kiện không đòi cấu hình AI.
      openai: () => getOpenaiClient(),
      loadAudio: (url) => loadSubmissionAudio(url, userId),
    });
    return NextResponse.json(r, { status: r.reused ? 200 : 201 });
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    const w = mapSpeakingError(e);
    if (w) return w;
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
