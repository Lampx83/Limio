import { NextResponse } from "next/server";
import { removeOrgMember, OrgMemberError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

function errorStatus(code: OrgMemberError["code"]): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "not_member":
      return 404;
    default:
      return 400;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const actorId = await requireUserId();
  if (!actorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await removeOrgMember(actorId, params.id, params.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      return NextResponse.json({ error: e.code }, { status: errorStatus(e.code) });
    }
    throw e;
  }
}
