import { NextResponse } from "next/server";
import { assignSubscription, listSubscriptions } from "@feedbackme/core-lms";
import { guardPlatformAdmin, parseDate, planErrorResponse } from "@/lib/adminPlansApi";

export async function GET(req: Request) {
  const g = await guardPlatformAdmin();
  if ("res" in g) return g.res;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const organizationId = url.searchParams.get("organizationId");
  if (!userId && !organizationId) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const subscriptions = await listSubscriptions(userId ? { userId } : { organizationId: organizationId! });
  return NextResponse.json({ subscriptions });
}

export async function POST(req: Request) {
  const g = await guardPlatformAdmin();
  if ("res" in g) return g.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.planKey !== "string" || (b.source !== "contract" && b.source !== "admin")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const startsAt = parseDate(b.startsAt);
  const endsAt = parseDate(b.endsAt);
  if (!startsAt || !endsAt) return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
  try {
    const { subscriptionId } = await assignSubscription(g.adminId, {
      planKey: b.planKey,
      userId: typeof b.userId === "string" ? b.userId : undefined,
      organizationId: typeof b.organizationId === "string" ? b.organizationId : undefined,
      startsAt,
      endsAt,
      source: b.source,
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : undefined,
    });
    return NextResponse.json({ subscriptionId }, { status: 201 });
  } catch (e) {
    return planErrorResponse(e);
  }
}
