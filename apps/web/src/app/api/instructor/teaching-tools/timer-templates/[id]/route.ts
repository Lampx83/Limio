import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import {
  getTimerTemplate,
  updateTimerTemplate,
  deleteTimerTemplate,
} from "@feedbackme/core-lms";
import { z } from "zod";

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  durationSeconds: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  musicId: z.string().optional(),
  courseId: z.string().optional(),
  isPublic: z.boolean().optional(),
});

/**
 * GET /api/instructor/teaching-tools/timer-templates/[id]
 * Get a specific timer template
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const template = await getTimerTemplate(
      params.id,
      session.user.id,
      prisma
    );

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Timer Template API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/instructor/teaching-tools/timer-templates/[id]
 * Update a timer template
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = UpdateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const template = await updateTimerTemplate(
      params.id,
      session.user.id,
      validation.data,
      prisma
    );

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Timer Template API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && message.includes("Not authorized") ? 403 : 500 }
    );
  }
}

/**
 * DELETE /api/instructor/teaching-tools/timer-templates/[id]
 * Delete a timer template
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await deleteTimerTemplate(
      params.id,
      session.user.id,
      prisma
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Timer Template API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && message.includes("Not authorized") ? 403 : 500 }
    );
  }
}
