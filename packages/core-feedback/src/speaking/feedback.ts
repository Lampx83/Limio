import type OpenAI from "openai";
import { toFile } from "openai";
import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { callJsonModel } from "../aiTutor/generators";
import { resolveFeedbackVariant } from "../variant";
import {
  MAX_AUDIO_BYTES,
  MAX_SPEAKING_SECONDS,
  SPEAKING_CATEGORIES,
  SPEAKING_CRITERIA,
  SPEAKING_FEEDBACK_MAX_PER_DAY,
  SPEAKING_PROMPT_VERSION,
  SPEAKING_SECONDS_TOLERANCE,
  SpeakingFeedbackError,
  buildSpeakingPrompts,
  codeSpeakingFeedback,
  hashSpeakingText,
  measureSpeech,
  normalizeSpeakingAnalysis,
  whisperChargeTokens,
  type SpeakingAnalysis,
  type SpeechMetrics,
  type TimedWord,
} from "./analysis";
import { WRITING_LEVELS } from "../writing/analysis";
import type { OpenAiSource } from "../writing/feedback";

/**
 * LANG G7 — góp ý bài nói do AI. Học viên bấm, trừ ví token của HỌC VIÊN (Whisper theo thời lượng + mô
 * hình chấm theo token). Luồng: file ghi âm → Whisper → bản chữ + số liệu nhịp nói (lưu, một lần cho mỗi
 * file) → chấm theo rubric → bản NHÁP "chưa duyệt" → giảng viên duyệt. KHÔNG chấm phát âm.
 *
 * core-feedback không đọc kho file (thuộc apps/web) và không import core-lms: tầng gọi đưa vào `loadAudio`
 * (đọc file từ kho của hệ thống, trả null nếu không phải file của hệ thống) và tự kiểm quyền duyệt.
 */

export const SPEAKING_STT_MODEL = "whisper-1";

export interface AudioPayload {
  buffer: Buffer;
  mimeType: string;
}
export interface TranscribeResult {
  text: string;
  durationSec: number;
  words: TimedWord[];
  language?: string;
}
export type Transcriber = (audio: AudioPayload, opts: { language?: string }) => Promise<TranscribeResult>;

const extFromMime = (m: string) => (m.includes("webm") ? "webm" : m.includes("ogg") ? "ogg" : m.includes("mp4") || m.includes("m4a") ? "m4a" : m.includes("mpeg") ? "mp3" : "wav");

/** Whisper có mốc thời gian từng từ (verbose_json + timestamp_granularities=word) — nguồn đo nhịp nói. */
export function openAiTranscriber(openai: OpenAI): Transcriber {
  return async (audio, opts) => {
    const file = await toFile(audio.buffer, `speech.${extFromMime(audio.mimeType)}`, { type: audio.mimeType });
    const r = (await openai.audio.transcriptions.create({
      file,
      model: SPEAKING_STT_MODEL,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      ...(opts.language ? { language: opts.language } : {}),
    })) as unknown as { text?: string; duration?: number; language?: string; words?: { start: number; end: number }[] };
    return {
      text: r.text ?? "",
      durationSec: Number(r.duration) || 0,
      words: (r.words ?? []).map((w) => ({ start: w.start, end: w.end })),
      language: r.language,
    };
  };
}

/** Khoá "vi" là mặc định của nền tảng (không nói lên ngôn ngữ đang học) nên để Whisper tự nhận. */
export function whisperLanguage(courseLanguage: string | null | undefined): string | undefined {
  const code = (courseLanguage ?? "").toLowerCase().split("-")[0] ?? "";
  return code.length >= 2 && code !== "vi" ? code : undefined;
}

const SPEAKING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: SPEAKING_CRITERIA.filter((k) => k !== "fluency") },
          level: { type: "string", enum: [...WRITING_LEVELS] },
          comment: { type: "string" },
        },
        required: ["key", "level", "comment"],
      },
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: [...SPEAKING_CATEGORIES] },
          quote: { type: "string" },
          correction: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["category", "quote", "correction", "explanation"],
      },
    },
    nextSteps: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "criteria", "errors", "nextSteps"],
};

