import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { addActivityPlanItem } from "@feedbackme/core-lms";
import { publish } from "@/lib/realtime/publisher";
import { z } from "zod";

const CreateItemSchema = z.object({
  toolType: z.enum([
    "random_picker",
    "quick_poll",
    "word_cloud",
    "grouping_tool",
    "countdown_timer",
    "whiteboard",
  ]),
  label: z.string().min(1, "Label is required").max(100),
  config: z.unknown().optional(),
});

/**
 * POST /api/instructor/teaching-tools/activity-plans/[planId]/items
 * Add an event to a plan (appended at the end)
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
    const validation = CreateItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const item = await addActivityPlanItem(
      params.planId,
      userId,
      validation.data,
      prisma
    );
    publish(`activity-plan:${params.planId}`, { type: "changed" }).catch(() => {});
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("[Activity Plan Items API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
