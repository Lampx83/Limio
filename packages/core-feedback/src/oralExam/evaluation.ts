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
  /** null khi đề vấn đáp không gắn khoá học (đề độc lập). */
  courseTitle: string | null;
  examTitle: string;
  rubricText: string | null;
  /** Chủ đề hệ thống giao cho sinh viên này (null = đề không chia chủ đề). Người chấm phải biết để
   * đánh giá đúng phạm vi — mỗi sinh viên một chủ đề nên câu trả lời chỉ so được với chủ đề của chính họ. */
  topic?: { title: string; brief: string } | null;
  transcript: { role: "examiner" | "student"; content: string }[];
}): string {
  const transcriptText = params.transcript
    .map((t) => `${t.role === "examiner" ? "Giám khảo" : "Sinh viên"}: ${t.content}`)
    .join("\n\n");
  const courseClause = params.courseTitle ? ` môn "${params.courseTitle}",` : "";

  return `Bạn là giám khảo chấm lại 1 buổi vấn đáp${courseClause} đề "${params.examTitle}" đã kết thúc.

${
    params.rubricText
      ? `Rubric chấm điểm GV cung cấp:\n"""\n${params.rubricText}\n"""\n\n`
      : ""
  }${
    params.topic
      ? `Chủ đề được giao cho sinh viên này (chấm câu trả lời theo phạm vi chủ đề này):\n"""\n${params.topic.title}\n${params.topic.brief}\n"""\n\n`
      : ""
  }Toàn bộ hội thoại:
"""
${transcriptText}
"""

Chấm điểm theo thang 0-100. Trả lời DUY NHẤT 1 khối JSON hợp lệ, không thêm chữ nào khác ngoài JSON, đúng khuôn:
{"score": <0-100>, "summary": "<nhận xét tổng quan 2-4 câu>", "breakdown": [{"topic": "<chủ đề/câu hỏi>", "note": "<nhận xét ngắn>"}]}`;
}

/** Câu thay cho khối JSON hỏng: nhận xét này có thể được điền sẵn vào ghi chú sinh viên và xuất Word, nên không bao giờ để JSON thô lọt vào. */
export const UNREADABLE_AI_SUMMARY =
  "AI trả lời sai khuôn nên chưa đọc được điểm đề xuất. Bấm \"Chấm bằng AI\" để chạy lại, hoặc thầy/cô tự chấm.";

function readJsonString(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return null;
  }
}

/**
 * Khi JSON bị cắt giữa chừng (hết trần đầu ra) thì JSON.parse hỏng dù điểm và nhận xét đã viết xong ở đầu khối.
 * Lấy lại phần nào còn nguyên: điểm, nhận xét tổng quan và những mục phân tích đã đóng ngoặc.
 */
function salvageTruncatedJson(raw: string): {
  score: number | null;
  summary: string;
  breakdown: RubricBreakdownItem[] | null;
} | null {
  const scoreMatch = raw.match(/"score"\s*:\s*(\d+(?:\.\d+)?)\s*[,}]/);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;
  if (score == null || score < 0 || score > 100) return null;
  const summary = readJsonString(raw, "summary");
  if (!summary) return null;
  const items: RubricBreakdownItem[] = [];
  const itemRe = /\{\s*"topic"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"note"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  for (let m = itemRe.exec(raw); m; m = itemRe.exec(raw)) {
    try {
      items.push({ topic: JSON.parse(`"${m[1]}"`) as string, note: JSON.parse(`"${m[2]}"`) as string });
    } catch {
      /* bỏ qua mục hỏng */
    }
  }
  return { score, summary, breakdown: items.length > 0 ? items : null };
}

export function parseGradingResponse(raw: string): {
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
    const summary = typeof parsed.summary === "string" ? parsed.summary : UNREADABLE_AI_SUMMARY;
    const breakdown = Array.isArray(parsed.breakdown)
      ? (parsed.breakdown as RubricBreakdownItem[])
      : null;
    return { score, summary, breakdown };
  } catch {
    const salvaged = salvageTruncatedJson(raw);
    if (salvaged) return salvaged;
    // Không đọc được điểm thì không đoán. Văn xuôi thường vẫn có ích cho giảng viên đọc, còn khối JSON hỏng thì
    // không (đã từng hiện nguyên khối `{ "score": ...` trong ô ghi chú sinh viên).
    const trimmed = raw.trim();
    return { score: null, summary: trimmed.startsWith("{") ? UNREADABLE_AI_SUMMARY : trimmed, breakdown: null };
  }
}

export interface GenerateEvaluationResult {
  aiSuggestedScore: number | null;
  aiSummary: string;
  /** Token thật của lượt gọi (vào + ra) — chấm hàng loạt cộng lại để báo chi phí của cả lô. */
  tokensUsed: number;
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
          oralRubricText: true,
          course: { select: { title: true } },
        },
      },
      oralTurns: { orderBy: { createdAt: "asc" } },
      oralTopic: { select: { title: true, brief: true } },
    },
  });
  if (!attempt) throw new AiTutorError("validation_failed", "attempt_not_found");
  if (attempt.exam.kind !== "oral") throw new AiTutorError("validation_failed", "not_oral_exam");
  // "auto_submitted" — buổi thi bị cron đóng vì hết giờ mà học viên không tự
  // kết thúc — vẫn là một buổi đã xong, chấm được như "submitted" bình thường.
  if (attempt.status !== "submitted" && attempt.status !== "auto_submitted") {
    throw new AiTutorError("validation_failed", "attempt_not_ended");
  }
  // Cho phép sinh lại đề xuất AI bất cứ lúc nào, kể cả sau khi GV đã chốt
  // điểm (vd sau khi GV sửa lại rubric) — upsert bên dưới chỉ ghi đè
  // aiSuggestedScore/aiSummary, KHÔNG đụng tới instructorScore/status GV đã
  // chốt. GV tự quyết có cập nhật lại điểm theo đề xuất mới hay không qua
  // submitOralEvaluation như cũ.
  await assertWithinCaps(actorUserId, db, "generator");

  const prompt = buildGradingPrompt({
    courseTitle: attempt.exam.course?.title ?? null,
    examTitle: attempt.exam.title,
    rubricText: attempt.exam.oralRubricText,
    topic: attempt.oralTopic,
    transcript: attempt.oralTurns.map((t) => ({ role: t.role, content: t.content })),
  });

  let chatResult;
  try {
    chatResult = await computeChat([{ role: "system", content: prompt }]);
  } catch (e) {
    throw new AiTutorError("openai_error", (e as Error).message, e);
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

  return {
    aiSuggestedScore: parsed.score,
    aiSummary: parsed.summary,
    tokensUsed: chatResult.inputTokens + chatResult.outputTokens,
  };
}
