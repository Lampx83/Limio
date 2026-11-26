import { NextResponse } from "next/server";
import { cancelSubscription, extendSubscription } from "@feedbackme/core-lms";
import { guardPlatformAdmin, parseDate, planErrorResponse } from "@/lib/adminPlansApi";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guardPlatformAdmin();
  if ("res" in g) return g.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (b?.action === "extend") {
      const endsAt = parseDate(b.endsAt);
      if (!endsAt) return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
      await extendSubscription(g.adminId, params.id, endsAt);
    } else if (b?.action === "cancel") {
      await cancelSubscription(g.adminId, params.id, typeof b.note === "string" ? b.note : undefined);
    } else {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return planErrorResponse(e);
  }
}
