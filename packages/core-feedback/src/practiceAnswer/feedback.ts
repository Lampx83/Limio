import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { callJsonModel } from "../aiTutor/generators";
import { resolveFeedbackVariant } from "../variant";
import {
  MAX_AUDIO_BYTES,
  MAX_SPEAKING_SECONDS,
  SPEAKING_SECONDS_TOLERANCE,
  measureSpeech,
  whisperChargeTokens,
  type SpeechMetrics,
} from "../speaking/analysis";
import {
  SPEAKING_STT_MODEL,
  openAiTranscriber,
  whisperLanguage,
  type AudioPayload,
  type TranscribeResult,
  type Transcriber,
} from "../speaking/feedback";
import type { OpenAiSource } from "../writing/feedback";
import {
  PRACTICE_PROMPT_VERSION,
  PRACTICE_SCHEMA,
  PracticeFeedbackError,
  buildPracticePrompts,
  hashPracticeInputs,
  normalizePracticeFeedback,
  readAnswerText,
  readSpeechMetrics,
  type PracticeFeedbackBody,
} from "./analysis";

/**
 * Câu mở (essay) của Bài luyện nhúng: trả lời bằng giọng nói + góp ý AI ngay khi học viên bấm "Kiểm tra".
 * Mọi khoản AI trừ ví của HỌC VIÊN. Không có bước giảng viên duyệt, không có trần số lượt (thầy chốt 11/11/2026) —
 * thay vào đó cùng đầu vào thì dùng lại bản cũ, không gọi AI, không trừ token.
 *
 * core-feedback không import core-lms: quyền (chủ buổi luyện), phạm vi câu hỏi và cấu hình câu `essay` được đọc
 * thẳng từ bảng qua Prisma; tầng web lo phần nào cần ExamError (phiên đã đóng, voiceAnswer tắt ở route).
 */

export interface PracticeVoiceResult {
  text: string;
  durationSec: number;
  metrics: SpeechMetrics;
}

export interface PracticeFeedbackResult {
  /** true = đầu vào không đổi nên trả bản cũ (không gọi AI, không trừ token). */
  reused: boolean;
  body: PracticeFeedbackBody;
}

type EssayCtx = {
  userId: string;
  examId: string;
  courseId: string;
  courseLanguage: string | null;
  levelBand: string | null;
  question: { id: string; prompt: string };
  rubric: string;
  sample: string;
  minWords: number | null;
  voiceAnswer: boolean;
  aiFeedback: boolean;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Nạp và kiểm: buổi luyện của chính học viên, câu thuộc đúng đề và nằm trong phạm vi buổi, loại `essay`, khoá `languageMode`.
 * Thứ tự lỗi cố định để tầng web ánh xạ ổn định.
 */
async function loadEssayContext(userId: string, sessionId: string, questionId: string, db: PrismaClient): Promise<EssayCtx> {
  const session = await db.examPracticeSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      examId: true,
      scope: true,
      exam: { select: { courseId: true, course: { select: { languageMode: true, language: true, levelBand: true } } } },
    },
  });
  if (!session) throw new PracticeFeedbackError("not_found");
  if (session.userId !== userId) throw new PracticeFeedbackError("forbidden");
  const scope = session.scope as { questionIds?: unknown } | null;
  const inScope = Array.isArray(scope?.questionIds) && (scope!.questionIds as unknown[]).includes(questionId);
  const q = inScope
    ? await db.examQuestion.findUnique({ where: { id: questionId }, select: { id: true, examId: true, type: true, prompt: true, config: true } })
    : null;
  if (!q || q.examId !== session.examId) throw new PracticeFeedbackError("not_found");
  if (q.type !== "essay") throw new PracticeFeedbackError("not_essay");
  const course = session.exam.course;
  if (!session.exam.courseId || !course?.languageMode) throw new PracticeFeedbackError("not_language_course");
  const cfg = isObj(q.config) ? q.config : {};
  return {
    userId,
    examId: session.examId,
    courseId: session.exam.courseId,
    courseLanguage: course.language,
    levelBand: course.levelBand,
    question: { id: q.id, prompt: q.prompt },
    rubric: typeof cfg.rubric === "string" ? cfg.rubric.trim() : "",
    sample: typeof cfg.explanation === "string" ? cfg.explanation.trim() : "",
    minWords: typeof cfg.minWords === "number" ? cfg.minWords : null,
    voiceAnswer: cfg.voiceAnswer !== false,
    aiFeedback: cfg.aiFeedback !== false,
  };
}

