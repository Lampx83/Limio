import { NextResponse } from "next/server";
import { updatePlan } from "@feedbackme/core-lms";
import { guardPlatformAdmin, planErrorResponse } from "@/lib/adminPlansApi";

export async function PATCH(req: Request, { params }: { params: { key: string } }) {
  const g = await guardPlatformAdmin();
  if ("res" in g) return g.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    await updatePlan(g.adminId, params.key, {
      ...(typeof b.name === "string" ? { name: b.name } : {}),
      ...(b.entitlements !== undefined ? { entitlements: b.entitlements } : {}),
      ...(typeof b.isPublic === "boolean" ? { isPublic: b.isPublic } : {}),
      ...(typeof b.active === "boolean" ? { active: b.active } : {}),
      ...(typeof b.sortOrder === "number" ? { sortOrder: b.sortOrder } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return planErrorResponse(e);
  }
}
