import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { updateActivityPlanItem, deleteActivityPlanItem } from "@feedbackme/core-lms";
import { publish } from "@/lib/realtime/publisher";
import { z } from "zod";

const UpdateItemSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  config: z.unknown().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string; itemId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdateItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const item = await updateActivityPlanItem(
      params.itemId,
      userId,
      validation.data,
      prisma
    );
    publish(`activity-plan:${params.planId}`, { type: "changed" }).catch(() => {});
    return NextResponse.json(item);
  } catch (error) {
    console.error("[Activity Plan Item API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string; itemId: string } }
) {
  try {
    const userId = await requireFeature("teaching_tools.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteActivityPlanItem(params.itemId, userId, prisma);
    publish(`activity-plan:${params.planId}`, { type: "changed" }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Activity Plan Item API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
