import { AiTutorError, generateSlideDrafts, type OutlineSlideInput } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { recordSlideVersion } from "@feedbackme/core-lms";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { requireFeature } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { generateDeckSlides, sectionNumbers, type SlideDraft } from "@/lib/limioLiveGenerate";
import { fillCoverIdentity, pickMeta } from "@/lib/limioLiveSlides";
import { coverIdentityFor } from "@/lib/limioLiveCoverIdentity";
import { planSync, type ExistingSlide } from "@/lib/limioLiveSync";
import { partLabel, sanitizeOutline, slideStructures } from "@/lib/limioLiveOutline";

export const runtime = "nodejs";
// Bài dài có thể cần vài lô nối tiếp, mỗi lô vài chục giây.
export const maxDuration = 300;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST /api/instructor/limio-live/decks/[deckId]/outline/generate
 * Sinh slide từ dàn ý ĐÃ ĐƯỢC XÁC NHẬN (tiêu chí L4/L5). Body { mode?: "sync" }: khi bài đã có slide,
 * "sync" cập nhật theo dàn ý (L6, H10): viết lại slide AI sinh chưa sửa, thêm slide cho dòng mới,
 * xoá slide của dòng đã bỏ; slide đã sửa tay và slide tự thêm luôn được giữ nguyên. Trả về luồng NDJSON để giao diện
 * hiện tiến độ: {type:"start",total} → {type:"progress",done,total}* → {type:"done",...}
 * hoặc {type:"error",error}. Slide chỉ được tạo khi mọi lô đã xong (không tạo nửa chừng);
 * hết hạn mức giữa chừng thì không tạo gì. Chỉ chạy với bài giảng CHƯA có slide: tạo lại
 * kèm giữ slide đã sửa tay thuộc bước sau.
 */
