import { NextResponse } from "next/server";
import { OrgMemberError, setOrgCenterEnabled } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { revalidateCenterAccess } from "@/lib/centerAccess";

export const runtime = "nodejs";

/** PATCH /api/orgs/[id]/center — body: { enabled: boolean }. Platform Admin hoặc OrgAdmin của trường. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const result = await setOrgCenterEnabled(userId, params.id, body.enabled);
    // Menu và trang đang cache quyền xem ngắn hạn: áp ngay thay vì đợi hết hạn.
    revalidateCenterAccess();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      const status = e.code === "forbidden" ? 403 : e.code === "org_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
