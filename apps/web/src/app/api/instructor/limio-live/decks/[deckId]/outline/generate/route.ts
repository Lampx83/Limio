import { AiTutorError, generateSlideDrafts, type OutlineSlideInput } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { recordSlideVersion } from "@feedbackme/core-lms";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { attachWebImages } from "@/lib/limioLiveWebImagesServer";
import { webImageCandidates } from "@/lib/limioLiveWebImages";
import { requireFeature } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { generateDeckSlides, sectionNumbers, type SlideDraft } from "@/lib/limioLiveGenerate";
import { fillCoverIdentity, pickMeta } from "@/lib/limioLiveSlides";
import { coverIdentityFor } from "@/lib/limioLiveCoverIdentity";
import { planSync, type ExistingSlide } from "@/lib/limioLiveSync";
import { motifAfterRegenerate } from "@/lib/limioLiveMotifs";
import { partLabel, resolveSourceKind, sanitizeOutline, sanitizeRefs, slideStructures } from "@/lib/limioLiveOutline";
import { firstSplitRows, importedSlideFor, sanitizeImportSource, withOriginalNotes } from "@/lib/limioLivePptx";
import { resolveDeckLanguage } from "@/lib/limioLiveLanguageServer";

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
    select: {
      id: true,
      title: true,
      outline: true,
      outlineConfirmedAt: true,
      sourceText: true,
      sourceIntent: true,
      sourceKind: true,
      sourceRefs: true,
      importSource: true,
      _count: { select: { slides: true } },
    },
  });
  if (!deck || !deck.outline) return json({ error: "not_found" }, 404);
  if (!deck.outlineConfirmedAt) return json({ error: "outline_not_confirmed" }, 409);
  const body = (await req.json().catch(() => null)) as { mode?: unknown } | null;
  const sync = body?.mode === "sync";
  if (deck._count.slides > 0 && !sync) return json({ error: "deck_has_slides", details: { slideCount: deck._count.slides } }, 409);
  if (sync && deck._count.slides === 0) return json({ error: "deck_has_no_slides" }, 409);

  const outline = sanitizeOutline(deck.outline);
  if (outline.slides.length === 0) return json({ error: "empty_outline" }, 400);

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
  // Nguồn của bài quyết định luật dùng số liệu, trích dẫn (câu lệnh) và cách kiểm bản nháp (draftToSlide).
  const sourceKind = resolveSourceKind(deck.sourceKind);
  // Ngôn ngữ của bài: AI viết slide mới và chữ hệ thống theo ngôn ngữ này (docs/tieu-chi/ngon-ngu-slide.md, L6).
  const language = await resolveDeckLanguage(deck.id);
  const context = { sourceKind, sourceText, refs: sanitizeRefs(deck.sourceRefs), lang: language };
  // Ảnh nguồn internet làm ứng viên cho AI chọn ở slide Chữ và hình (W8). Mã A1, A2… tính lại được y hệt ở bước gắn ảnh.
  const webImages =
    sourceKind === "topic_web"
      ? webImageCandidates(context.refs).map((c) => ({ id: c.id, description: c.image.alt, page: `[${c.ref.n}] ${c.ref.title}` }))
      : [];

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

  // Bài nhập từ PowerPoint: dòng lấy nguyên từ một slide gốc dựng thẳng từ dữ liệu đã đọc (không AI, giữ nguyên chữ).
  const importSource = sanitizeImportSource(deck.importSource);
  const imported = writeIdx.map((i) => importedSlideFor(outline.slides[i]!, importSource, sectionNos[i], language));
  const needsAi = writeIdx.some((i, k) => !imported[k] && !outline.slides[i]!.fixed);

  let openai: Awaited<ReturnType<typeof getOpenaiClient>> | null = null;
  if (needsAi) {
    try {
      openai = await getOpenaiClient();
    } catch (e) {
      if ((e as Error).message === "openai_not_configured") return json({ error: "openai_not_configured" }, 503);
      throw e;
    }
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      // Một lô có thể mất hơn 60 giây; proxy phía trước cắt kết nối im lặng quá lâu, nên gửi nhịp giữ kết nối.
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      try {
        // `ids`: các dòng dàn ý sẽ viết (O6): lưới "đang tạo" coi dòng ngoài danh sách là đã xong.
        send({ type: "start", total: writeIdx.length, ids: writeIdx.map((i) => outline.slides[i]!.id) });
        const result = await generateDeckSlides({
          outline: writeIdx.map((i) => outline.slides[i]!),
          sectionNos: writeIdx.map((i) => sectionNos[i]!),
          structures: writeIdx.map((i) => structures[i] ?? null),
          concurrency: 2,
          context,
          fixedSlide: (_os, k) => imported[k] ?? null,
          isFatal: (e) => e instanceof AiTutorError,
          onProgress: (done, total) => send({ type: "progress", done, total }),
          onSlide: (k) => send({ type: "slide", id: outline.slides[writeIdx[k]!]!.id }),
          generateBatch: async (batch) => {
            if (!openai) throw new Error("openai_not_configured");
            const drafts = (await generateSlideDrafts(
              userId,
              {
                sourceText,
                sourceKind,
                deckTitle,
                outline: inputs,
                batch: batch.map((k) => writeIdx[k]!),
                webImages,
                language,
                // Yêu cầu của giảng viên đi cùng tài liệu (tao-bai-giang-mot-o.md, M9).
                ...(deck.sourceIntent ? { intent: deck.sourceIntent } : {}),
              },
              openai,
            )) as SlideDraft[];
            // generateDeckSlides đánh chỉ số theo phần được viết; mô hình trả chỉ số theo cả dàn ý.
            return drafts.map((d) => ({ ...d, index: writeIdx.indexOf(d.index) })).filter((d) => d.index >= 0);
          },
        });

        // Bài nhập từ PowerPoint: slide gộp/tách do AI viết nhận ghi chú giảng gốc nguyên chữ (AI không viết lại ghi chú).
        if (importSource) {
          const firstSplit = firstSplitRows(outline.slides);
          result.slides = result.slides.map((g, k) => {
            const row = outline.slides[writeIdx[k]!]!;
            return withOriginalNotes(g, row, importSource, firstSplit.has(row.id));
          });
        }
        for (const s of result.slides) if (s.type === "content") s.config = fillCoverIdentity(s.config as Record<string, unknown>, who);
        // Bài có nguồn internet: gắn ảnh AI đã chọn (lấy từ chính trang nguồn) vào slide Chữ và hình, kèm dòng ghi nguồn. Ảnh nào lỗi thì
        // slide đó giữ hình tự vẽ; không bao giờ làm hỏng việc tạo slide (docs/tieu-chi/nguon-web-link-anh.md, W8–W13).
        let webImageCount = 0;
        if (sourceKind === "topic_web" && context.refs.some((r) => r.images?.length)) {
          send({ type: "images" });
          webImageCount = await attachWebImages(userId, result.slides, context.refs).catch((e) => {
            console.error("[Limio-Live web images]", e);
            return 0;
          });
        }
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
            // Giữ cờ ẩn và kiểu bìa của slide cũ: đổi chúng không tính là sửa tay nên slide vẫn được viết lại. Hoa văn/hình
            // minh hoạ theo motifAfterRegenerate. Ghi chú và nội dung lấy từ bản mới (slide này chưa được sửa tay).
            const oldMeta = pickMeta(old.config);
            const keepHidden = {
              ...(oldMeta.hidden ? { hidden: true } : {}),
              ...(oldMeta.coverStyle ? { coverStyle: oldMeta.coverStyle } : {}),
              // Kiểu trình bày và khung hình của Chữ và hình do giảng viên chọn (chu-va-hinh-kieu-khung.md, K2).
              ...(oldMeta.imageStyle ? { imageStyle: oldMeta.imageStyle } : {}),
              ...(oldMeta.imageFrame ? { imageFrame: oldMeta.imageFrame } : {}),
            };
            const keepMotif = motifAfterRegenerate(oldMeta.motif, gen.config.motif);
            await recordSlideVersion(tx, { id: r.slideId, type: old.type as never, config: old.config }, "before_sync");
            const row = await tx.liveSlide.update({
              where: { id: r.slideId },
              data: { type: gen.type, config: { ...gen.config, ...keepHidden, ...(keepMotif ? { motif: keepMotif } : {}) } as object },
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
          ...(sourceKind === "topic_web" ? { webImageCount } : {}),
          language,
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
