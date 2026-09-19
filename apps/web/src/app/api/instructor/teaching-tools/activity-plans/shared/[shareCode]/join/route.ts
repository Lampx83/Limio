import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getPlanByShareCode, joinActivityPlanAsCollaborator } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/teaching-tools/activity-plans/shared/[shareCode]/join
 * Join as a collaborator (đồng biên soạn) — edits the shared original,
 * synced in real time. Only via the direct link, never from the public
 * marketplace listing alone.
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

    await joinActivityPlanAsCollaborator(source.id, userId, params.shareCode, prisma);
    return NextResponse.json({ ok: true, planId: source.id });
  } catch (error) {
    console.error("[Activity Plan Shared Join API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
