import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { importCourseLessonsIntoDeck, MAX_IMPORT_LESSONS } from "@feedbackme/core-lms";
import { z } from "zod";

const ImportSchema = z.object({
  courseId: z.string().uuid(),
  lessonIds: z.array(z.string().uuid()).min(1).max(MAX_IMPORT_LESSONS),
});

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides/import-course
 * Các bài học được chọn (khoá giảng viên được sửa) → slide content nối vào
 * cuối bài giảng. Quyền kiểm ở core (canEditCourse + chủ deck).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const parsed = ImportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const slides = await importCourseLessonsIntoDeck(
      { deckId: params.deckId, userId, ...parsed.data },
      prisma
    );
    return NextResponse.json({ slides }, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Import Course API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
