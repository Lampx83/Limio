import { NextResponse } from "next/server";
import { upsertPlanPrice } from "@feedbackme/core-lms";
import { guardPlatformAdmin, planErrorResponse } from "@/lib/adminPlansApi";

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const g = await guardPlatformAdmin();
  if ("res" in g) return g.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || (b.period !== "month" && b.period !== "year") || typeof b.amountVnd !== "number") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    await upsertPlanPrice(g.adminId, params.key, b.period, b.amountVnd, b.active !== false);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return planErrorResponse(e);
  }
}
