import { NextResponse } from "next/server";
import { startOralExamAttempt } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A6.3 — Bắt đầu (hoặc resume) buổi vấn đáp AI. Chỉ hỗ trợ SV đã đăng nhập + đã ghi danh. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await startOralExamAttempt(userId, params.id);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
