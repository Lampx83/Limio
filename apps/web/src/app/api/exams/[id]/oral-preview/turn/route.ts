import OpenAI from "openai";
import {
  AiTutorError,
  openAiChatCompute,
  openAiEmbedCompute,
  runOralExamPreviewTurn,
} from "@feedbackme/core-feedback";
import {
  assertCanEditExam,
  CourseAuthzError,
  getIntegrationSecret,
  IntegrationError,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_HISTORY = 400; // không giới hạn số câu hỏi — trần này chỉ chặn request bất thường
const MAX_TEXT = 4_000;

/**
 * "Thử vấn đáp" của giáo viên (trước khi mở phiên). Body:
 *   { history: [{ role: "examiner" | "student", content }], message?: string, forceEnd?: boolean }
 * Hội thoại do TRÌNH DUYỆT giữ — route này KHÔNG ghi ExamAttempt/OralExamTurn/LearningEvent (xem
 * runOralExamPreviewTurn), chỉ tính token AI của giáo viên. Chỉ người sửa được đề mới thử được.
 * SSE cùng khuôn với /oral-attempt/[attemptId]/turn: delta / done / error.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true, createdById: true, kind: true },
  });
  if (!exam) return Response.json({ error: "exam_not_found" }, { status: 404 });
  if (exam.kind !== "oral") return Response.json({ error: "exam_not_oral" }, { status: 400 });
  try {
    await assertCanEditExam(userId, exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) return Response.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as {
    history?: unknown;
    message?: string;
    forceEnd?: boolean;
  } | null;
  const rawHistory = Array.isArray(body?.history) ? body!.history : [];
  if (rawHistory.length > MAX_HISTORY) {
    return Response.json({ error: "history_too_long" }, { status: 400 });
  }
  const history: { role: "examiner" | "student"; content: string }[] = [];
  for (const t of rawHistory as Array<{ role?: unknown; content?: unknown }>) {
    if ((t?.role !== "examiner" && t?.role !== "student") || typeof t.content !== "string") {
      return Response.json({ error: "invalid_history" }, { status: 400 });
    }
    history.push({ role: t.role, content: t.content.slice(0, MAX_TEXT) });
  }
  const studentMessage = body?.message?.trim().slice(0, MAX_TEXT) || null;

  let openaiKey: string;
  try {
    openaiKey = await getIntegrationSecret("openai");
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      return Response.json({ error: "openai_not_configured" }, { status: 503 });
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
          encoder.encode(`event: ${event}\ndata: ${payload.replace(/\n/g, "\ndata: ")}\n\n`),
        );
      }
      try {
        const result = await runOralExamPreviewTurn({
          examId: exam.id,
          teacherUserId: userId,
          history,
          studentMessage,
          forceEnd: body?.forceEnd === true,
          computeChat: openAiChatCompute(openai),
          computeEmbed: openAiEmbedCompute(openai),
          onDelta: (delta) => send("delta", delta),
        });
        send("done", { ended: result.ended, questionsAsked: result.questionsAsked });
      } catch (e) {
        if (e instanceof AiTutorError) send("error", { code: e.code, details: e.details });
        else send("error", { code: "unknown", details: (e as Error).message });
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
