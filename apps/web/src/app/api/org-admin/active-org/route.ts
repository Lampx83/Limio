import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { OrgMemberError, enterOrgAdminWorkspace } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { ACTIVE_ORG_COOKIE } from "@/lib/activeOrg";

export const runtime = "nodejs";

/**
 * POST /api/org-admin/active-org — body: { organizationId }. Chọn tổ chức để vào khu quản trị đơn vị.
 * Platform Admin vào tổ chức mình không được gán thì mỗi lần gọi ghi nhật ký `org.admin_entered`.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { organizationId?: unknown } | null;
  if (typeof body?.organizationId !== "string" || !body.organizationId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const org = await enterOrgAdminWorkspace(userId, body.organizationId);
    revalidateTag("active-org");
    const res = NextResponse.json({ ok: true, organization: { id: org.id, name: org.name, kind: org.kind } });
    res.cookies.set(ACTIVE_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
    return res;
  } catch (e) {
    if (e instanceof OrgMemberError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : e.code === "org_not_found" ? 404 : 400 });
    throw e;
  }
}

/** DELETE /api/org-admin/active-org — bỏ lựa chọn để chọn lại tổ chức khác (không ghi nhật ký: chưa vào đâu). */
export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  revalidateTag("active-org");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ORG_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}
