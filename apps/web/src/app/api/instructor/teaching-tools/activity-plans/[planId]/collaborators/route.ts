import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { listActivityPlanCollaborators } from "@feedbackme/core-lms";

/**
 * GET /api/instructor/teaching-tools/activity-plans/[planId]/collaborators
 * List co-authors — owner or any collaborator can view.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const collaborators = await listActivityPlanCollaborators(params.planId, userId, prisma);
    return NextResponse.json({ collaborators });
  } catch (error) {
    console.error("[Activity Plan Collaborators API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
