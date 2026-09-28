import { NextResponse } from "next/server";
import { listOrgAdmins, grantOrgAdmin, OrgAdminError } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

function errorStatus(code: OrgAdminError["code"]): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "org_not_found":
    case "user_not_found":
      return 404;
    case "already_admin":
      return 409;
    default:
      return 400;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admins = await listOrgAdmins(params.id);
  return NextResponse.json({ admins });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email
      : "";
  if (!email.trim()) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  try {
    const result = await grantOrgAdmin(adminId, params.id, email);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof OrgAdminError) {
      return NextResponse.json({ error: e.code }, { status: errorStatus(e.code) });
    }
    throw e;
  }
}
