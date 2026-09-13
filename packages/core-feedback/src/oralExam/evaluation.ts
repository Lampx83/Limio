import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AiTutorError } from "../aiTutor/errors";
import { assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { DEFAULT_EXAMINER_MODEL, type ChatComputeFn } from "./chat";

// A6.4 — AI đề xuất điểm sau khi buổi vấn đáp kết thúc; GV duyệt/sửa (xem
// submitOralEvaluation ở core-lms — GV mới là bên chốt điểm cuối cùng).

interface RubricBreakdownItem {
  topic: string;
  note: string;
}

function buildGradingPrompt(params: {
  courseTitle: string;
  examTitle: string;
  rubricText: string | null;
  transcript: { role: "examiner" | "student"; content: string }[];
}): string {
  const transcriptText = params.transcript
    .map((t) => `${t.role === "examiner" ? "Giám khảo" : "Sinh viên"}: ${t.content}`)
    .join("\n\n");

  return `Bạn là giám khảo chấm lại 1 buổi vấn đáp môn "${params.courseTitle}", đề "${params.examTitle}" đã kết thúc.

${
    params.rubricText
      ? `Rubric chấm điểm GV cung cấp:\n"""\n${params.rubricText}\n"""\n\n`
      : ""
  }Toàn bộ hội thoại:
"""
${transcriptText}
"""

Chấm điểm theo thang 0-100. Trả lời DUY NHẤT 1 khối JSON hợp lệ, không thêm chữ nào khác ngoài JSON, đúng khuôn:
{"score": <0-100>, "summary": "<nhận xét tổng quan 2-4 câu>", "breakdown": [{"topic": "<chủ đề/câu hỏi>", "note": "<nhận xét ngắn>"}]}`;
}

function parseGradingResponse(raw: string): {
  score: number | null;
  summary: string;
  breakdown: RubricBreakdownItem[] | null;
} {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
      score?: unknown;
      summary?: unknown;
      breakdown?: unknown;
    };
    const score =
      typeof parsed.score === "number" && parsed.score >= 0 && parsed.score <= 100
        ? parsed.score
        : null;
    const summary = typeof parsed.summary === "string" ? parsed.summary : raw;
    const breakdown = Array.isArray(parsed.breakdown)
      ? (parsed.breakdown as RubricBreakdownItem[])
      : null;
    return { score, summary, breakdown };
  } catch {
    // JSON không đọc được — vẫn giữ nguyên văn AI viết cho GV tự đọc, không
    // suy đoán điểm số, không chặn (đúng triết lý "để trống chứ không đoán"
    // đã dùng ở A6.1 cho extractedText).
    return { score: null, summary: raw, breakdown: null };
  }
}

export interface GenerateEvaluationResult {
  aiSuggestedScore: number | null;
  aiSummary: string;
}

export async function generateOralExamEvaluation(
  actorUserId: string,
  attemptId: string,
  computeChat: ChatComputeFn,
  db: PrismaClient = prisma,
): Promise<GenerateEvaluationResult> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          kind: true,
          courseId: true,
          title: true,
          course: { select: { title: true } },
        },
      },
      oralTurns: { orderBy: { createdAt: "asc" } },
      oralEvaluation: { select: { status: true } },
    },
  });
  if (!attempt) throw new AiTutorError("validation_failed", "attempt_not_found");
  if (attempt.exam.kind !== "oral") throw new AiTutorError("validation_failed", "not_oral_exam");
  if (attempt.status !== "submitted") {
    throw new AiTutorError("validation_failed", "attempt_not_ended");
  }
  if (attempt.oralEvaluation && attempt.oralEvaluation.status !== "pending_review") {
    // GV đã chốt điểm — sinh lại đề xuất AI ở đây sẽ vô nghĩa và dễ gây hiểu
    // lầm là điểm vừa đổi. Muốn chấm lại thì GV tự sửa qua submitOralEvaluation.
    throw new AiTutorError("validation_failed", "already_graded");
  }

  await assertWithinCaps(actorUserId, db, "generator");

  const rubricMaterial = await db.oralExamMaterial.findFirst({
    where: { examId: attempt.exam.id, type: "rubric" },
    orderBy: { orderIndex: "asc" },
    select: { extractedText: true },
  });

  const prompt = buildGradingPrompt({
    courseTitle: attempt.exam.course.title,
    examTitle: attempt.exam.title,
    rubricText: rubricMaterial?.extractedText ?? null,
    transcript: attempt.oralTurns.map((t) => ({ role: t.role, content: t.content })),
  });

  let chatResult;
  try {
    chatResult = await computeChat([{ role: "system", content: prompt }]);
  } catch (e) {
    throw new AiTutorError("openai_error", (e as Error).message);
  }
  if (!chatResult.content) throw new AiTutorError("openai_error", "empty_response");

  const parsed = parseGradingResponse(chatResult.content);

  await db.oralExamEvaluation.upsert({
    where: { attemptId },
    create: {
      attemptId,
      aiSuggestedScore: parsed.score,
      aiSummary: parsed.summary,
      aiRubricBreakdown: (parsed.breakdown as Prisma.InputJsonValue | null) ?? undefined,
    },
    update: {
      aiSuggestedScore: parsed.score,
      aiSummary: parsed.summary,
      aiRubricBreakdown: (parsed.breakdown as Prisma.InputJsonValue | null) ?? undefined,
    },
  });

  await recordAiUsage(
    actorUserId,
    DEFAULT_EXAMINER_MODEL,
    chatResult.inputTokens,
    chatResult.outputTokens,
    db,
  );

  await db.learningEvent.create({
    data: {
      userId: actorUserId,
      courseId: attempt.exam.courseId,
      eventType: LearningEventType.ExamOralEvaluationGenerated,
      payload: { examId: attempt.exam.id, attemptId, aiSuggestedScore: parsed.score },
    },
  });

  return { aiSuggestedScore: parsed.score, aiSummary: parsed.summary };
}
