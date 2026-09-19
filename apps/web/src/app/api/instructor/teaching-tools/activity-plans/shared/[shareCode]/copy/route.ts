import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getPlanByShareCode, copyActivityPlan } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/teaching-tools/activity-plans/shared/[shareCode]/copy
 * Copy a plan reached via its share link into the caller's own library.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { shareCode: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const source = await getPlanByShareCode(params.shareCode, prisma);
    if (!source) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const plan = await copyActivityPlan(
      source.id,
      userId,
      { shareCode: params.shareCode },
      prisma
    );
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("[Activity Plan Shared Copy API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
