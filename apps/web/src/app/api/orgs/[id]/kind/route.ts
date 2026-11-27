import { NextResponse } from "next/server";
import { OrgMemberError, isOrgKind, setOrganizationKind } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { revalidateCenterAccess } from "@/lib/centerAccess";

export const runtime = "nodejs";

/** PATCH /api/orgs/[id]/kind — body: { kind: "school" | "center" | "publisher" }. Chỉ Platform Admin (đổi loại là đổi phạm vi dữ liệu học viên admin được thấy). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { kind?: unknown } | null;
  if (!isOrgKind(body?.kind)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const result = await setOrganizationKind(userId, params.id, body.kind);
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
