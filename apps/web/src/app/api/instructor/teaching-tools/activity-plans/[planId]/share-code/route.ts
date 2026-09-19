import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { generateShareCode, revokeShareCode } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/teaching-tools/activity-plans/[planId]/share-code
 * Generate (or return existing) share link code — owner only.
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

    const plan = await generateShareCode(params.planId, userId, prisma);
    return NextResponse.json({ shareCode: plan.shareCode });
  } catch (error) {
    console.error("[Activity Plan Share Code API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE — revoke the current share link (owner only). Existing copies made
 * from it are unaffected; the link itself stops working.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await revokeShareCode(params.planId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Activity Plan Share Code API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
