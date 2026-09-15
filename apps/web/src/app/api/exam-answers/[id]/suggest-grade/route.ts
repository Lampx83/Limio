import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError } from "@feedbackme/core-lms";
import {
  AiTutorError,
  assertWithinCaps,
  recordAiUsage,
} from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * Ask the LLM to suggest a grade for an essay/short answer.
 * Instructor-only. Returns { suggestedScore, reasoning } — non-binding;
 * instructor still reviews and confirms via the existing grade endpoint.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const answer = await prisma.examAnswer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      answerJson: true,
      question: {
        select: {
          type: true,
          prompt: true,
          points: true,
          config: true,
        },
      },
      attempt: {
        select: {
          exam: { select: { courseId: true, createdById: true } },
        },
      },
    },
  });
  if (!answer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await assertCanEditExam(userId, answer.attempt.exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: e.code },
        { status: e.code === "not_found" ? 404 : 403 },
      );
    }
    throw e;
  }

  if (answer.question.type !== "essay" && answer.question.type !== "short_answer") {
    return NextResponse.json(
      { error: "not_manual_gradable" },
      { status: 400 },
    );
  }

  const text =
    typeof answer.answerJson === "object" &&
    answer.answerJson !== null &&
    "text" in answer.answerJson
      ? String((answer.answerJson as { text: unknown }).text ?? "")
      : "";
  if (!text.trim()) {
    return NextResponse.json({
      suggestedScore: 0,
      reasoning: "Học viên không trả lời.",
    });
  }

  const cfg = answer.question.config as { rubric?: string; minWords?: number };
  const maxPoints = answer.question.points;
  let openai;
  try {
    openai = await getOpenaiClient();
  } catch {
    return NextResponse.json(
      { error: "openai_not_configured" },
      { status: 503 },
    );
  }

  const system =
    "Bạn là trợ lý chấm bài. Trả về JSON dạng " +
    "{\"suggestedScore\": number, \"reasoning\": string}. " +
    "suggestedScore phải nằm trong khoảng 0 — maxPoints. " +
    "reasoning trình bày ngắn gọn dưới 120 từ, tiếng Việt.";
  const user = [
    `Loại câu hỏi: ${answer.question.type}`,
    `Điểm tối đa: ${maxPoints}`,
    cfg.rubric ? `Rubric: ${cfg.rubric}` : null,
    cfg.minWords ? `Yêu cầu số từ tối thiểu: ${cfg.minWords}` : null,
    "",
    `Đề bài:\n${answer.question.prompt}`,
    "",
    `Bài làm:\n${text}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Endpoint này gọi thẳng OpenAI chứ không đi qua generator, nên trước đây
  // nằm ngoài mọi hạn mức VÀ ngoài mọi sổ sách: token nó tiêu không hiện trong
  // AiUsageLog, tức là vừa không bị chặn vừa âm thầm nới cap của chỗ khác.
  const AI_MODEL = "gpt-4o-mini";
  try {
    await assertWithinCaps(userId, prisma, "generator");
  } catch (e) {
    if (e instanceof AiTutorError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 429 },
      );
    }
    throw e;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    await recordAiUsage(
      userId,
      AI_MODEL,
      completion.usage?.prompt_tokens ?? 0,
      completion.usage?.completion_tokens ?? 0,
    );
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      suggestedScore?: number;
      reasoning?: string;
    };
    const score = Math.max(
      0,
      Math.min(maxPoints, Number(parsed.suggestedScore ?? 0)),
    );
    return NextResponse.json({
      suggestedScore: score,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_failed";
    return NextResponse.json({ error: "llm_failed", details: msg }, { status: 502 });
  }
}