export interface SpeakingFeedbackResult {
  feedbackId: string;
  status: "draft" | "approved" | "rejected";
  reused: boolean;
  body: SpeakingAnalysis;
  transcript: { text: string };
}

export interface SpeakingDeps {
  openai: OpenAiSource;
  /** Đọc file ghi âm từ kho của hệ thống; null nếu URL không phải file của hệ thống. */
  loadAudio: (attachmentUrl: string) => Promise<AudioPayload | null>;
  /** Mặc định: Whisper qua khách hàng OpenAI. Test đưa bản giả. */
  transcribe?: Transcriber;
}

async function emit(
  userId: string,
  courseId: string,
  eventType: string,
  eventKey: string,
  payload: Record<string, unknown>,
  db: PrismaClient,
) {
  try {
    await db.learningEvent.create({ data: { userId, courseId, eventType, eventKey, payload: payload as Prisma.InputJsonValue } });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
}

type TranscriptRow = {
  id: string;
  text: string;
  textHash: string;
  durationSec: number;
  metrics: Prisma.JsonValue;
};

function assertUsable(t: TranscriptRow) {
  if (t.durationSec > MAX_SPEAKING_SECONDS + SPEAKING_SECONDS_TOLERANCE) {
    throw new SpeakingFeedbackError("audio_too_long", { seconds: Math.round(t.durationSec), max: MAX_SPEAKING_SECONDS });
  }
  if ((t.metrics as unknown as SpeechMetrics).silent) throw new SpeakingFeedbackError("no_speech");
}

export async function requestSpeakingFeedback(
  userId: string,
  submissionId: string,
  deps: SpeakingDeps,
  opts: { model?: string } = {},
  db: PrismaClient = prisma,
): Promise<SpeakingFeedbackResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const sub = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      attachmentUrl: true,
      assignment: {
        select: {
          title: true,
          description: true,
          rubricText: true,
          lesson: { select: { module: { select: { courseId: true, course: { select: { languageMode: true, language: true } } } } } },
        },
      },
    },
  });
  if (!sub) throw new SpeakingFeedbackError("submission_not_found");
  if (sub.userId !== userId) throw new SpeakingFeedbackError("forbidden");
  const mod = sub.assignment.lesson?.module;
  if (!mod || !mod.course.languageMode) throw new SpeakingFeedbackError("not_language_course");
  const courseId = mod.courseId;
  if ((await resolveFeedbackVariant(userId, courseId, db)).variant === "minimal") {
    throw new SpeakingFeedbackError("control_group");
  }
  const audioUrl = sub.attachmentUrl?.trim();
  if (!audioUrl) throw new SpeakingFeedbackError("audio_missing");

  const getOpenai = async () => (typeof deps.openai === "function" ? await deps.openai() : deps.openai);

  // ── 1. Bản chữ: dùng lại nếu đã có cho ĐÚNG file này, nếu không thì chuyển văn bản (trả tiền một lần).
  let transcript: TranscriptRow | null = await db.submissionTranscript.findUnique({
    where: { submissionId_audioUrl: { submissionId, audioUrl } },
  });
  if (transcript) assertUsable(transcript);

  // Cùng bản chữ đã có góp ý (chưa bị từ chối) → trả bản cũ, không gọi AI/trừ token lại.
  const reuseCheck = async (t: TranscriptRow) => {
    const latest = await db.speakingFeedback.findFirst({ where: { submissionId }, orderBy: { generatedAt: "desc" } });
    if (latest && latest.transcriptHash === t.textHash && latest.status !== "rejected") {
      return {
        feedbackId: latest.id,
        status: latest.status,
        reused: true,
        body: latest.body as unknown as SpeakingAnalysis,
        transcript: { text: t.text },
      } satisfies SpeakingFeedbackResult;
    }
    return null;
  };
  if (transcript) {
    const r = await reuseCheck(transcript);
    if (r) return r;
  }

  const recent = await db.speakingFeedback.count({
    where: { submissionId, generatedAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (recent >= SPEAKING_FEEDBACK_MAX_PER_DAY) {
    throw new SpeakingFeedbackError("rate_limited", { limit: SPEAKING_FEEDBACK_MAX_PER_DAY });
  }

  if (!transcript) {
    const audio = await deps.loadAudio(audioUrl);
    if (!audio) throw new SpeakingFeedbackError("audio_not_hosted");
    if (audio.buffer.length > MAX_AUDIO_BYTES) {
      throw new SpeakingFeedbackError("audio_too_large", { bytes: audio.buffer.length, max: MAX_AUDIO_BYTES });
    }
    // Ví của HỌC VIÊN + trần hệ thống — kiểm TRƯỚC khi chạm Whisper.
    await assertWithinCaps(userId, db, "generator");
    const transcribe = deps.transcribe ?? openAiTranscriber(await getOpenai());
    const language = whisperLanguage(mod.course.language);
    let stt: TranscribeResult;
    try {
      stt = await transcribe(audio, { language });
    } catch (e) {
      throw new SpeakingFeedbackError("stt_failed", { message: (e as Error).message });
    }
    // Whisper đã chạy: ghi sổ + trừ ví theo thời lượng, KỂ CẢ khi sau đó không có tiếng nói/quá dài.
    await recordAiUsage(userId, SPEAKING_STT_MODEL, whisperChargeTokens(stt.durationSec), 0, db);
    const text = stt.text.trim();
    const metrics = measureSpeech(text, stt.words, stt.durationSec);
    try {
      transcript = await db.submissionTranscript.create({
        data: {
          submissionId,
          userId,
          courseId,
          audioUrl,
          textHash: hashSpeakingText(text),
          language: stt.language ?? language ?? null,
          text,
          metrics: metrics as unknown as Prisma.InputJsonValue,
          durationSec: stt.durationSec,
          model: SPEAKING_STT_MODEL,
        },
      });
    } catch (e) {
      // Hai lần bấm gần nhau: bản chữ đã được tạo bởi lần kia.
      if ((e as { code?: string }).code !== "P2002") throw e;
      transcript = await db.submissionTranscript.findUniqueOrThrow({ where: { submissionId_audioUrl: { submissionId, audioUrl } } });
    }
    assertUsable(transcript);
    const r = await reuseCheck(transcript);
    if (r) return r;
  }

  // ── 2. Chấm theo rubric.
  await assertWithinCaps(userId, db, "generator");
  const metrics = transcript.metrics as unknown as SpeechMetrics;
  const { system, user } = buildSpeakingPrompts({
    transcript: transcript.text,
    metrics,
    assignmentTitle: sub.assignment.title,
    assignmentDescription: sub.assignment.description,
    rubricText: sub.assignment.rubricText,
  });
  const openai = await getOpenai();
  const { data, inputTokens, outputTokens } = await callJsonModel<unknown>(
    openai,
    model,
    system,
    user,
    "speaking_feedback",
    SPEAKING_SCHEMA,
    2500,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  const analysis = normalizeSpeakingAnalysis(data, transcript.text, metrics);
  const coding = codeSpeakingFeedback(analysis);
  const row = await db.speakingFeedback.create({
    data: {
      submissionId,
      transcriptId: transcript.id,
      userId,
      courseId,
      transcriptHash: transcript.textHash,
      body: analysis as unknown as Prisma.InputJsonValue,
      model,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      level: coding.level,
      levels: coding.levels,
      elaboration: coding.elaboration,
      sourceKind: coding.sourceKind,
      generationContext: {
        promptVersion: SPEAKING_PROMPT_VERSION,
        model,
        sttModel: SPEAKING_STT_MODEL,
        transcriptHash: transcript.textHash,
        audioSeconds: Math.round(transcript.durationSec),
        droppedByFilter: analysis.dropped,
      } as Prisma.InputJsonValue,
    },
  });
  await emit(userId, courseId, LearningEventType.SpeakingFeedbackGenerated, `speaking.feedback.generated:${row.id}`, {
    feedbackId: row.id,
    submissionId,
    errorCount: analysis.errors.length,
    level: coding.level,
    elaboration: coding.elaboration,
  }, db);
  return { feedbackId: row.id, status: "draft", reused: false, body: analysis, transcript: { text: transcript.text } };
}

export interface LearnerSpeakingFeedback {
  feedbackId: string;
  /** unreviewed = bản nháp AI chưa được giảng viên duyệt (giao diện PHẢI hiện nhãn). */
  review: "unreviewed" | "approved";
  body: SpeakingAnalysis;
  reviewerNote: string | null;
  /** Bản chữ máy nghe được — gắn nhãn "có thể nghe sai" ở giao diện. */
  transcript: { text: string };
  generatedAt: Date;
}

export async function getSpeakingFeedbackForLearner(
  userId: string,
  submissionId: string,
  db: PrismaClient = prisma,
): Promise<LearnerSpeakingFeedback | null> {
  const row = await db.speakingFeedback.findFirst({
    where: { submissionId, userId, status: { in: ["draft", "approved"] } },
    orderBy: { generatedAt: "desc" },
    include: { transcript: { select: { text: true } } },
  });
  if (!row) return null;
  return {
    feedbackId: row.id,
    review: row.status === "approved" ? "approved" : "unreviewed",
    body: row.body as unknown as SpeakingAnalysis,
    reviewerNote: row.status === "approved" ? row.reviewerNote : null,
    transcript: { text: row.transcript.text },
    generatedAt: row.generatedAt,
  };
}

/** Bản chữ mới nhất + mọi bản góp ý của một bài nộp, cho giảng viên (tầng gọi đã kiểm quyền chấm khoá). */
export async function listSpeakingFeedbackForReview(submissionId: string, db: PrismaClient = prisma) {
  const [transcript, feedbacks] = await Promise.all([
    db.submissionTranscript.findFirst({
      where: { submissionId },
      orderBy: { createdAt: "desc" },
      select: { text: true, audioUrl: true, durationSec: true, language: true },
    }),
    db.speakingFeedback.findMany({ where: { submissionId }, orderBy: { generatedAt: "desc" } }),
  ]);
  return { transcript, feedbacks };
}

const ReviewInput = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(2000).optional(),
  removeErrorIds: z.array(z.string()).max(60).optional(),
  editErrors: z
    .array(z.object({ id: z.string(), correction: z.string().trim().min(1).max(300).optional(), explanation: z.string().trim().max(400).optional() }))
    .max(60)
    .optional(),
});
export type ReviewSpeakingFeedbackInput = z.input<typeof ReviewInput>;

export async function reviewSpeakingFeedback(
  reviewerId: string,
  feedbackId: string,
  rawInput: ReviewSpeakingFeedbackInput,
  db: PrismaClient = prisma,
): Promise<void> {
  const parsed = ReviewInput.safeParse(rawInput);
  if (!parsed.success) throw new SpeakingFeedbackError("validation_failed", parsed.error.flatten());
  const input = parsed.data;
  const row = await db.speakingFeedback.findUnique({ where: { id: feedbackId } });
  if (!row) throw new SpeakingFeedbackError("feedback_not_found");
  if (row.status !== "draft") throw new SpeakingFeedbackError("already_reviewed");

  let body = row.body as unknown as SpeakingAnalysis;
  if (input.action === "approve") {
    const remove = new Set(input.removeErrorIds ?? []);
    const edits = new Map((input.editErrors ?? []).map((e) => [e.id, e]));
    body = {
      ...body,
      // Chỉ sửa/xoá được lỗi ĐÃ CÓ; không thêm lỗi mới, không đổi danh mục hay trích đoạn.
      errors: body.errors
        .filter((e) => !remove.has(e.id))
        .map((e) => {
          const ed = edits.get(e.id);
          return ed ? { ...e, correction: ed.correction ?? e.correction, explanation: ed.explanation ?? e.explanation } : e;
        }),
    };
  }
  await db.speakingFeedback.update({
    where: { id: feedbackId },
    data: {
      status: input.action === "approve" ? "approved" : "rejected",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewerNote: input.note ?? null,
      ...(input.action === "approve" ? { body: body as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  await emit(
    reviewerId,
    row.courseId,
    input.action === "approve" ? LearningEventType.SpeakingFeedbackApproved : LearningEventType.SpeakingFeedbackRejected,
    `speaking.feedback.${input.action === "approve" ? "approved" : "rejected"}:${feedbackId}`,
    { feedbackId, submissionId: row.submissionId, learnerUserId: row.userId },
    db,
  );
}
