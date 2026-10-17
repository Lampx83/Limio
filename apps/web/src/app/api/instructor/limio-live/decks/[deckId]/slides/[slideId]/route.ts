import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { updateLiveSlide, deleteLiveSlide, recordSlideVersion } from "@feedbackme/core-lms";
import { validateContentSlideConfig } from "@/lib/limioLiveResource";
import { mergeSlideMeta, normalizeContentSlideConfig, slideConfigsEqual } from "@/lib/limioLiveSlides";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { z } from "zod";

const UpdateSlideSchema = z.object({
  config: z.unknown().optional(),
  type: z.enum(["content", "quiz", "poll", "word_cloud"]).optional(),
  // "ai" khi giảng viên chấp nhận một đề xuất của AI: không tính là sửa tay.
  source: z.enum(["manual", "ai"]).optional(),
  // Hành động AI đã được chấp nhận (chỉ để đo lường).
  aiAction: z.string().max(40).optional(),
  timerSeconds: z.number().int().positive().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { deckId: string; slideId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdateSlideSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    if (validation.data.config !== undefined) {
      const resourceError = validateContentSlideConfig(validation.data.config);
      if (resourceError) {
        return NextResponse.json({ error: resourceError.error }, { status: 400 });
      }
    }

    // Lọc cấu hình ở máy chủ và giữ dấu vết AI / đánh dấu "đã sửa tay" (xem mergeSlideMeta).
    const { source, aiAction, ...rest } = validation.data;
    let data: typeof rest = rest;
    let existing: { type: "content" | "quiz" | "poll" | "word_cloud" | "collaborate_board" | "whiteboard"; config: unknown } | null = null;
    let flippedEdited = false;
    if (rest.config !== undefined && rest.config !== null && typeof rest.config === "object") {
      existing = await prisma.liveSlide.findFirst({ where: { id: params.slideId, deck: { userId } }, select: { type: true, config: true } });
      if (existing) {
        const normalized = (rest.type ?? existing.type) === "content" ? normalizeContentSlideConfig(rest.config) : rest.config;
        const merged = mergeSlideMeta(existing.config as Record<string, unknown> | null, normalized as Record<string, unknown>, {
          fromAi: source === "ai",
        });
        flippedEdited =
          merged.editedByUser === true && (existing.config as Record<string, unknown> | null)?.editedByUser !== true;
        data = { ...rest, config: merged };
      }
    }
    // Chụp trạng thái cũ trước khi ghi đè, chỉ khi nội dung hay loại slide thật sự đổi (H11).
    if (existing && data.config !== undefined) {
      const changed = !slideConfigsEqual(existing.config, data.config) || (data.type !== undefined && data.type !== existing.type);
      if (changed) await recordSlideVersion(prisma, { id: params.slideId, type: existing.type as never, config: existing.config }, source === "ai" ? "before_ai" : "before_edit");
    }
    const slide = await updateLiveSlide(
      params.slideId,
      userId,
      data,
      prisma
    );
    if (existing && source === "ai") {
      await emitLiveEvent(userId, LearningEventType.LiveSlideAiEditAccepted, {
        deckId: params.deckId,
        slideId: params.slideId,
        action: aiAction ?? null,
        slideType: slide.type,
      });
    }
    if (flippedEdited) {
      // Lần đầu giảng viên sửa tay một slide AI sinh: để đo tỉ lệ slide phải sửa sau khi sinh (H15).
      const oid = (slide.config as Record<string, unknown> | null)?.outlineId;
      await emitLiveEvent(userId, LearningEventType.LiveSlideEditedByUser, {
        deckId: params.deckId,
        slideId: params.slideId,
        slideType: slide.type,
        outlineId: typeof oid === "string" ? oid : null,
      });
    }
    return NextResponse.json(slide);
  } catch (error) {
    console.error("[Limio-Live Slide API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { deckId: string; slideId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteLiveSlide(params.slideId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Slide API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
