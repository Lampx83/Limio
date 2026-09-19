import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { toggleActivityPlanSave } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/teaching-tools/activity-plans/[planId]/save
 * Toggle bookmark (NOT a copy — just marks "xem lại sau") — public plans only.
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

    const result = await toggleActivityPlanSave(params.planId, userId, prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Activity Plan Save API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
