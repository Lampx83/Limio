import { z } from "zod";
import { prisma, type PrismaClient, type ExamAsset } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { ExamError } from "./types";

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per A7.2.2

export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
] as const;

export const AUDIO_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — accommodates ~20 min @ 192kbps

const RegisterImageInput = z.object({
  s3Key: z.string().min(1).max(500),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(IMAGE_MAX_BYTES),
  altText: z.string().min(1).max(500).trim(),
  metadata: z
    .object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
    .optional(),
});

async function assertExamEditable(examId: string, actorUserId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditExam(actorUserId, exam, db);
  return exam;
}

/**
 * A7.2.2 — Register an already-uploaded image as an ExamAsset.
 * The route handler is responsible for streaming the file to storage and
 * computing a stable s3Key before calling this. Alt text is required —
 * empty/missing alt text rejected per accessibility AC.
 */
export async function createImageAsset(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ assetId: string }> {
  await assertExamEditable(examId, actorUserId, db);
  const parsed = RegisterImageInput.safeParse(rawInput);
  if (!parsed.success) {
    // Alt text is the most common reject — surface it explicitly so the UI can
    // map it to the "alt text required" banner without parsing zod details.
    const altPath = parsed.error.issues.find((i) => i.path[0] === "altText");
    if (altPath) throw new ExamError("alt_text_required");
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  const d = parsed.data;
  const asset = await db.examAsset.create({
    data: {
      examId,
      type: "image",
      s3Key: d.s3Key,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      altText: d.altText,
      metadata: d.metadata ?? undefined,
      uploadedById: actorUserId,
    },
    select: { id: true },
  });
  return { assetId: asset.id };
}

const RegisterAudioInput = z.object({
  s3Key: z.string().min(1).max(500),
  mimeType: z.enum(AUDIO_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(AUDIO_MAX_BYTES),
  altText: z.string().min(1).max(500).trim(),
  transcript: z.string().max(20_000).optional(),
  metadata: z
    .object({
      durationSec: z.number().positive().optional(),
    })
    .optional(),
});

/**
 * Register an uploaded audio file as an ExamAsset. Alt text required for
 * accessibility; transcript optional (becomes mandatory at publish-time for
 * once-only audio policies per spec, validated later by publish flow).
 */
export async function createAudioAsset(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ assetId: string }> {
  await assertExamEditable(examId, actorUserId, db);
  const parsed = RegisterAudioInput.safeParse(rawInput);
  if (!parsed.success) {
    const altPath = parsed.error.issues.find((i) => i.path[0] === "altText");
    if (altPath) throw new ExamError("alt_text_required");
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  const d = parsed.data;
  const asset = await db.examAsset.create({
    data: {
      examId,
      type: "audio",
      s3Key: d.s3Key,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      altText: d.altText,
      transcript: d.transcript ?? null,
      metadata: d.metadata ?? undefined,
      uploadedById: actorUserId,
    },
    select: { id: true },
  });
  return { assetId: asset.id };
}

export async function deleteAsset(
  actorUserId: string,
  assetId: string,
  db: PrismaClient = prisma,
): Promise<ExamAsset> {
  const asset = await db.examAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new ExamError("asset_not_found");
  await assertExamEditable(asset.examId, actorUserId, db);
  await db.examAsset.delete({ where: { id: assetId } });
  return asset;
}
