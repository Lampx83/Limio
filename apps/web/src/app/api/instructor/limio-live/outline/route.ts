import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, OUTLINE_MAX_SOURCE_CHARS, OUTLINE_MIN_SOURCE_CHARS, generateLectureOutline } from "@feedbackme/core-feedback";
import { extractMaterialText } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { INTERACTIVE_EVERY, isValidMinutes, normalizeOutline, slideRange } from "@/lib/limioLiveOutline";

export const runtime = "nodejs";
// Một lần gọi mô hình có thể mất vài chục giây.
export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Văn bản tài liệu gốc lưu kèm bài giảng (để sinh lại một phần): đủ cho tài liệu dài. */
const MAX_STORED_SOURCE_CHARS = 120_000;

const MIME_BY_EXT: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};

function mimeOf(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt = MIME_BY_EXT[ext];
  if (byExt) return byExt;
  return Object.values(MIME_BY_EXT).includes(file.type) ? file.type : null;
}

/**
 * POST /api/instructor/limio-live/outline
 * multipart: `file` (docx/pdf/txt/md ≤ 10 MB) HOẶC `text` (dán thẳng), `minutes` (15|30|45).
 * Đọc tài liệu → AI đề xuất dàn ý → tạo bài giảng NHÁP kèm dàn ý. Chưa sinh slide nào;
 * giảng viên sửa dàn ý rồi mới sinh slide (xem decks/[deckId]/outline).
 * Bài giảng chỉ được tạo SAU khi AI trả lời được, nên lỗi AI không để lại bài rỗng. Kiểm tra đầu vào trả JSON
 * thường (4xx); phần gọi AI trả luồng NDJSON (xem bên dưới).
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
  if (!isValidMinutes(minutes)) {
    return NextResponse.json({ error: "validation_failed", details: "minutes" }, { status: 400 });
  }

  let sourceText: string | null = null;
  let sourceName = "Văn bản dán";
  const file = form.get("file");
  const pasted = form.get("text");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "file_too_large", details: { maxBytes: MAX_FILE_BYTES } }, { status: 413 });
    }
    const mime = mimeOf(file);
    if (!mime) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });
    sourceName = file.name.slice(0, 200);
    sourceText = await extractMaterialText(Buffer.from(await file.arrayBuffer()), mime);
    if (!sourceText) {
      // PDF scan ảnh hoặc file hỏng: nói rõ, không đoán thay.
      return NextResponse.json({ error: "no_text_in_file" }, { status: 422 });
    }
  } else if (typeof pasted === "string" && pasted.trim()) {
    sourceText = pasted.trim();
  } else {
    return NextResponse.json({ error: "validation_failed", details: "no_source" }, { status: 400 });
  }

  if (sourceText.length < OUTLINE_MIN_SOURCE_CHARS) {
    return NextResponse.json({ error: "source_too_short", details: { min: OUTLINE_MIN_SOURCE_CHARS } }, { status: 422 });
  }

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  const range = slideRange(minutes);
  const truncated = sourceText.length > OUTLINE_MAX_SOURCE_CHARS;
  const text = sourceText;
  const name = sourceName;

  // Từ đây trở đi là phần chậm (gọi mô hình, có thể hơn 60 giây). Trả luồng NDJSON có nhịp giữ kết nối để proxy
  // phía trước không cắt: ... {"type":"ping"}* rồi {"type":"done",...} hoặc {"type":"error","error","status"}.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      const fail = (error: string, status: number, details?: unknown) => send({ type: "error", error, status, details });
      try {
        send({ type: "start" });
        let raw;
        try {
          raw = await generateLectureOutline(
            userId,
            { sourceText: text, minutes, minSlides: range.min, maxSlides: range.max, interactiveEvery: INTERACTIVE_EVERY },
            openai,
          );
        } catch (e) {
          if (e instanceof AiTutorError) return fail(e.code, 429, e.details);
          if (e instanceof AiGenerationError) return fail(e.code, e.code === "validation_failed" ? 400 : 502, e.details);
          console.error("[Limio-Live outline]", e);
          return fail("generate_failed", 500);
        }

        const { outline, warnings } = normalizeOutline(raw, minutes);
        if (outline.slides.length === 0) return fail("empty_outline", 502);

        const deck = await prisma.liveDeck.create({
          data: {
            userId,
            title: (outline.title || name.replace(/\.[^.]+$/, "")).slice(0, 100) || "Bài giảng mới",
            theme: "brand",
            outline: outline as unknown as object,
            outlineMinutes: minutes,
            sourceName: name,
            sourceText: text.slice(0, MAX_STORED_SOURCE_CHARS),
          },
          select: { id: true },
        });
        await emitLiveEvent(userId, LearningEventType.LiveDeckOutlineGenerated, {
          deckId: deck.id,
          minutes,
          slideCount: outline.slides.length,
          sourceChars: text.length,
          warningCount: warnings.length,
        });
        send({ type: "done", deckId: deck.id, outline, warnings, truncated });
      } catch (e) {
        console.error("[Limio-Live outline]", e);
        fail("generate_failed", 500);
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
