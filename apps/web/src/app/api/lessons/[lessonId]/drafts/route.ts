import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, LESSON_OUTLINE_MIN_CHARS, generateLessonOutline } from "@feedbackme/core-feedback";
import {
  LessonDraftError,
  assertCanEditLesson,
  createLessonDraft,
  extractMaterialText,
  getActiveLessonDraftId,
} from "@feedbackme/core-lms";
import { DEFAULT_LESSON_LOOK, isLessonTemplateKey, type SourcePara } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { convertDocxToHtml } from "@/lib/docxToHtml";
import { htmlToParas, textToParas, wordCount } from "@/lib/lessonSource";
import { normalizeLessonOutline } from "@/lib/lessonOutline";

export const runtime = "nodejs";
// Một lần gọi mô hình có thể mất vài chục giây.
export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const KIND_BY_EXT: Record<string, { kind: "docx" | "pdf" | "txt" | "md"; mime: string }> = {
  docx: { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pdf: { kind: "pdf", mime: "application/pdf" },
  txt: { kind: "txt", mime: "text/plain" },
  md: { kind: "md", mime: "text/markdown" },
};

function draftError(e: unknown): NextResponse | null {
  if (!(e instanceof LessonDraftError)) return null;
  const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 409;
  return NextResponse.json({ error: e.code }, { status });
}

/** GET — bản nháp đang mở của chính người dùng cho bài này (để quay lại làm tiếp). */
export async function GET(_req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ draftId: await getActiveLessonDraftId(userId, params.lessonId) });
  } catch (e) {
    const r = draftError(e);
    if (r) return r;
    throw e;
  }
}

/**
 * POST — "Tạo bài từ tài liệu", bước Tài liệu → Dàn ý.
 * multipart: `file` (.docx/.pdf/.txt/.md ≤ 10 MB) HOẶC `text` (dán thẳng), kèm
 * `template` (theory | practice | review — mẫu bài, mặc định theory).
 * Tách tài liệu thành đoạn (ảnh trong Word được giữ, tải lên kho ảnh bài học),
 * AI đề xuất dàn ý, rồi mới tạo bản nháp — lỗi AI không để lại bản nháp rỗng.
 * Kiểm tra đầu vào trả JSON 4xx; phần gọi AI trả luồng NDJSON có nhịp giữ kết nối:
 * {"type":"start"} {"type":"stage","stage":"reading"|"outlining"} {"type":"ping"}* rồi
 * {"type":"done","draftId","warnings"} hoặc {"type":"error","error","status"}.
 */
export async function POST(req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditLesson(userId, params.lessonId);
  } catch (e) {
    const r = draftError(e);
    if (r) return r;
    throw e;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const rawTemplate = form.get("template");
  const template = isLessonTemplateKey(rawTemplate) ? rawTemplate : "theory";
  const warnings: string[] = [];
  let paras: SourcePara[];
  let sourceName = "Văn bản dán";
  let sourceKind = "paste";
  const file = form.get("file");
  const pasted = form.get("text");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "file_too_large", details: { maxBytes: MAX_FILE_BYTES } }, { status: 413 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const kind = KIND_BY_EXT[ext];
    if (!kind) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });
    sourceName = file.name.slice(0, 200);
    sourceKind = kind.kind;
    const buf = Buffer.from(await file.arrayBuffer());
    if (kind.kind === "docx") {
      try {
        const converted = await convertDocxToHtml(buf, userId);
        paras = htmlToParas(converted.html);
        warnings.push(...converted.warnings);
      } catch (e) {
        console.error("[lesson-draft] docx convert failed", e);
        return NextResponse.json({ error: "convert_failed" }, { status: 400 });
      }
    } else {
      const text = await extractMaterialText(buf, kind.mime);
      // PDF chụp ảnh (không có lớp chữ) hoặc tệp hỏng: nói rõ, không đoán thay.
      if (!text) return NextResponse.json({ error: "no_text_in_file" }, { status: 422 });
      paras = textToParas(text, { reflow: kind.kind === "pdf" });
      if (kind.kind === "pdf") warnings.push("Tệp PDF chỉ lấy được chữ; ảnh trong PDF (nếu có) chưa đưa vào bài được.");
    }
  } else if (typeof pasted === "string" && pasted.trim()) {
    paras = textToParas(pasted);
  } else {
    return NextResponse.json({ error: "validation_failed", details: "no_source" }, { status: 400 });
  }

  const textChars = paras.reduce((n, p) => n + ("t" in p ? p.t.length : 0), 0);
  if (textChars < LESSON_OUTLINE_MIN_CHARS) {
    return NextResponse.json({ error: "source_too_short", details: { min: LESSON_OUTLINE_MIN_CHARS } }, { status: 422 });
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

  const lessonId = params.lessonId;
  const name = sourceName;
  const kind = sourceKind;
  const words = wordCount(paras);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      const fail = (error: string, status: number, details?: unknown) => send({ type: "error", error, status, details });
      try {
        send({ type: "start", paraCount: paras.length, words });
        send({ type: "stage", stage: "outlining" });
        let raw;
        try {
          raw = await generateLessonOutline(userId, { template, sourceName: name, paras, words }, openai);
        } catch (e) {
          if (e instanceof AiTutorError) return fail(e.code, 429, e.details);
          if (e instanceof AiGenerationError) return fail(e.code, e.code === "validation_failed" ? 400 : 502, e.details);
          console.error("[lesson-draft outline]", e);
          return fail("generate_failed", 500);
        }
        const outline = normalizeLessonOutline(raw, paras, template);
        if (outline.lessons.length === 0) return fail("empty_outline", 502);
        const draft = await createLessonDraft(userId, lessonId, {
          sourceName: name,
          sourceKind: kind,
          sourceParas: paras,
          outline,
          look: DEFAULT_LESSON_LOOK,
        });
        send({ type: "done", draftId: draft.id, warnings });
      } catch (e) {
        console.error("[lesson-draft]", e);
        fail("generate_failed", 500);
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
