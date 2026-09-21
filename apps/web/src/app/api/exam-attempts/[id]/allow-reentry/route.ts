import { NextResponse } from "next/server";
import { grantAttemptReentry } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Giảng viên/giám thị cho một thí sinh (vào bằng mã thi mở) vào lại bài đang làm
 * dở khi họ quên email/SĐT đã nhập lần đầu. Quyền dùng một lần, hết hạn sau ít
 * phút — xem grantAttemptReentry.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const actorUserId = await requireUserId();
  if (!actorUserId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await grantAttemptReentry(actorUserId, params.id);
    return NextResponse.json({ ok: true, expiresAt: r.expiresAt.toISOString() });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