export async function POST(req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return json({ error: "forbidden" }, 403);

  const deck = await prisma.liveDeck.findFirst({
    where: { id: params.deckId, userId },
    select: { id: true, title: true, outline: true, outlineConfirmedAt: true, sourceText: true, _count: { select: { slides: true } } },
  });
  if (!deck || !deck.outline) return json({ error: "not_found" }, 404);
  if (!deck.outlineConfirmedAt) return json({ error: "outline_not_confirmed" }, 409);
  const body = (await req.json().catch(() => null)) as { mode?: unknown } | null;
  const sync = body?.mode === "sync";
  if (deck._count.slides > 0 && !sync) return json({ error: "deck_has_slides", details: { slideCount: deck._count.slides } }, 409);
  if (sync && deck._count.slides === 0) return json({ error: "deck_has_no_slides" }, 409);

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
    role: outline.parts.find((p) => p.id === s.partId)?.role,
    part: s.partId ? partLabel(outline, s.partId) : undefined,
  }));
  const deckTitle = outline.title || deck.title;
  // Bìa: tên đơn vị và người trình bày lấy từ tên trường và hồ sơ của giảng viên, AI không viết hai dòng này.
  const who = await coverIdentityFor(userId);
  const sourceText = deck.sourceText ?? "";

  const structures = slideStructures(outline);
  // Số mục theo thứ tự phần Nội dung (khớp mục lục của bìa phần); slide mở phần ngoài mạch thì đếm như cũ.
  const sectionNos = sectionNumbers(outline.slides).map((n, i) => structures[i]?.sectionNo ?? n);
  const existing: ExistingSlide[] = sync
    ? (
        await prisma.liveSlide.findMany({
          where: { deckId: deck.id },
          orderBy: { orderIndex: "asc" },
          select: { id: true, type: true, config: true },
        })
      ).map((s) => ({ id: s.id, type: s.type, config: (s.config ?? {}) as Record<string, unknown> }))
    : [];
  const plan = sync ? planSync(outline.slides, existing) : null;

  // Các dòng dàn ý cần viết: tất cả (lần đầu) hoặc chỉ dòng viết lại + dòng mới (cập nhật).
  const rowIdsToWrite = plan ? new Set([...plan.regenerate.map((r) => r.outlineId), ...plan.create]) : null;
  const writeIdx = outline.slides.map((_, i) => i).filter((i) => !rowIdsToWrite || rowIdsToWrite.has(outline.slides[i]!.id));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      // Một lô có thể mất hơn 60 giây; proxy phía trước cắt kết nối im lặng quá lâu, nên gửi nhịp giữ kết nối.
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      try {
        send({ type: "start", total: writeIdx.length });
        const result = await generateDeckSlides({
          outline: writeIdx.map((i) => outline.slides[i]!),
          sectionNos: writeIdx.map((i) => sectionNos[i]!),
          structures: writeIdx.map((i) => structures[i] ?? null),
          concurrency: 2,
          isFatal: (e) => e instanceof AiTutorError,
          onProgress: (done, total) => send({ type: "progress", done, total }),
          generateBatch: async (batch) => {
            const drafts = (await generateSlideDrafts(
              userId,
              { sourceText, deckTitle, outline: inputs, batch: batch.map((k) => writeIdx[k]!) },
              openai,
            )) as SlideDraft[];
            // generateDeckSlides đánh chỉ số theo phần được viết; mô hình trả chỉ số theo cả dàn ý.
            return drafts.map((d) => ({ ...d, index: writeIdx.indexOf(d.index) })).filter((d) => d.index >= 0);
          },
        });

        for (const s of result.slides) if (s.type === "content") s.config = fillCoverIdentity(s.config as Record<string, unknown>, who);
        const byOutlineId = new Map(writeIdx.map((i, k) => [outline.slides[i]!.id, result.slides[k]!]));

        await prisma.$transaction(async (tx) => {
          if (!plan) {
            // Lần đầu: kiểm tra lại là chưa có slide để hai lần bấm liền nhau không nhân đôi.
            if ((await tx.liveSlide.count({ where: { deckId: deck.id } })) > 0) throw new Error("deck_has_slides");
            for (const [i, s] of result.slides.entries()) {
              const row = await tx.liveSlide.create({
                data: { deckId: deck.id, type: s.type, config: s.config as object, orderIndex: i },
                select: { id: true, type: true, config: true },
              });
              // Bản AI sinh ban đầu luôn được giữ để giảng viên quay lại (H11).
              await recordSlideVersion(tx, row, "generated");
            }
            return;
          }
          const oldBy = new Map(existing.map((s) => [s.id, s]));
          for (const r of plan.regenerate) {
            const gen = byOutlineId.get(r.outlineId)!;
            const old = oldBy.get(r.slideId)!;
            // Giữ cờ ẩn và lựa chọn trang trí (hoa văn, kiểu bìa) của slide cũ: đổi chúng không tính là sửa tay nên slide
            // vẫn được viết lại. Ghi chú và nội dung lấy từ bản mới (slide này chưa được sửa tay).
            const { hidden, motif, coverStyle } = pickMeta(old.config);
            const keepHidden = { ...(hidden ? { hidden: true } : {}), ...(motif ? { motif } : {}), ...(coverStyle ? { coverStyle } : {}) };
            await recordSlideVersion(tx, { id: r.slideId, type: old.type as never, config: old.config }, "before_sync");
            const row = await tx.liveSlide.update({
              where: { id: r.slideId },
              data: { type: gen.type, config: { ...gen.config, ...keepHidden } as object },
              select: { id: true, type: true, config: true },
            });
            await recordSlideVersion(tx, row, "generated");
          }
          const createdId = new Map<string, string>();
          for (const outlineId of plan.create) {
            const gen = byOutlineId.get(outlineId)!;
            const row = await tx.liveSlide.create({
              data: { deckId: deck.id, type: gen.type, config: gen.config as object, orderIndex: 100000 },
              select: { id: true, type: true, config: true },
            });
            await recordSlideVersion(tx, row, "generated");
            createdId.set(outlineId, row.id);
          }
          if (plan.remove.length) await tx.liveSlide.deleteMany({ where: { id: { in: plan.remove }, deckId: deck.id } });
          for (const [i, e] of plan.order.entries()) {
            const id = e.kind === "slide" ? e.id : createdId.get(e.outlineId)!;
            await tx.liveSlide.update({ where: { id }, data: { orderIndex: i } });
          }
        });
        await emitLiveEvent(userId, LearningEventType.LiveDeckSlidesGenerated, {
          deckId: deck.id,
          mode: plan ? "sync" : "first",
          slideCount: plan ? plan.order.length : result.slides.length,
          fallbackCount: result.fallbackCount,
          ...(plan
            ? { regenerated: plan.regenerate.length, created: plan.create.length, removed: plan.remove.length, kept: plan.keep.length + plan.orphans.length }
            : {}),
        });
        send({
          type: "done",
          slideCount: plan ? plan.order.length : result.slides.length,
          fallbackCount: result.fallbackCount,
          ...(plan
            ? { regenerated: plan.regenerate.length, created: plan.create.length, removed: plan.remove.length, kept: plan.keep.length + plan.orphans.length }
            : {}),
        });
      } catch (e) {
        const code = e instanceof AiTutorError ? e.code : e instanceof Error && e.message === "deck_has_slides" ? "deck_has_slides" : "generate_failed";
        console.error("[Limio-Live generate]", e);
        send({ type: "error", error: code });
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
