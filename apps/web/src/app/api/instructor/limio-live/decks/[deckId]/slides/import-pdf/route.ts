import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { addLiveSlidesBulk } from "@feedbackme/core-lms";
import { z } from "zod";

// Giới hạn khớp phía client (LiveDeckEditor rasterize PDF bằng pdfjs-dist):
// PDF gốc ≤10MB, ≤30 trang. Ở đây chỉ còn nhận URL ảnh đã upload từng trang
// (qua /api/instructor/limio-live/slide-images), nên chỉ cần chặn số lượng.
const MAX_PAGES = 30;

const ImportSchema = z.object({
  imageUrls: z.array(z.string().min(1)).min(1).max(MAX_PAGES),
});

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides/import-pdf
 * Mỗi URL ảnh (1 trang PDF đã rasterize + upload ở client) → 1 slide content
 * full-bleed (không tiêu đề/ý — xem ContentSlideView).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = ImportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const slides = await addLiveSlidesBulk(
      params.deckId,
      userId,
      validation.data.imageUrls.map((imageUrl) => ({
        type: "content" as const,
        config: { imageUrl },
      })),
      prisma
    );

    return NextResponse.json({ slides }, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Import PDF API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
