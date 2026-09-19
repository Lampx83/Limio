import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import {
  getActivityPlan,
  updateActivityPlan,
  deleteActivityPlan,
  setPlanVisibility,
} from "@feedbackme/core-lms";
import { publish } from "@/lib/realtime/publisher";
import { z } from "zod";

const UpdatePlanSchema = z.object({
  title: z.string().min(1, "Title is required").max(100).optional(),
  isPublic: z.boolean().optional(),
});

/**
 * GET /api/instructor/teaching-tools/activity-plans/[planId]
 * Get a plan with its ordered items
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

    const plan = await getActivityPlan(params.planId, userId, prisma);
    if (!plan) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("[Activity Plan API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdatePlanSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    let plan;
    if (validation.data.title !== undefined) {
      plan = await updateActivityPlan(params.planId, userId, { title: validation.data.title }, prisma);
    }
    if (validation.data.isPublic !== undefined) {
      plan = await setPlanVisibility(params.planId, userId, validation.data.isPublic, prisma);
    }
    if (!plan) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    publish(`activity-plan:${params.planId}`, { type: "changed" }).catch(() => {});
    return NextResponse.json(plan);
  } catch (error) {
    console.error("[Activity Plan API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteActivityPlan(params.planId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Activity Plan API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
