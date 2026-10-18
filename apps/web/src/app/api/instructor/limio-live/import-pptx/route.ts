import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { saveBoardImage } from "@/lib/boardImage";
import { getOpenaiClient } from "@/lib/openaiClient";
import { liveSlideImageKey } from "@/lib/storage-keys";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { isValidMinutes, outlineWarnings } from "@/lib/limioLiveOutline";
import { PPTX_MAX_BYTES, parsePptx, pptxErrorCode } from "@/lib/pptxImport";
import { importSourceText, slidesNeedingImage, toImportedSlide, type ImportSource, type ImportedSlide } from "@/lib/limioLivePptx";
import { aiFailure, buildImportOutline, isImportMode } from "@/lib/limioLivePptxServer";

export const runtime = "nodejs";
// File 50 MB với vài chục hình (sharp) cộng một lần gọi AI khi soạn lại mạch.
export const maxDuration = 300;

/** Văn bản lưu kèm bài (như luồng tài liệu). */
const MAX_STORED_SOURCE_CHARS = 120_000;

/**
 * POST /api/instructor/limio-live/import-pptx
 * multipart: `file` (.pptx ≤ 50 MB), `minutes` (15|30|45), `mode` ("keep" | "restructure").
 * Máy chủ đọc lại file (không tin kết quả xem trước của trình duyệt), lưu các hình được dùng, dựng dàn ý theo cách đã chọn
 * ("restructure" gọi AI) rồi tạo bài giảng NHÁP kèm dàn ý (chưa có slide). Kiểm tra đầu vào trả JSON thường (4xx); phần xử
 * lý trả luồng NDJSON: {"type":"start","images":n} → {"type":"progress","done","total"}* → {"type":"ai"}? →
 * {"type":"done","deckId","outline","warnings","images":{số slide: url}} | {"type":"error","error","status"}.
 * Bài chỉ được tạo sau khi AI trả lời được, nên lỗi AI không để lại bài rỗng (hình đã lưu thì để bộ dọn file mồ côi xử lý).
 * Tiêu chí: docs/tieu-chi/nhap-powerpoint.md.
 */
export async function POST(req: Request) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const minutes = Number(form.get("minutes"));
  if (!isValidMinutes(minutes)) return NextResponse.json({ error: "validation_failed", details: "minutes" }, { status: 400 });
  const mode = form.get("mode") ?? "keep";
  if (!isImportMode(mode)) return NextResponse.json({ error: "validation_failed", details: "mode" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  const fileName = file.name.slice(0, 200);
  if (/\.ppt$/i.test(fileName)) return NextResponse.json({ error: "legacy_ppt" }, { status: 415 });
  if (!/\.pptx$/i.test(fileName)) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });
  if (file.size > PPTX_MAX_BYTES) return NextResponse.json({ error: "file_too_large", details: { maxBytes: PPTX_MAX_BYTES } }, { status: 413 });

  let parsed: Awaited<ReturnType<typeof parsePptx>>;
  try {
    parsed = await parsePptx(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: pptxErrorCode(e, fileName) }, { status: 422 });
  }
  const { deck: pptx, media } = parsed;

  let openai: Awaited<ReturnType<typeof getOpenaiClient>> | null = null;
  if (mode === "restructure") {
    try {
      openai = await getOpenaiClient();
    } catch (e) {
      if ((e as Error).message === "openai_not_configured") return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
      throw e;
    }
  }

  // Chỉ lưu hình được dùng (hình lớn nhất của slide có bố cục chứa hình), để không tốn dung lượng cho hình không hiện.
  const needImage = slidesNeedingImage(pptx.slides);
  const total = needImage.filter(Boolean).length;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      try {
        send({ type: "start", images: total });
        const slides: ImportedSlide[] = [];
        const images: Record<number, string> = {};
        let done = 0;
        for (const [i, s] of pptx.slides.entries()) {
          let url: string | null = null;
          if (needImage[i]) {
            const bytes = await media(s.images[0]!.target);
            const saved = bytes ? await saveBoardImage(userId, Buffer.from(bytes), liveSlideImageKey) : null;
            if (saved) {
              url = `/api/limio-live-media/${saved.filename}`;
              images[s.n] = url;
            }
            done += 1;
            send({ type: "progress", done, total });
          }
          slides.push(toImportedSlide(s, url));
        }

        const title = (pptx.slides[0]?.title || fileName.replace(/\.pptx$/i, "")).slice(0, 100) || "Bài giảng mới";
        const source: ImportSource = { format: "pptx", fileName, slides };
        if (mode === "restructure") send({ type: "ai" });
        let built;
        try {
          built = await buildImportOutline(userId, source, title, minutes, mode, openai);
        } catch (e) {
          const f = aiFailure(e);
          if (f) return send({ type: "error", ...f });
          throw e;
        }
        const { outline } = built;
        if (!outline.slides.length) return send({ type: "error", error: "empty_outline", status: 502 });
        const text = importSourceText(source);
        const warnings = [...built.warnings, ...outlineWarnings(outline, minutes).filter((w) => !built.warnings.includes(w))];

        const deck = await prisma.liveDeck.create({
          data: {
            userId,
            title: (outline.title || title).slice(0, 100),
            theme: "brand",
            outline: outline as unknown as object,
            outlineMinutes: minutes,
            sourceName: fileName,
            sourceText: text.slice(0, MAX_STORED_SOURCE_CHARS),
            sourceKind: "document",
            importSource: source as unknown as object,
          },
          select: { id: true },
        });
        await emitLiveEvent(userId, LearningEventType.LiveDeckOutlineGenerated, {
          deckId: deck.id,
          minutes,
          slideCount: outline.slides.length,
          sourceChars: text.length,
          warningCount: warnings.length,
          sourceKind: "document",
          sourceFormat: "pptx",
          importMode: mode,
          importedSlides: slides.length,
          imageCount: Object.keys(images).length,
        });
        send({ type: "done", deckId: deck.id, outline, warnings, images });
      } catch (e) {
        console.error("[Limio-Live import-pptx]", e);
        send({ type: "error", error: "import_failed", status: 500 });
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
