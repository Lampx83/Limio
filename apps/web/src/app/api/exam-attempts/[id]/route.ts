import { NextResponse } from "next/server";
import { deleteOralAttempt, getAttemptRuntime } from "@feedbackme/core-lms";
import { requireExamSubject, requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A7.4.3 — Runtime payload (server clock + state for resume). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await getAttemptRuntime(subject, params.id);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Xoá một lượt vấn đáp — dọn dữ liệu test, hoặc mở lại cho SV làm lại khi
 * attemptPolicy=single đã chặn. Chỉ áp dụng cho vấn đáp (deleteOralAttempt tự
 * chặn thi viết) — thi viết có luồng huỷ/disqualify riêng, không đi qua đây.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await deleteOralAttempt(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
