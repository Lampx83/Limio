import { NextResponse } from "next/server";
import { DeleteUserError, deleteUser } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    await deleteUser(adminId, params.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof DeleteUserError) {
      const status =
        e.code === "user_not_found" ? 404 : e.code === "has_ownership" ? 409 : 400;
      return NextResponse.json({ error: e.code, blockers: e.blockers }, { status });
    }
    throw e;
  }
}
