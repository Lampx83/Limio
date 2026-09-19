import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { copyActivityPlan } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/teaching-tools/activity-plans/[planId]/copy
 * Copy a public marketplace plan into the caller's own library.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const plan = await copyActivityPlan(params.planId, userId, {}, prisma);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("[Activity Plan Copy API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
