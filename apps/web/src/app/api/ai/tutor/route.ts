import OpenAI from "openai";
import {
  AiTutorError,
  getOrCreateConversation,
  runChatTurn,
} from "@feedbackme/core-feedback";
import {
  getIntegrationSecret,
  IntegrationError,
  isUserEnrolled,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * AI Tutor streaming endpoint. Body: { lessonId, message, conversationId? }.
 * Returns Server-Sent Events:
 *   event: meta  data: { conversationId }
 *   event: delta data: "<text>"
 *   event: done  data: { tokensInput, tokensOutput, costUsd }
 *   event: error data: { code, details }
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { lessonId?: string; message?: string; conversationId?: string }
    | null;
  if (!body?.lessonId || !body?.message) {
    return new Response(
      JSON.stringify({ error: "validation_failed" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // Verify lesson + enrollment.
  const lesson = await prisma.lesson.findUnique({
    where: { id: body.lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) {
    return new Response(
      JSON.stringify({ error: "lesson_not_found" }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }
  if (!(await isUserEnrolled(userId, lesson.module.courseId)) {
    return new Response(
      JSON.stringify({ error: "not_enrolled" }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  // Resolve OpenAI key from saved credential or env fallback.
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

  // Resolve or create conversation.
  let conversationId = body.conversationId;
  if (!conversationId) {
    const conv = await getOrCreateConversation(userId, body.lessonId);
    conversationId = conv.id;
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload =
          typeof data === "string" ? data : JSON.stringify(data);
        // SSE frame: each line prefixed; double newline ends the event.
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${payload.replace(/\n/g, "\ndata: ")}\n\n`,
          ),
        );
      }

      try {
        send("meta", { conversationId });
        const result = await runChatTurn({
          conversationId: conversationId!,
          userId,
          userMessage: body.message!,
          openai,
          onDelta: (delta) => send("delta", delta),
        });
        send("done", result.usage);
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