// ─── Giọng nói → chữ ─────────────────────────────────────────────────────────

/**
 * Chuyển giọng nói của học viên thành chữ bằng Whisper (có mốc từng từ để đo nhịp nói). Thứ tự bắt buộc:
 * kiểm quyền + cấu hình câu → kích thước → ví HỌC VIÊN → Whisper → ghi sổ trừ ví theo thời lượng NGAY SAU Whisper
 * (kể cả khi không có tiếng nói/quá dài: Whisper đã chạy) → mới kiểm độ dài và tiếng nói.
 * Hàm này KHÔNG lưu gì (tệp ghi âm và câu trả lời do tầng web lưu qua core-lms), chỉ trả `{ text, durationSec, metrics }`.
 */
export async function transcribePracticeVoice(
  args: { userId: string; sessionId: string; questionId: string; audio: AudioPayload },
  deps: { openai: OpenAiSource; transcribe?: Transcriber },
  db: PrismaClient = prisma,
): Promise<PracticeVoiceResult> {
  const { userId, sessionId, questionId, audio } = args;
  const ctx = await loadEssayContext(userId, sessionId, questionId, db);
  if (!ctx.voiceAnswer) throw new PracticeFeedbackError("voice_disabled");
  return transcribeSpokenAnswer({ userId, language: ctx.courseLanguage, audio }, deps, db);
}

/**
 * Xem thử của GIẢNG VIÊN: cùng bước chuyển chữ nhưng không có buổi luyện. Quyền (sửa được khoá chứa đề), câu là `essay` và
 * `voiceAnswer` bật do tầng gọi kiểm trước (core-lms `getPreviewVoiceContext`); ở đây chỉ trừ ví của giảng viên rồi gọi Whisper.
 * Không lưu gì, không ghi sự kiện.
 */
export async function transcribePreviewVoice(
  args: { userId: string; language: string | null; audio: AudioPayload },
  deps: { openai: OpenAiSource; transcribe?: Transcriber },
  db: PrismaClient = prisma,
): Promise<PracticeVoiceResult> {
  return transcribeSpokenAnswer(args, deps, db);
}

async function transcribeSpokenAnswer(
  args: { userId: string; language: string | null; audio: AudioPayload },
  deps: { openai: OpenAiSource; transcribe?: Transcriber },
  db: PrismaClient,
): Promise<PracticeVoiceResult> {
  const { userId, language, audio } = args;
  if (audio.buffer.length > MAX_AUDIO_BYTES) {
    throw new PracticeFeedbackError("audio_too_large", { bytes: audio.buffer.length, max: MAX_AUDIO_BYTES });
  }
  if (audio.buffer.length === 0) throw new PracticeFeedbackError("no_speech");

  // Ví của người nói + trần hệ thống — kiểm TRƯỚC khi chạm Whisper.
  await assertWithinCaps(userId, db, "generator");
  // Lấy khách hàng OpenAI SAU khi kiểm ví và NGOÀI khối bắt lỗi Whisper: thiếu cấu hình AI phải báo đúng là thiếu cấu hình.
  const transcribe = deps.transcribe ?? openAiTranscriber(typeof deps.openai === "function" ? await deps.openai() : deps.openai);
  let stt: TranscribeResult;
  try {
    stt = await transcribe(audio, { language: whisperLanguage(language) });
  } catch (e) {
    throw new PracticeFeedbackError("stt_failed", { message: (e as Error).message });
  }
  await recordAiUsage(userId, SPEAKING_STT_MODEL, whisperChargeTokens(stt.durationSec), 0, db);

  if (stt.durationSec > MAX_SPEAKING_SECONDS + SPEAKING_SECONDS_TOLERANCE) {
    throw new PracticeFeedbackError("audio_too_long", { seconds: Math.round(stt.durationSec), max: MAX_SPEAKING_SECONDS });
  }
  const text = stt.text.trim();
  const metrics = measureSpeech(text, stt.words, stt.durationSec);
  if (metrics.silent) throw new PracticeFeedbackError("no_speech");
  return { text, durationSec: stt.durationSec, metrics };
}

