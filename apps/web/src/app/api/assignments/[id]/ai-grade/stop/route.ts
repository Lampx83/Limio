import { NextResponse } from "next/server";
import { requestStopAiGradeBatch } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapAiGradeBatchError } from "@/lib/aiGradeBatchApi";

export const runtime = "nodejs";

/** Dừng lô đang chạy: bài đang chạy xong rồi dừng, bài chưa chạy giữ nguyên. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await requestStopAiGradeBatch(userId, params.id));
  } catch (e) {
    const m = mapAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}
