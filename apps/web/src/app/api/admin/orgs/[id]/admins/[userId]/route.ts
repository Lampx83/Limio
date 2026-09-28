import { NextResponse } from "next/server";
import { revokeOrgAdmin, OrgAdminError } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

function errorStatus(code: OrgAdminError["code"]): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "not_admin":
      return 404;
    default:
      return 400;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    await revokeOrgAdmin(adminId, params.id, params.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OrgAdminError) {
      return NextResponse.json({ error: e.code }, { status: errorStatus(e.code) });
    }
    throw e;
  }
}
