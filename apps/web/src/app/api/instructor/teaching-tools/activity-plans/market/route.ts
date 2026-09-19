import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { listMarketActivityPlans } from "@feedbackme/core-lms";

/**
 * GET /api/instructor/teaching-tools/activity-plans/market
 * Browse public plans from any instructor. ?saved=1 to filter to bookmarked.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const onlySaved = new URL(req.url).searchParams.get("saved") === "1";
    const plans = await listMarketActivityPlans(userId, { onlySaved }, prisma);
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("[Activity Plans Market API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
