import { NextResponse } from "next/server";
import { assertCanEditCourse, revokeBatch } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// DELETE /api/courses/[id]/access-code-batches/[batchId] — thu hồi mọi mã CHƯA dùng của lô.
// Mã đã kích hoạt giữ nguyên, học viên không mất quyền.
export async function DELETE(_req: Request, { params }: { params: { id: string; batchId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.id);
    return NextResponse.json(await revokeBatch(params.id, params.batchId, userId));
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
