import { NextResponse } from "next/server";
import { claimAudioPlay } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * LANG G5b — xin một lượt phát audio của đề thi thử TRƯỚC khi phát. Body:
 * { passageId, audioKey, playId } (playId do máy khách sinh, gửi lại không tính hai
 * lần). Hết lượt → 403 audio_plays_exhausted. Đề thường luôn được (không giới hạn).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    return NextResponse.json(await claimAudioPlay(subject, params.id, body));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
