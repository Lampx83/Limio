import { NextResponse } from "next/server";
import { OrgMemberError, setOrgMemberCenterTeacher } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** PUT /api/orgs/[id]/members/[userId]/center-teacher — body: { enabled: boolean }. Cấp/thu hồi vai trò giảng viên trung tâm. */
export async function PUT(req: Request, { params }: { params: { id: string; userId: string } }) {
  const actorId = await requireUserId();
  if (!actorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, ...(await setOrgMemberCenterTeacher(actorId, params.id, params.userId, body.enabled)) });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      const status = e.code === "forbidden" ? 403 : e.code === "not_member" || e.code === "org_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
