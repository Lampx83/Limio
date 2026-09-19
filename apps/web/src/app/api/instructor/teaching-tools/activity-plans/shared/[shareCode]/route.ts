import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getPlanByShareCode } from "@feedbackme/core-lms";

/**
 * GET /api/instructor/teaching-tools/activity-plans/shared/[shareCode]
 * View a plan via its share link — any authenticated instructor.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { shareCode: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const plan = await getPlanByShareCode(params.shareCode, prisma);
    if (!plan) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (error) {
    console.error("[Activity Plan Shared API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
