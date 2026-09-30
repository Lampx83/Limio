import { NextResponse } from "next/server";
import { assignUserOrganization, OrgMemberError } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export const runtime = "nodejs";

/** Gắn / đổi / gỡ organization của user. Body: { organizationId: string | null }. */
export async function PUT(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { organizationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const organizationId = body.organizationId;
  if (organizationId !== null && typeof organizationId !== "string") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const result = await assignUserOrganization(adminId, params.userId, organizationId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      const status =
        e.code === "forbidden" ? 403 : e.code === "org_not_found" || e.code === "user_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
