import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { isValidMinutes, outlineWarnings } from "@/lib/limioLiveOutline";
import { sanitizeImportSource } from "@/lib/limioLivePptx";
import { aiFailure, buildImportOutline, isImportMode } from "@/lib/limioLivePptxServer";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/instructor/limio-live/decks/[deckId]/import-mode — body { mode: "keep" | "restructure", minutes? }
 * Bài nhập từ PowerPoint, ở bước Đối chiếu, đổi cách chuyển: dựng lại dàn ý từ dữ liệu đã đọc (LiveDeck.importSource), không
 * cần tải file lên lại. Dàn ý mới thay dàn ý cũ và huỷ xác nhận. Chỉ khi bài chưa có slide. Trả NDJSON như import-pptx:
 * ping* → {"type":"done","outline","warnings"} | {"type":"error","error","status"}.
 */
export async function POST(req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const deck = await prisma.liveDeck.findFirst({
    where: { id: params.deckId, userId },
    select: { id: true, title: true, outlineMinutes: true, importSource: true, sourceIntent: true, _count: { select: { slides: true } } },
  });
  const src = deck ? sanitizeImportSource(deck.importSource) : null;
  if (!deck || !src) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (deck._count.slides > 0) return NextResponse.json({ error: "deck_has_slides" }, { status: 409 });

  const body = (await readJson(req)) as { mode?: unknown; minutes?: unknown } | null;
  if (!isImportMode(body?.mode)) return NextResponse.json({ error: "validation_failed", details: "mode" }, { status: 400 });
  const mode = body.mode;
  const minutes = isValidMinutes(body.minutes) ? body.minutes : (deck.outlineMinutes ?? 30);

  // "Giữ ý" dùng AI chỉ để viết thêm slide tương tác: AI chưa cấu hình thì vẫn đổi được (tao-bai-giang-mot-o.md, M18).
  let openai: Awaited<ReturnType<typeof getOpenaiClient>> | null = null;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message !== "openai_not_configured") throw e;
    if (mode === "restructure") return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      try {
        let built;
        try {
          built = await buildImportOutline(userId, src, deck.title, minutes, mode, openai, deck.sourceIntent);
        } catch (e) {
          const f = aiFailure(e);
          if (f) return send({ type: "error", ...f });
          throw e;
        }
        if (!built.outline.slides.length) return send({ type: "error", error: "empty_outline", status: 502 });
        const warnings = [...built.warnings, ...outlineWarnings(built.outline, minutes).filter((w) => !built.warnings.includes(w))];
        await prisma.liveDeck.update({
          where: { id: deck.id },
          data: { outline: built.outline as unknown as object, outlineMinutes: minutes, outlineConfirmedAt: null },
        });
        await emitLiveEvent(userId, LearningEventType.LiveDeckOutlineGenerated, {
          deckId: deck.id,
          minutes,
          slideCount: built.outline.slides.length,
          sourceChars: 0,
          warningCount: warnings.length,
          sourceKind: "document",
          sourceFormat: "pptx",
          importMode: mode,
          hasIntent: !!deck.sourceIntent,
          interactionsAdded: built.interactionsAdded,
          importedSlides: src.slides.length,
        });
        send({ type: "done", outline: built.outline, warnings });
      } catch (e) {
        console.error("[Limio-Live import-mode]", e);
        send({ type: "error", error: "import_failed", status: 500 });
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
