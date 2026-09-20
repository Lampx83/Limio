import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AiTutorError } from "../aiTutor/errors";
import { assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { DEFAULT_EXAMINER_MODEL, type ChatComputeFn, type ChatMessage } from "./chat";
import { DEFAULT_EMBEDDING_MODEL, type EmbedComputeFn } from "./embeddings";
import { searchMaterialChunks } from "./materialEmbeddings";

// Buổi vấn đáp KHÔNG giới hạn số câu hỏi — chỉ kết thúc khi hết giờ (ExamAttempt.durationSec) hoặc sinh viên bấm
// kết thúc (forceEnd). Trước đây có trần cứng 8 câu; đã bỏ theo yêu cầu vì con số đó giáo viên không thấy, không đổi
// được và làm buổi vấn đáp dừng bất ngờ khi còn thời gian.

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

// A6.3/A6.6 — khai báo tường minh thay vì để AI đoán từ câu trả lời SV: câu
// hỏi MỞ MÀN chưa có câu trả lời nào để đoán, đã gặp lỗi trộn tiếng Anh/Việt
// thật khi test (xem OralExamLanguage trong schema).
const LANGUAGE_DIRECTIVE: Record<"vi" | "en" | "zh", string> = {
  vi: "Hỏi và trả lời HOÀN TOÀN bằng tiếng Việt trong suốt buổi thi, kể cả câu hỏi mở màn — không chêm tiếng Anh.",
  en: "Ask and respond ENTIRELY in English throughout the exam, including the opening question — do not mix in Vietnamese.",
  zh: "全程用中文提问和回答，包括开场的第一个问题——不要混用越南语或英语。",
};

function buildSystemPrompt(params: {
  /** null khi đề vấn đáp không gắn khoá học (đề độc lập). */
  courseTitle: string | null;
  examTitle: string;
  contextChunks: string[];
  /** true khi đây là lượt hỏi đầu tiên — chưa có câu trả lời nào của SV. */
  isFirstTurn: boolean;
  isClosing: boolean;
  language: "vi" | "en" | "zh";
  /** GV tự soạn — chèn thêm, KHÔNG thay thế nguyên tắc cứng bên dưới. */
  examinerInstructions?: string | null;
}): string {
  const extra = params.examinerInstructions?.trim()
    ? `\n\nHướng dẫn thêm từ giảng viên (áp dụng cùng các nguyên tắc trên, không được mâu thuẫn):\n"""\n${params.examinerInstructions.trim()}\n"""`
    : "";
  // Đề độc lập (không gắn khoá học) — bỏ hẳn cụm "môn X" thay vì hiện chuỗi
  // rỗng/"null" gây hiểu lầm cho AI.
  const courseClause = params.courseTitle ? ` môn "${params.courseTitle}",` : "";

  if (params.isClosing) {
    return `Bạn là giảng viên ảo đang chấm vấn đáp${courseClause} đề "${params.examTitle}".

${LANGUAGE_DIRECTIVE[params.language]}

Buổi vấn đáp đã đến lúc kết thúc. Viết lời kết ngắn gọn (2-3 câu): cảm ơn sinh viên, KHÔNG chấm điểm, KHÔNG tiết lộ đúng/sai, KHÔNG hứa hẹn kết quả — chỉ thông báo buổi vấn đáp đã hoàn tất.`;
  }

  const context =
    params.contextChunks.length > 0
      ? params.contextChunks.map((c, i) => `[Đoạn ${i + 1}]\n${c}`).join("\n\n")
      : "(không có tài liệu liên quan — hỏi dựa trên những gì sinh viên vừa trả lời)";

  return `Bạn là giảng viên ảo đang hỏi vấn đáp${courseClause} đề "${params.examTitle}".

Tài liệu tham khảo cho câu hỏi (sinh viên KHÔNG thấy được đoạn này):
"""
${context}
"""

Nguyên tắc:
1. Hỏi ĐÚNG 1 câu hỏi mỗi lượt, bám sát tài liệu trên.
2. Đào sâu theo câu trả lời trước của sinh viên — hỏi follow-up thay vì hỏi câu độc lập không liên quan.
3. KHÔNG đưa gợi ý, KHÔNG tiết lộ đáp án đúng, KHÔNG chấm điểm hay nhận xét đúng/sai trong lúc hỏi — đó là việc của bước chấm sau khi buổi thi kết thúc.
4. ${LANGUAGE_DIRECTIVE[params.language]}${buildExtraRules(params)}${extra}`;
}

// Quy tắc chỉ áp dụng cho lượt mở màn — tách riêng để đánh số tiếp nối "Nguyên tắc" phía trên.
function buildExtraRules(params: { isFirstTurn: boolean }): string {
  const rules: string[] = [];
  if (params.isFirstTurn) {
    rules.push(
      "Đây là lượt ĐẦU TIÊN của buổi vấn đáp — trước khi hỏi, hãy mở đầu bằng một câu chào hỏi và giới thiệu ngắn gọn bản thân (là giảng viên ảo phụ trách buổi vấn đáp này), rồi mới đặt câu hỏi đầu tiên, trong CÙNG một lượt trả lời này.",
    );
  }
  return rules.map((r, i) => `\n${5 + i}. ${r}`).join("");
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
  /**
   * SV chủ động bấm "Kết thúc vấn đáp" — trước đây không có đường nào để
   * đóng buổi ngoài hết giờ/đủ câu hỏi. Bug thật: SV gõ "tôi muốn kết thúc
   * sớm" như một câu TRẢ LỜI, AI lịch sự đáp lại như thể đã xong, nhưng
   * shouldClose (thuần theo thời gian/số câu) không hề biết — buổi thi kẹt
   * in_progress mãi mãi dù cả hai bên tưởng đã kết thúc. forceEnd đi thẳng
   * vào nhánh "isClosing" có sẵn, không cần message hợp lệ đi kèm.
   */
  forceEnd?: boolean;
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
          language: true,
          examinerInstructions: true,
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
    if (input.studentMessage !== null && !input.forceEnd) {
      throw new AiTutorError("validation_failed", "first_turn_must_be_empty");
    }
  } else {
    const lastTurn = turns[turns.length - 1]!;
    if (lastTurn.role !== "examiner") {
      throw new AiTutorError("validation_failed", "wrong_turn_order");
    }
    if (!input.forceEnd && (!input.studentMessage || !input.studentMessage.trim())) {
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
  const shouldClose = Boolean(input.forceEnd) || timeUp;

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
    courseTitle: attempt.exam.course?.title ?? null,
    examTitle: attempt.exam.title,
    contextChunks,
    isFirstTurn: questionsAsked === 0,
    isClosing: shouldClose,
    language: attempt.exam.language,
    examinerInstructions: attempt.exam.examinerInstructions,
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

export interface RunOralExamPreviewTurnInput {
  examId: string;
  /** Giáo viên đang thử — chỉ để tính hạn mức/token AI của họ; KHÔNG có ExamAttempt nào. */
  teacherUserId: string;
  /** Hội thoại đã diễn ra, do TRÌNH DUYỆT giữ (bản thử không lưu gì vào DB). */
  history: ReadonlyArray<{ role: "examiner" | "student"; content: string }>;
  /** null CHỈ hợp lệ khi history rỗng (lượt mở màn). */
  studentMessage: string | null;
  computeChat: ChatComputeFn;
  computeEmbed: EmbedComputeFn;
  model?: string;
  onDelta?: (delta: string) => void;
  forceEnd?: boolean;
}

/**
 * "Thử vấn đáp" của giáo viên trước khi mở phiên. Cùng prompt, cùng cách lấy đoạn tài liệu và cùng quy tắc
 * kết thúc (forceEnd) như runOralExamTurn để bản thử phản ánh đúng buổi thật —
 * nhưng KHÔNG ghi ExamAttempt/OralExamTurn/LearningEvent và không đổi trạng thái gì. Không giới hạn theo thời
 * gian: bản thử không có đồng hồ. Vẫn qua assertWithinCaps + recordAiUsage nên TÍNH vào hạn mức token AI của
 * giáo viên (mỗi lượt hỏi thử gọi AI thật).
 */
export async function runOralExamPreviewTurn(
  input: RunOralExamPreviewTurnInput,
  db: PrismaClient = prisma,
): Promise<RunOralExamTurnResult> {
  const exam = await db.exam.findUnique({
    where: { id: input.examId },
    select: {
      id: true,
      kind: true,
      title: true,
      language: true,
      examinerInstructions: true,
      course: { select: { title: true } },
    },
  });
  if (!exam) throw new AiTutorError("validation_failed", "exam_not_found");
  if (exam.kind !== "oral") throw new AiTutorError("validation_failed", "not_oral_exam");

  const questionsAsked = input.history.filter((t) => t.role === "examiner").length;
  if (input.history.length === 0) {
    if (input.studentMessage !== null && !input.forceEnd) {
      throw new AiTutorError("validation_failed", "first_turn_must_be_empty");
    }
  } else {
    if (input.history[input.history.length - 1]!.role !== "examiner") {
      throw new AiTutorError("validation_failed", "wrong_turn_order");
    }
    if (!input.forceEnd && (!input.studentMessage || !input.studentMessage.trim())) {
      throw new AiTutorError("validation_failed", "empty_message");
    }
  }

  await assertWithinCaps(input.teacherUserId, db, "oral_exam");

  const trimmedAnswer = input.studentMessage?.trim() ?? null;
  const shouldClose = Boolean(input.forceEnd);

  let contextChunks: string[] = [];
  let embedTokens = 0;
  if (!shouldClose) {
    if (questionsAsked === 0) {
      contextChunks = await getOpeningChunks(exam.id, db);
    } else {
      const embedResult = await input.computeEmbed([trimmedAnswer!]);
      embedTokens = embedResult.tokensUsed;
      contextChunks = (
        await searchMaterialChunks(exam.id, embedResult.embeddings[0]!, CONTEXT_CHUNK_COUNT, db)
      ).map((c) => c.chunkText);
    }
  }

  const systemPrompt = buildSystemPrompt({
    courseTitle: exam.course?.title ?? null,
    examTitle: exam.title,
    contextChunks,
    isFirstTurn: questionsAsked === 0,
    isClosing: shouldClose,
    language: exam.language,
    examinerInstructions: exam.examinerInstructions,
  });

  const history: ChatMessage[] = input.history.map((t) => ({
    role: t.role === "examiner" ? "assistant" : "user",
    content: t.content,
  }));
  if (trimmedAnswer) history.push({ role: "user", content: trimmedAnswer });

  let chatResult;
  try {
    chatResult = await input.computeChat([{ role: "system", content: systemPrompt }, ...history], input.onDelta);
  } catch (e) {
    throw new AiTutorError("openai_error", (e as Error).message);
  }
  if (!chatResult.content) throw new AiTutorError("openai_error", "empty_response");

  if (embedTokens > 0) {
    await recordAiUsage(input.teacherUserId, DEFAULT_EMBEDDING_MODEL, embedTokens, 0, db);
  }
  await recordAiUsage(
    input.teacherUserId,
    input.model ?? DEFAULT_EXAMINER_MODEL,
    chatResult.inputTokens,
    chatResult.outputTokens,
    db,
  );

  return {
    assistantContent: chatResult.content,
    ended: shouldClose,
    questionsAsked: shouldClose ? questionsAsked : questionsAsked + 1,
  };
}
