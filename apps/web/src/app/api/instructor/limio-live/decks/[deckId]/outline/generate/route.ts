import { AiTutorError, generateSlideDrafts, type OutlineSlideInput } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { generateDeckSlides, type SlideDraft } from "@/lib/limioLiveGenerate";
import { sanitizeOutline } from "@/lib/limioLiveOutline";

export const runtime = "nodejs";
// Bài dài có thể cần vài lô nối tiếp, mỗi lô vài chục giây.
export const maxDuration = 300;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST /api/instructor/limio-live/decks/[deckId]/outline/generate
 * Sinh slide từ dàn ý ĐÃ ĐƯỢC XÁC NHẬN (tiêu chí L4/L5). Trả về luồng NDJSON để giao diện
 * hiện tiến độ: {type:"start",total} → {type:"progress",done,total}* → {type:"done",...}
 * hoặc {type:"error",error}. Slide chỉ được tạo khi mọi lô đã xong (không tạo nửa chừng);
 * hết hạn mức giữa chừng thì không tạo gì. Chỉ chạy với bài giảng CHƯA có slide: tạo lại
 * kèm giữ slide đã sửa tay thuộc bước sau.
 */
export async function POST(_req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return json({ error: "forbidden" }, 403);

  const deck = await prisma.liveDeck.findFirst({
    where: { id: params.deckId, userId },
    select: { id: true, title: true, outline: true, outlineConfirmedAt: true, sourceText: true, _count: { select: { slides: true } } },
  });
  if (!deck || !deck.outline) return json({ error: "not_found" }, 404);
  if (!deck.outlineConfirmedAt) return json({ error: "outline_not_confirmed" }, 409);
  if (deck._count.slides > 0) return json({ error: "deck_has_slides", details: { slideCount: deck._count.slides } }, 409);

  const outline = sanitizeOutline(deck.outline);
  if (outline.slides.length === 0) return json({ error: "empty_outline" }, 400);

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return json({ error: "openai_not_configured" }, 503);
    throw e;
  }

  const inputs: OutlineSlideInput[] = outline.slides.map((s, index) => ({
    index,
    kind: s.kind,
    layout: s.layout,
    title: s.title,
    points: s.points,
  }));
  const deckTitle = outline.title || deck.title;
  const sourceText = deck.sourceText ?? "";

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        send({ type: "start", total: inputs.length });
        const result = await generateDeckSlides({
          outline: outline.slides,
          concurrency: 2,
          isFatal: (e) => e instanceof AiTutorError,
          onProgress: (done, total) => send({ type: "progress", done, total }),
          generateBatch: (batch) =>
            generateSlideDrafts(userId, { sourceText, deckTitle, outline: inputs, batch }, openai) as Promise<SlideDraft[]>,
        });

        // Tạo slide trong một giao dịch; kiểm tra lại là chưa có slide để hai lần bấm liền nhau không nhân đôi.
        await prisma.$transaction(async (tx) => {
          if ((await tx.liveSlide.count({ where: { deckId: deck.id } })) > 0) throw new Error("deck_has_slides");
          await tx.liveSlide.createMany({
            data: result.slides.map((s, i) => ({ deckId: deck.id, type: s.type, config: s.config as object, orderIndex: i })),
          });
        });
        send({ type: "done", slideCount: result.slides.length, fallbackCount: result.fallbackCount });
      } catch (e) {
        const code = e instanceof AiTutorError ? e.code : e instanceof Error && e.message === "deck_has_slides" ? "deck_has_slides" : "generate_failed";
        console.error("[Limio-Live generate]", e);
        send({ type: "error", error: code });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
