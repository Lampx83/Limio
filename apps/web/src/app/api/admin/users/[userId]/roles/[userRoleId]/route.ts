import { NextResponse } from "next/server";
import { revokeRole, RoleError } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string; userRoleId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    await revokeRole(adminId, { userRoleId: params.userRoleId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RoleError) {
      const status = e.code === "user_role_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
