import { NextResponse } from "next/server";
import { requestStopOralAiGradeBatch } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapOralAiGradeBatchError } from "@/lib/oralAiGradeBatchApi";

export const runtime = "nodejs";

/** Dừng lô đang chạy: lượt đang chạy xong rồi dừng, lượt chưa chạy giữ nguyên. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await requestStopOralAiGradeBatch(userId, params.id));
  } catch (e) {
    const m = mapOralAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}
