import { NextResponse } from "next/server";
import {
  ORG_EMAIL_SETTING_KEYS,
  OrgMemberError,
  updateOrgEmailSettings,
  type OrgEmailSettings,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** PATCH /api/orgs/[id]/email-settings — body: một hay nhiều công tắc boolean (xem ORG_EMAIL_SETTING_KEYS). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const patch: Partial<OrgEmailSettings> = {};
  for (const key of ORG_EMAIL_SETTING_KEYS) {
    if (key in body) {
      if (typeof body[key] !== "boolean") {
        return NextResponse.json({ error: "validation_failed" }, { status: 400 });
      }
      patch[key] = body[key] as boolean;
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const result = await updateOrgEmailSettings(userId, params.id, patch);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      const status = e.code === "forbidden" ? 403 : e.code === "org_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
