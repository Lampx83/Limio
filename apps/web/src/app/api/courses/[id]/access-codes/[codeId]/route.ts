import { NextResponse } from "next/server";
import { assertCanEditCourse, revokeAccessCode } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// DELETE /api/courses/[id]/access-codes/[codeId] — thu hồi một mã CHƯA dùng.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; codeId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.id);
    await revokeAccessCode(params.id, params.codeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
