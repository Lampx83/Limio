import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@feedbackme/db";
import {
  createTimerTemplate,
  getUserTimerTemplates,
} from "@feedbackme/core-lms";
import { z } from "zod";

const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  durationSeconds: z.number().int().min(1, "Duration must be at least 1 second"),
  notes: z.string().optional(),
  musicId: z.string().optional(),
  courseId: z.string().optional(),
  isPublic: z.boolean().optional(),
});

/**
 * POST /api/instructor/teaching-tools/timer-templates
 * Create a new timer template
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = CreateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const template = await createTimerTemplate(
      {
        userId: session.user.id,
        ...validation.data,
      },
      prisma
    );

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("[Timer Templates API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instructor/teaching-tools/timer-templates
 * List user's timer templates
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await getUserTimerTemplates(
      session.user.id,
      { courseId, limit, offset },
      prisma
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Timer Templates API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
