import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, generateLessonOutline } from "@feedbackme/core-feedback";
import { LessonDraftError, getLessonDraft, updateLessonDraft } from "@feedbackme/core-lms";
import { isLessonTemplateKey } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { wordCount } from "@/lib/lessonSource";
import { normalizeLessonOutline } from "@/lib/lessonOutline";

export const runtime = "nodejs";
export const maxDuration = 120;

function draftError(e: unknown): NextResponse | null {
  if (!(e instanceof LessonDraftError)) return null;
  const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 409;
  return NextResponse.json({ error: e.code }, { status });
}

/**
 * POST — đổi mẫu bài: AI lập lại dàn ý từ tài liệu đã lưu trong bản nháp
 * (không phải tải lại tệp). Body: { template }. Dàn ý cũ bị thay và bỏ chốt;
 * cách viết, giao diện giữ nguyên. Luồng NDJSON như lúc tạo bản nháp:
 * {"type":"start"} {"type":"ping"}* rồi {"type":"done"} hoặc {"type":"error","error","status"}.
 */
export async function POST(req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const template = body?.template;
  if (!isLessonTemplateKey(template)) return NextResponse.json({ error: "validation_failed", details: "template" }, { status: 400 });

  let draft;
  try {
    draft = await getLessonDraft(userId, params.draftId);
  } catch (e) {
    const r = draftError(e);
    if (r) return r;
    throw e;
  }
  if (draft.status !== "outline") return NextResponse.json({ error: "invalid_state" }, { status: 409 });

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  const { sourceName, sourceParas: paras } = draft;
  const draftId = draft.id;
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
          raw = await generateLessonOutline(userId, { template, sourceName, paras, words: wordCount(paras) }, openai);
        } catch (e) {
          if (e instanceof AiTutorError) return fail(e.code, 429, e.details);
          if (e instanceof AiGenerationError) return fail(e.code, e.code === "validation_failed" ? 400 : 502, e.details);
          console.error("[lesson-draft reoutline]", e);
          return fail("generate_failed", 500);
        }
        const outline = normalizeLessonOutline(raw, paras, template);
        if (outline.lessons.length === 0) return fail("empty_outline", 502);
        await updateLessonDraft(userId, draftId, { outline });
        send({ type: "done" });
      } catch (e) {
        const known = e instanceof LessonDraftError;
        if (!known) console.error("[lesson-draft reoutline]", e);
        fail(known ? (e as LessonDraftError).code : "generate_failed", known ? 409 : 500);
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
