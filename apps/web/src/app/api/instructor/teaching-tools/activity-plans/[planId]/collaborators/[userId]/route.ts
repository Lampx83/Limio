import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import {
  leaveActivityPlanCollaboration,
  removeActivityPlanCollaborator,
} from "@feedbackme/core-lms";

/**
 * DELETE /api/instructor/teaching-tools/activity-plans/[planId]/collaborators/[userId]
 * Self-removal ("Rời khỏi") when userId === caller; owner-only when removing
 * someone else.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string; userId: string } }
) {
  try {
    const callerId = await requireFeature("teaching_tools.access");
    if (!callerId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (params.userId === callerId) {
      await leaveActivityPlanCollaboration(params.planId, callerId, prisma);
    } else {
      await removeActivityPlanCollaborator(params.planId, callerId, params.userId, prisma);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Activity Plan Collaborators API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