// ─── Góp ý AI ────────────────────────────────────────────────────────────────

async function emit(userId: string, courseId: string, eventKey: string, payload: Record<string, unknown>, db: PrismaClient) {
  try {
    await db.learningEvent.create({
      data: { userId, courseId, eventType: LearningEventType.ExamPracticeFeedbackGenerated, eventKey, payload: payload as Prisma.InputJsonValue },
    });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
}

export async function requestPracticeAnswerFeedback(
  userId: string,
  sessionId: string,
  questionId: string,
  deps: { openai: OpenAiSource },
  opts: { model?: string } = {},
  db: PrismaClient = prisma,
): Promise<PracticeFeedbackResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const ctx = await loadEssayContext(userId, sessionId, questionId, db);
  if (!ctx.aiFeedback) throw new PracticeFeedbackError("feedback_disabled");
  if ((await resolveFeedbackVariant(userId, ctx.courseId, db)).variant === "minimal") {
    throw new PracticeFeedbackError("control_group");
  }

  const answer = await db.examPracticeAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId } } });
  const { text, viaVoice } = readAnswerText(answer?.answerJson);
  if (!answer || text === "") throw new PracticeFeedbackError("empty_answer");

  // Đầu vào không đổi → bản cũ: không đòi cấu hình AI, không gọi mô hình, không trừ token.
  const hash = hashPracticeInputs({ answer: text, sample: ctx.sample, rubric: ctx.rubric, viaVoice });
  if (answer.aiFeedbackHash === hash && isObj(answer.aiFeedback)) {
    return { reused: true, body: answer.aiFeedback as unknown as PracticeFeedbackBody };
  }

  // Ví của HỌC VIÊN — kiểm trước khi gọi mô hình, ghi sổ sau.
  await assertWithinCaps(userId, db, "generator");
  const metrics = viaVoice ? readSpeechMetrics(answer.audioMeta) : null;
  const { system, user } = buildPracticePrompts({
    question: ctx.question.prompt,
    answer: text,
    sampleAnswer: ctx.sample,
    rubric: ctx.rubric,
    minWords: ctx.minWords,
    viaVoice,
    courseLanguage: ctx.courseLanguage,
    levelBand: ctx.levelBand,
  });
  const openai = typeof deps.openai === "function" ? await deps.openai() : deps.openai;
  const { data, inputTokens, outputTokens } = await callJsonModel<unknown>(openai, model, system, user, "practice_answer_feedback", PRACTICE_SCHEMA, 2000);
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  const body = normalizePracticeFeedback(data, { answerText: text, sampleAnswer: ctx.sample, viaVoice, metrics });
  await db.examPracticeAnswer.update({
    where: { id: answer.id },
    data: { aiFeedback: body as unknown as Prisma.InputJsonValue, aiFeedbackHash: hash, aiFeedbackAt: new Date() },
  });
  await emit(
    userId,
    ctx.courseId,
    `exam.practice.feedback_generated:${answer.id}:${hash.slice(0, 16)}`,
    {
      examId: ctx.examId,
      sessionId,
      questionId,
      viaVoice,
      errorCount: body.errors.length,
      dropped: body.dropped,
      level: body.coding.level,
      levels: body.coding.levels,
      elaboration: body.coding.elaboration,
      sourceKind: body.coding.sourceKind,
      promptVersion: PRACTICE_PROMPT_VERSION,
      model,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
    },
    db,
  );
  return { reused: false, body };
}
