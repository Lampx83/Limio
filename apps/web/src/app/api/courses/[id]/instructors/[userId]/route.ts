import { NextResponse } from "next/server";
import { removeCoInstructor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// DELETE /api/courses/[id]/instructors/[userId] — owner-only. Cannot remove
// the `owner` row through this endpoint.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await removeCoInstructor(userId, params.id, params.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
