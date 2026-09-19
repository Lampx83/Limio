import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { createActivityPlan, getUserActivityPlans } from "@feedbackme/core-lms";
import { z } from "zod";

const CreatePlanSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
});

/**
 * GET /api/instructor/teaching-tools/activity-plans
 * List the current instructor's activity plans (personal library)
 */
export async function GET() {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const plans = await getUserActivityPlans(userId, prisma);
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("[Activity Plans API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/instructor/teaching-tools/activity-plans
 * Create a new (empty) activity plan
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = CreatePlanSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const plan = await createActivityPlan(
      { userId, title: validation.data.title },
      prisma
    );

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("[Activity Plans API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
