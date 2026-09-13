import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AiTutorError } from "../aiTutor/errors";
import { assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { DEFAULT_EXAMINER_MODEL, type ChatComputeFn, type ChatMessage } from "./chat";
import { DEFAULT_EMBEDDING_MODEL, type EmbedComputeFn } from "./embeddings";
import { searchMaterialChunks } from "./materialEmbeddings";

// A6.3 — giới hạn cứng: dừng buổi vấn đáp khi hết giờ (Exam/ExamAttempt
// durationSec, đã có sẵn) HOẶC đủ số câu hỏi này, cái nào tới trước. Chưa
// cho GV cấu hình — thêm khi có nhu cầu thật, không đoán trước (YAGNI).
export const MAX_ORAL_QUESTIONS = 8;

const CONTEXT_CHUNK_COUNT = 3;

async function getOpeningChunks(examId: string, db: PrismaClient): Promise<string[]> {
  const firstMaterial = await db.oralExamMaterial.findFirst({
    where: { examId },
    orderBy: { orderIndex: "asc" },
    select: { id: true },
  });
  if (!firstMaterial) return [];
  const chunks = await db.oralExamMaterialChunk.findMany({
    where: { materialId: firstMaterial.id },
    orderBy: { chunkIndex: "asc" },
    take: CONTEXT_CHUNK_COUNT,
    select: { chunkText: true },
  });
  return chunks.map((c) => c.chunkText);
}

function buildSystemPrompt(params: {
  courseTitle: string;
  examTitle: string;
  contextChunks: string[];
  isLastQuestion: boolean;
  isClosing: boolean;
}): string {
  if (params.isClosing) {
    return `Bạn là giảng viên ảo đang chấm vấn đáp môn "${params.courseTitle}", đề "${params.examTitle}".

Buổi vấn đáp đã đến lúc kết thúc. Viết lời kết ngắn gọn (2-3 câu): cảm ơn sinh viên, KHÔNG chấm điểm, KHÔNG tiết lộ đúng/sai, KHÔNG hứa hẹn kết quả — chỉ thông báo buổi vấn đáp đã hoàn tất.`;
  }

  const context =
    params.contextChunks.length > 0
      ? params.contextChunks.map((c, i) => `[Đoạn ${i + 1}]\n${c}`).join("\n\n")
      : "(không có tài liệu liên quan — hỏi dựa trên những gì sinh viên vừa trả lời)";

  return `Bạn là giảng viên ảo đang hỏi vấn đáp môn "${params.courseTitle}", đề "${params.examTitle}".

Tài liệu tham khảo cho câu hỏi (sinh viên KHÔNG thấy được đoạn này):
"""
${context}
"""

Nguyên tắc:
1. Hỏi ĐÚNG 1 câu hỏi mỗi lượt, bám sát tài liệu trên.
2. Đào sâu theo câu trả lời trước của sinh viên — hỏi follow-up thay vì hỏi câu độc lập không liên quan.
3. KHÔNG đưa gợi ý, KHÔNG tiết lộ đáp án đúng, KHÔNG chấm điểm hay nhận xét đúng/sai trong lúc hỏi — đó là việc của bước chấm sau khi buổi thi kết thúc.
4. Trả lời tiếng Việt nếu sinh viên dùng tiếng Việt; tiếng Anh nếu sinh viên dùng tiếng Anh.${
    params.isLastQuestion
      ? "\n5. Đây là câu hỏi CUỐI CÙNG của buổi vấn đáp — hỏi sao cho sinh viên có thể trả lời trọn vẹn trong lượt này."
      : ""
  }`;
}

export interface RunOralExamTurnInput {
  attemptId: string;
  studentUserId: string;
  /** null CHỈ hợp lệ cho lượt gọi đầu tiên (chưa có câu trả lời nào). */
  studentMessage: string | null;
  computeChat: ChatComputeFn;
  computeEmbed: EmbedComputeFn;
  model?: string;
  onDelta?: (delta: string) => void;
}

export interface RunOralExamTurnResult {
  assistantContent: string;
  /** true = đây là lời kết, buổi thi đã chuyển sang trạng thái submitted. */
  ended: boolean;
  questionsAsked: number;
}

/**
 * Chạy 1 lượt vấn đáp: lưu câu trả lời của SV (nếu có), tìm đoạn tài liệu
 * liên quan, hỏi tiếp (hoặc kết thúc nếu đã hết giờ/đủ câu), lưu câu hỏi mới.
 *
 * KHÔNG chấm điểm ở đây — chỉ sinh hội thoại + lưu transcript. Chấm điểm là
 * A6.4, đọc lại OralExamTurn sau khi attempt.status = submitted.
 */
export async function runOralExamTurn(
  input: RunOralExamTurnInput,
  db: PrismaClient = prisma,
): Promise<RunOralExamTurnResult> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: input.attemptId },
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
    },
  });
  if (!attempt) throw new AiTutorError("validation_failed", "attempt_not_found");
  if (attempt.userId !== input.studentUserId) {
    throw new AiTutorError("validation_failed", "wrong_user");
  }
  if (attempt.exam.kind !== "oral") {
    throw new AiTutorError("validation_failed", "not_oral_exam");
  }
  if (attempt.status !== "in_progress") {
    throw new AiTutorError("validation_failed", "attempt_ended");
  }

  const turns = await db.oralExamTurn.findMany({
    where: { attemptId: attempt.id },
    orderBy: { createdAt: "asc" },
  });
  const questionsAsked = turns.filter((t) => t.role === "examiner").length;

  if (turns.length === 0) {
    if (input.studentMessage !== null) {
      throw new AiTutorError("validation_failed", "first_turn_must_be_empty");
    }
  } else {
    const lastTurn = turns[turns.length - 1]!;
    if (lastTurn.role !== "examiner") {
      throw new AiTutorError("validation_failed", "wrong_turn_order");
    }
    if (!input.studentMessage || !input.studentMessage.trim()) {
      throw new AiTutorError("validation_failed", "empty_message");
    }
  }

  await assertWithinCaps(input.studentUserId, db, "oral_exam");

  const trimmedAnswer = input.studentMessage?.trim() ?? null;
  if (trimmedAnswer) {
    await db.oralExamTurn.create({
      data: { attemptId: attempt.id, role: "student", content: trimmedAnswer },
    });
  }

  const elapsedSec = (Date.now() - attempt.startedAt.getTime()) / 1000;
  const timeUp = elapsedSec >= attempt.durationSec;
  const shouldClose = timeUp || questionsAsked >= MAX_ORAL_QUESTIONS;
  const isLastQuestion = !shouldClose && questionsAsked + 1 >= MAX_ORAL_QUESTIONS;

  let contextChunks: string[] = [];
  let embedTokens = 0;
  if (!shouldClose) {
    if (questionsAsked === 0) {
      contextChunks = await getOpeningChunks(attempt.exam.id, db);
    } else {
      const embedResult = await input.computeEmbed([trimmedAnswer!]);
      embedTokens = embedResult.tokensUsed;
      contextChunks = (
        await searchMaterialChunks(
          attempt.exam.id,
          embedResult.embeddings[0]!,
          CONTEXT_CHUNK_COUNT,
          db,
        )
      ).map((c) => c.chunkText);
    }
  }

  const systemPrompt = buildSystemPrompt({
    courseTitle: attempt.exam.course.title,
    examTitle: attempt.exam.title,
    contextChunks,
    isLastQuestion,
    isClosing: shouldClose,
  });

  const history: ChatMessage[] = turns.map((t) => ({
    role: t.role === "examiner" ? "assistant" : "user",
    content: t.content,
  }));
  if (trimmedAnswer) history.push({ role: "user", content: trimmedAnswer });

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history];

  let chatResult;
  try {
    chatResult = await input.computeChat(messages, input.onDelta);
  } catch (e) {
    throw new AiTutorError("openai_error", (e as Error).message);
  }
  if (!chatResult.content) {
    throw new AiTutorError("openai_error", "empty_response");
  }

  await db.oralExamTurn.create({
    data: {
      attemptId: attempt.id,
      role: "examiner",
      content: chatResult.content,
      tokensInput: chatResult.inputTokens,
      tokensOutput: chatResult.outputTokens,
    },
  });

  if (embedTokens > 0) {
    await recordAiUsage(input.studentUserId, DEFAULT_EMBEDDING_MODEL, embedTokens, 0, db);
  }
  await recordAiUsage(
    input.studentUserId,
    input.model ?? DEFAULT_EXAMINER_MODEL,
    chatResult.inputTokens,
    chatResult.outputTokens,
    db,
  );

  const finalQuestionsAsked = shouldClose ? questionsAsked : questionsAsked + 1;

  if (shouldClose) {
    await db.examAttempt.update({
      where: { id: attempt.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
  }

  await db.learningEvent.create({
    data: {
      userId: input.studentUserId,
      courseId: attempt.exam.courseId,
      eventType: LearningEventType.ExamOralAttemptTurnRecorded,
      payload: {
        examId: attempt.exam.id,
        attemptId: attempt.id,
        questionsAsked: finalQuestionsAsked,
        ended: shouldClose,
      },
    },
  });

  return { assistantContent: chatResult.content, ended: shouldClose, questionsAsked: finalQuestionsAsked };
}
