import { NextResponse } from "next/server";
import { getOralEvaluation, submitOralEvaluation } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A6.4 — GV xem transcript + điểm hiện tại (AI đề xuất và/hoặc GV đã chấm). */
export async function GET(
  _req: Request,
  { params }: { params: { attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const view = await getOralEvaluation(userId, params.attemptId);
    return NextResponse.json(view);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** A6.4 — GV chốt điểm cuối cùng. Body: { score: number (0-100), notes?: string }. */
export async function PATCH(
  req: Request,
  { params }: { params: { attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await submitOralEvaluation(userId, params.attemptId, body);
    // Best-effort — dashboard giám thị thường không còn mở lúc chấm bài xong.
    await recordStatus(params.attemptId, "graded").catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
