import OpenAI from "openai";
import {
  AiTutorError,
  openAiChatCompute,
  openAiEmbedCompute,
  runOralExamTurn,
} from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { recordAnswered, recordStatus } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/**
 * A6.3 — 1 lượt vấn đáp. Body: { message?: string, forceEnd?: boolean } (bỏ
 * trống message cho lượt đầu). forceEnd = SV chủ động bấm "Kết thúc vấn đáp"
 * (xem runOralExamTurn — trước đây không có đường nào để đóng buổi ngoài hết
 * giờ/đủ câu hỏi).
 * SSE, cùng khuôn với /api/ai/tutor:
 *   event: delta data: "<text>"
 *   event: done  data: { ended, questionsAsked }
 *   event: error data: { code, details }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { message?: string; forceEnd?: boolean }
    | null;
  const studentMessage = body?.message?.trim() || null;
  const forceEnd = body?.forceEnd === true;

  let openaiKey: string;
  try {
    openaiKey = await getIntegrationSecret("openai");
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      return new Response(
        JSON.stringify({ error: "openai_not_configured" }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }
    throw e;
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${payload.replace(/\n/g, "\ndata: ")}\n\n`,
          ),
        );
      }

      try {
        const result = await runOralExamTurn({
          attemptId: params.attemptId,
          studentUserId: userId,
          studentMessage,
          forceEnd,
          computeChat: openAiChatCompute(openai),
          computeEmbed: openAiEmbedCompute(openai),
          onDelta: (delta) => send("delta", delta),
        });
        send("done", { ended: result.ended, questionsAsked: result.questionsAsked });
        // A6.5 — dashboard giám thị realtime. Best-effort, không chặn luồng
        // thi nếu Redis lỗi (đã enqueue "done" cho SV rồi).
        try {
          await recordAnswered(params.attemptId, `q${result.questionsAsked}`);
          if (result.ended) await recordStatus(params.attemptId, "submitted");
        } catch {
          // best-effort, xem comment ở trên
        }
      } catch (e) {
        if (e instanceof AiTutorError) {
          send("error", { code: e.code, details: e.details });
        } else {
          send("error", { code: "unknown", details: (e as Error).message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
