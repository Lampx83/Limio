import type OpenAI from "openai";
import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { callJsonModel } from "../aiTutor/generators";
import { resolveFeedbackVariant } from "../variant";
import {
  MAX_WRITING_UNITS,
  WRITING_CATEGORIES,
  WRITING_CRITERIA,
  WRITING_LEVELS,
  WRITING_PROMPT_VERSION,
  WritingFeedbackError,
  buildWritingPrompts,
  codeWritingFeedback,
  countWritingUnits,
  hashWritingText,
  normalizeWritingAnalysis,
  type WritingAnalysis,
  type WritingCategory,
} from "./analysis";

/**
 * LANG G6 — góp ý bài viết ngoại ngữ do AI. Học viên bấm, trừ ví token của HỌC VIÊN (không phải
 * giảng viên); bản sinh ra là NHÁP kèm nhãn "chưa duyệt" cho tới khi giảng viên duyệt/từ chối.
 * Quyền duyệt (giảng viên của khoá) do TẦNG GỌI kiểm trước (core-feedback không import core-lms).
 */

export const WRITING_FEEDBACK_MAX_PER_DAY = 3;
export const WRITING_SUMMARY_WINDOW_DAYS = 56; // 8 tuần
export const WRITING_FREQUENT_THRESHOLD = 3;
const DEFAULT_MODEL = "gpt-4o-mini";

const WRITING_SCHEMA = {
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
          key: { type: "string", enum: [...WRITING_CRITERIA] },
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
          category: { type: "string", enum: [...WRITING_CATEGORIES] },
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

type StoredBody = Omit<WritingAnalysis, never>;

export interface WritingFeedbackResult {
  feedbackId: string;
  status: "draft" | "approved" | "rejected";
  reused: boolean;
  body: StoredBody;
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
    if ((e as { code?: string }).code !== "P2002") throw e; // đã có (idempotent)
  }
}

/** Khách hàng OpenAI, hoặc hàm LẤY nó khi cần — để trường hợp trả bản cũ/bị từ chối sớm không đòi cấu hình AI. */
export type OpenAiSource = OpenAI | (() => Promise<OpenAI>);

