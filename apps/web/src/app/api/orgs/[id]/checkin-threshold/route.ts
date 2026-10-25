import { NextResponse } from "next/server";
import { OrgMemberError, setOrgCheckinThreshold } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** PATCH /api/orgs/[id]/checkin-threshold — body: { minutes: số nguyên 5–120 }. Quản trị trường hoặc Platform Admin. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { minutes?: unknown } | null;
  if (typeof body?.minutes !== "number") return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await setOrgCheckinThreshold(userId, params.id, body.minutes)) });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      const status = e.code === "forbidden" ? 403 : e.code === "org_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
