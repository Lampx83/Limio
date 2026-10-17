import { NextResponse } from "next/server";
import { AiTutorError, writeLessonSection, writeLessonSummary } from "@feedbackme/core-feedback";
import { LessonDraftError, getLessonDraft, saveLessonDraftResult } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { generateLessons, generationSteps } from "@/lib/lessonGenerate";

export const runtime = "nodejs";
// Một bài nhiều mục: vài lượt gọi mô hình song song, có thể mất vài phút.
export const maxDuration = 300;

/**
 * POST — AI viết bài theo dàn ý ĐÃ CHỐT (Mốc 3, T1–T9). Không ghi gì vào khoá học:
 * kết quả lưu trong bản nháp, giảng viên xem rồi mới "Áp dụng".
 * Luồng NDJSON: {"type":"start","total"} {"type":"progress","done","total","label","ok"}* {"type":"ping"}*
 * rồi {"type":"done","result"} hoặc {"type":"error","error","status"}.
 */
export async function POST(_req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let draft;
  try {
    draft = await getLessonDraft(userId, params.draftId);
  } catch (e) {
    if (e instanceof LessonDraftError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 404 });
    }
    throw e;
  }
  if (draft.status !== "outline") return NextResponse.json({ error: "invalid_state" }, { status: 409 });
  // Chỉ tạo bài từ dàn ý đã chốt (D7) — không có đường tắt.
  if (!draft.confirmedAt) return NextResponse.json({ error: "outline_not_confirmed" }, { status: 409 });

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  const input = {
    outline: draft.outline,
    paras: draft.sourceParas,
    writing: draft.writing,
    addObjectivesSummary: draft.addObjectivesSummary,
  };
  const draftId = draft.id;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      try {
        send({ type: "start", total: generationSteps(input) });
        const result = await generateLessons(
          input,
          {
            writeSection: (x) => writeLessonSection(userId, x, openai),
            writeSummary: (x) => writeLessonSummary(userId, x, openai),
            // Hết hạn mức / quá tải: dừng cả lượt, không ra bài dở với nửa số mục dự phòng.
            isFatal: (e) => e instanceof AiTutorError,
          },
          (p) => send({ type: "progress", ...p }),
        );
        await saveLessonDraftResult(userId, draftId, result);
        send({ type: "done", result });
      } catch (e) {
        if (e instanceof AiTutorError) send({ type: "error", error: e.code, status: 429, details: e.details });
        else if (e instanceof LessonDraftError) send({ type: "error", error: e.code, status: 409 });
        else {
          console.error("[lesson-draft generate]", e);
          send({ type: "error", error: "generate_failed", status: 500 });
        }
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
