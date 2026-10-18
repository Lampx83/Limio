import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { isValidMinutes, outlineBlockingProblems, outlineWarnings, sanitizeOutline, type Outline } from "@/lib/limioLiveOutline";
import { planSync, syncIsNoop, syncSummary } from "@/lib/limioLiveSync";

export const runtime = "nodejs";

async function ownedDeck(deckId: string, userId: string) {
  return prisma.liveDeck.findFirst({
    where: { id: deckId, userId },
    select: {
      id: true,
      title: true,
      outline: true,
      outlineMinutes: true,
      outlineConfirmedAt: true,
      sourceName: true,
      sourceText: true,
      slides: { orderBy: { orderIndex: "asc" as const }, select: { id: true, type: true, config: true } },
    },
  });
}

function syncState(outline: Outline, slides: Array<{ id: string; type: string; config: unknown }>) {
  const plan = planSync(
    sanitizeOutline(outline).slides,
    slides.map((s) => ({ id: s.id, type: s.type, config: (s.config ?? {}) as Record<string, unknown> })),
  );
  return { ...syncSummary(plan), noop: syncIsNoop(plan, slides.map((s) => s.id)) };
}

function view(deck: NonNullable<Awaited<ReturnType<typeof ownedDeck>>>) {
  // Luôn qua sanitizeOutline: dàn ý tạo trước khi có mạch cấu trúc được tự chia phần khi mở.
  const outline: Outline | null = deck.outline ? sanitizeOutline(deck.outline) : null;
  const minutes = deck.outlineMinutes ?? 30;
  return {
    deckId: deck.id,
    title: deck.title,
    sourceName: deck.sourceName,
    minutes,
    outline,
    confirmedAt: deck.outlineConfirmedAt,
    sourceChars: deck.sourceText?.length ?? 0,
    slideCount: deck.slides.length,
    // Khi bài đã có slide: việc "cập nhật theo dàn ý" sẽ làm gì (slide đã sửa tay luôn được giữ).
    sync: outline && deck.slides.length ? syncState(outline, deck.slides) : null,
    warnings: outline ? outlineWarnings(outline, minutes) : [],
  };
}

/** GET: dàn ý của bài giảng (chỉ chủ bài giảng). 404 nếu bài soạn tay, không có dàn ý. */
export async function GET(_req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const deck = await ownedDeck(params.deckId, userId);
  if (!deck || !deck.outline) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(view(deck));
}

/**
 * PUT: lưu dàn ý do giảng viên sửa. KHÔNG gọi AI, không tốn token (tiêu chí L7).
 * Body: { outline, minutes?, confirm? }. Sửa dàn ý luôn huỷ xác nhận cũ; `confirm: true`
 * ghi nhận giảng viên đã xem và xác nhận dàn ý vừa gửi (chỉ khi không có lỗi chặn).
 */
export async function PUT(req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const deck = await ownedDeck(params.deckId, userId);
  if (!deck || !deck.outline) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await readJson(req)) as { outline?: unknown; minutes?: unknown; confirm?: unknown } | null;
  if (!body || body.outline === undefined) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const outline = sanitizeOutline(body.outline);
  const minutes = isValidMinutes(body.minutes) ? body.minutes : deck.outlineMinutes ?? 30;

  let confirmedAt: Date | null = null;
  if (body.confirm === true) {
    const problems = outlineBlockingProblems(outline);
    if (problems.length) return NextResponse.json({ error: "outline_invalid", details: problems }, { status: 400 });
    confirmedAt = new Date();
  }

  const updated = await prisma.liveDeck.update({
    where: { id: deck.id },
    data: { outline: outline as unknown as object, outlineMinutes: minutes, outlineConfirmedAt: confirmedAt },
    select: {
      id: true,
      title: true,
      outline: true,
      outlineMinutes: true,
      outlineConfirmedAt: true,
      sourceName: true,
      sourceText: true,
      slides: { orderBy: { orderIndex: "asc" as const }, select: { id: true, type: true, config: true } },
    },
  });
  return NextResponse.json(view(updated));
}