export async function requestWritingFeedback(
  userId: string,
  submissionId: string,
  openaiSource: OpenAiSource,
  opts: { model?: string } = {},
  db: PrismaClient = prisma,
): Promise<WritingFeedbackResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const sub = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      body: true,
      assignment: {
        select: {
          title: true,
          description: true,
          rubricText: true,
          lesson: { select: { module: { select: { courseId: true, course: { select: { languageMode: true } } } } } },
        },
      },
    },
  });
  if (!sub) throw new WritingFeedbackError("submission_not_found");
  if (sub.userId !== userId) throw new WritingFeedbackError("forbidden");
  const mod = sub.assignment.lesson?.module;
  if (!mod || !mod.course.languageMode) throw new WritingFeedbackError("not_language_course");
  const courseId = mod.courseId;

  // Lớp đối chứng (B10) không nhận góp ý cá nhân hoá.
  if ((await resolveFeedbackVariant(userId, courseId, db)).variant === "minimal") {
    throw new WritingFeedbackError("control_group");
  }

  const units = countWritingUnits(sub.body);
  if (units === 0) throw new WritingFeedbackError("text_empty");
  if (units > MAX_WRITING_UNITS) throw new WritingFeedbackError("text_too_long", { units, max: MAX_WRITING_UNITS });

  const hash = hashWritingText(sub.body);
  const latest = await db.writingFeedback.findFirst({ where: { submissionId }, orderBy: { generatedAt: "desc" } });
  if (latest && latest.submissionHash === hash && latest.status !== "rejected") {
    return { feedbackId: latest.id, status: latest.status, reused: true, body: latest.body as unknown as StoredBody };
  }
  const recent = await db.writingFeedback.count({
    where: { submissionId, generatedAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (recent >= WRITING_FEEDBACK_MAX_PER_DAY) {
    throw new WritingFeedbackError("rate_limited", { limit: WRITING_FEEDBACK_MAX_PER_DAY });
  }

  // Trần hệ thống + ví token của HỌC VIÊN — kiểm TRƯỚC khi chạm OpenAI.
  await assertWithinCaps(userId, db, "generator");

  const { system, user } = buildWritingPrompts({
    text: sub.body,
    assignmentTitle: sub.assignment.title,
    assignmentDescription: sub.assignment.description,
    rubricText: sub.assignment.rubricText,
  });
  const openai = typeof openaiSource === "function" ? await openaiSource() : openaiSource;
  const { data, inputTokens, outputTokens } = await callJsonModel<unknown>(
    openai,
    model,
    system,
    user,
    "writing_feedback",
    WRITING_SCHEMA,
    2500,
  );
  // AI đã chạy và trả JSON hợp lệ: ghi sổ + trừ ví (kể cả khi bộ lọc sau đó loại hết). Lỗi hạ tầng
  // (ném ở callJsonModel) thì chưa tới đây nên không trừ.
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  const analysis = normalizeWritingAnalysis(data, sub.body);
  const coding = codeWritingFeedback(analysis);
  const row = await db.writingFeedback.create({
    data: {
      submissionId,
      userId,
      courseId,
      submissionHash: hash,
      body: analysis as unknown as Prisma.InputJsonValue,
      model,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      level: coding.level,
      levels: coding.levels,
      elaboration: coding.elaboration,
      sourceKind: coding.sourceKind,
      generationContext: {
        promptVersion: WRITING_PROMPT_VERSION,
        model,
        units,
        droppedByFilter: analysis.dropped,
      } as Prisma.InputJsonValue,
    },
  });
  await emit(userId, courseId, LearningEventType.WritingFeedbackGenerated, `writing.feedback.generated:${row.id}`, {
    feedbackId: row.id,
    submissionId,
    errorCount: analysis.errors.length,
    level: coding.level,
    elaboration: coding.elaboration,
  }, db);
  return { feedbackId: row.id, status: "draft", reused: false, body: analysis };
}

export interface LearnerWritingFeedback {
  feedbackId: string;
  /** unreviewed = bản nháp AI chưa được giảng viên duyệt (giao diện PHẢI hiện nhãn). */
  review: "unreviewed" | "approved";
  body: StoredBody;
  reviewerNote: string | null;
  generatedAt: Date;
}

/** Bản góp ý hiện hành của bài nộp cho học viên: nháp (kèm nhãn) hoặc đã duyệt; bản bị từ chối không hiện. */
export async function getWritingFeedbackForLearner(
  userId: string,
  submissionId: string,
  db: PrismaClient = prisma,
): Promise<LearnerWritingFeedback | null> {
  const row = await db.writingFeedback.findFirst({
    where: { submissionId, userId, status: { in: ["draft", "approved"] } },
    orderBy: { generatedAt: "desc" },
  });
  if (!row) return null;
  return {
    feedbackId: row.id,
    review: row.status === "approved" ? "approved" : "unreviewed",
    body: row.body as unknown as StoredBody,
    reviewerNote: row.status === "approved" ? row.reviewerNote : null,
    generatedAt: row.generatedAt,
  };
}

/** Mọi bản của một bài nộp, cho giảng viên (tầng gọi đã kiểm quyền chấm khoá). */
export async function listWritingFeedbackForReview(submissionId: string, db: PrismaClient = prisma) {
  return db.writingFeedback.findMany({ where: { submissionId }, orderBy: { generatedAt: "desc" } });
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
export type ReviewWritingFeedbackInput = z.input<typeof ReviewInput>;

export async function reviewWritingFeedback(
  reviewerId: string,
  feedbackId: string,
  rawInput: ReviewWritingFeedbackInput,
  db: PrismaClient = prisma,
): Promise<void> {
  const parsed = ReviewInput.safeParse(rawInput);
  if (!parsed.success) throw new WritingFeedbackError("validation_failed", parsed.error.flatten());
  const input = parsed.data;
  const row = await db.writingFeedback.findUnique({ where: { id: feedbackId } });
  if (!row) throw new WritingFeedbackError("feedback_not_found");
  if (row.status !== "draft") throw new WritingFeedbackError("already_reviewed");

  let body = row.body as unknown as StoredBody;
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
  const now = new Date();
  await db.writingFeedback.update({
    where: { id: feedbackId },
    data: {
      status: input.action === "approve" ? "approved" : "rejected",
      reviewedById: reviewerId,
      reviewedAt: now,
      reviewerNote: input.note ?? null,
      ...(input.action === "approve" ? { body: body as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  await emit(
    reviewerId,
    row.courseId,
    input.action === "approve" ? LearningEventType.WritingFeedbackApproved : LearningEventType.WritingFeedbackRejected,
    `writing.feedback.${input.action === "approve" ? "approved" : "rejected"}:${feedbackId}`,
    { feedbackId, submissionId: row.submissionId, learnerUserId: row.userId },
    db,
  );
}

export interface WritingErrorSummary {
  feedbackCount: number;
  totalErrors: number;
  categories: {
    category: WritingCategory;
    count: number;
    share: number;
    /** ≥ ngưỡng lặp lại mới là "hay gặp". */
    frequent: boolean;
    examples: { quote: string; correction: string }[];
  }[];
}

/**
 * Lỗi lặp lại của học viên trong khoá, từ các bản ĐÃ DUYỆT trong 8 tuần gần nhất (bản nháp/bị từ
 * chối không tính để AI sai không làm lệch hồ sơ). null = chưa có bản đã duyệt nào.
 */
export async function getWritingErrorSummary(
  userId: string,
  courseId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<WritingErrorSummary | null> {
  const since = new Date(now.getTime() - WRITING_SUMMARY_WINDOW_DAYS * 86_400_000);
  const rows = await db.writingFeedback.findMany({
    where: { userId, courseId, status: "approved", reviewedAt: { gte: since } },
    orderBy: { reviewedAt: "desc" },
    select: { body: true },
  });
  if (rows.length === 0) return null;
  const agg = new Map<WritingCategory, { count: number; examples: { quote: string; correction: string }[] }>();
  let total = 0;
  for (const r of rows) {
    for (const e of (r.body as unknown as StoredBody).errors) {
      total++;
      const a = agg.get(e.category) ?? { count: 0, examples: [] };
      a.count++;
      if (a.examples.length < 2) a.examples.push({ quote: e.quote, correction: e.correction });
      agg.set(e.category, a);
    }
  }
  return {
    feedbackCount: rows.length,
    totalErrors: total,
    categories: [...agg.entries()]
      .map(([category, a]) => ({
        category,
        count: a.count,
        share: total > 0 ? a.count / total : 0,
        frequent: a.count >= WRITING_FREQUENT_THRESHOLD,
        examples: a.examples,
      }))
      .sort((x, y) => y.count - x.count),
  };
}
