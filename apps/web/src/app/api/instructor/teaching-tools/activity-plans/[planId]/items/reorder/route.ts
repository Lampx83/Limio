import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { reorderActivityPlanItems } from "@feedbackme/core-lms";
import { publish } from "@/lib/realtime/publisher";
import { z } from "zod";

const ReorderSchema = z.object({
  orderedItemIds: z.array(z.string()).min(1),
});

/**
 * POST /api/instructor/teaching-tools/activity-plans/[planId]/items/reorder
 * Display-order only — does not affect which order events can be run live.
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

    const body = await req.json();
    const validation = ReorderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await reorderActivityPlanItems(
      params.planId,
      userId,
      validation.data.orderedItemIds,
      prisma
    );
    publish(`activity-plan:${params.planId}`, { type: "changed" }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Activity Plan Reorder API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
