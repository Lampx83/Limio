import { NextResponse } from "next/server";
import { grantRole, getRolesForUser, RoleError } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const roles = await getRolesForUser(params.userId);
  return NextResponse.json({ roles });
}

export async function POST(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  // Inject targetUserId from path; ignore any in body.
  const input = { ...(body as object), targetUserId: params.userId };
  try {
    const result = await grantRole(adminId, input);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof RoleError) {
      const status = e.code === "validation_failed" ? 400 : 404;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
