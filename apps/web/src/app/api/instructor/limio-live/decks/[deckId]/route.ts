import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getLiveDeck, updateLiveDeck, deleteLiveDeck, setLiveDeckGroup } from "@feedbackme/core-lms";
import { z } from "zod";
import { SLIDE_THEME_IDS } from "@/app/instructor/limio-live/slideThemes";
import { MOTIF_CHOICES } from "@/lib/limioLiveMotifs";
import { IMAGE_FRAMES } from "@/lib/limioLiveImageStyle";
import { BRAND_TEMPLATE_IDS, brandLogoFilename, sanitizeBrand, validateBrandInput } from "@/lib/limioLiveBrand";
import { withOrgBrand } from "@/lib/limioLiveBrandServer";
import { storageFor } from "@/lib/storage";
import { liveSlideImageKeyFromFilename } from "@/lib/storage-keys";

const UpdateDeckSchema = z.object({
  title: z.string().min(1, "Title is required").max(100).optional(),
  theme: z.enum(SLIDE_THEME_IDS).optional(),
  // null = bỏ khỏi nhóm
  groupId: z.string().uuid().nullable().optional(),
  // Thương hiệu: null = xoá; kiểm tra chặt bằng validateBrandInput (không dùng zod để báo đúng lỗi từng trường).
  brand: z.unknown().optional(),
  // true = bài này không dùng thương hiệu nào (kể cả của trường).
  brandOff: z.boolean().optional(),
  // Mẫu thương hiệu của trường cho bài này; null = mẫu mặc định của trường.
  brandTemplate: z.enum(BRAND_TEMPLATE_IDS).nullable().optional(),
  // Hoa văn trang trí của cả bài: null = tự động, "none" = không dùng, hoặc mã hoa văn chủ đạo.
  motif: z.enum(MOTIF_CHOICES).nullable().optional(),
  // Khung hình của các ô hình trong slide Chữ và hình: null = tự động theo hoa văn (docs/tieu-chi/chu-va-hinh-kieu-khung.md).
  imageFrame: z.enum(IMAGE_FRAMES).nullable().optional(),
});

/** Gỡ hoặc thay logo thì dọn tệp cũ (best-effort), trừ khi bài giảng khác (vd. bản sao) còn dùng chung tệp đó. */
async function cleanupOldLogo(oldUrl: unknown, newUrl: unknown, deckId: string): Promise<void> {
  const name = brandLogoFilename(oldUrl);
  if (!name || oldUrl === newUrl) return;
  const stillUsed = await prisma.liveDeck.count({
    where: { id: { not: deckId }, brand: { path: ["logoUrl"], equals: oldUrl as string } },
  });
  if (stillUsed > 0) return;
  const key = liveSlideImageKeyFromFilename(name);
  if (key) await storageFor(key).delete(key.key).catch(() => undefined);
}

/**
 * GET /api/instructor/limio-live/decks/[deckId]
 * Get a deck with its ordered slides
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const deck = await getLiveDeck(params.deckId, userId, prisma);
    if (!deck) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(await withOrgBrand(deck, userId));
  } catch (error) {
    console.error("[Limio-Live Deck API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdateDeckSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { groupId, brand: brandRaw, ...restFields } = validation.data;
    const rest: { title?: string; theme?: string; brand?: Record<string, unknown> | null; brandOff?: boolean; brandTemplate?: string | null; motif?: string | null; imageFrame?: string | null } = { ...restFields };
    let previousLogo: unknown;
    if (brandRaw !== undefined) {
      const v = validateBrandInput(brandRaw);
      if (!v.ok) return NextResponse.json({ error: "Invalid input", details: { brand: v.error } }, { status: 400 });
      const before = await prisma.liveDeck.findFirst({ where: { id: params.deckId, userId }, select: { brand: true } });
      previousLogo = sanitizeBrand(before?.brand)?.logoUrl;
      rest.brand = v.brand as Record<string, unknown> | null;
    }
    let deck = null;
    if (Object.keys(rest).length > 0) {
      deck = await updateLiveDeck(params.deckId, userId, rest, prisma);
      if (brandRaw !== undefined) await cleanupOldLogo(previousLogo, sanitizeBrand(deck.brand)?.logoUrl, params.deckId);
    }
    if (groupId !== undefined) {
      deck = await setLiveDeckGroup(params.deckId, userId, groupId, prisma);
    }
    if (!deck) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(deck);
  } catch (error) {
    console.error("[Limio-Live Deck API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteLiveDeck(params.deckId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Deck API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
