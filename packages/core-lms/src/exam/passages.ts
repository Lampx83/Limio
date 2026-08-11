import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { ExamError } from "./types";

const audioPolicy = z.enum(["free_replay", "limited_replay", "once_only"]);
const revealMode = z.enum(["all_at_once", "sequential"]);

/**
 * Minimal Tiptap-style doc shape. We don't deep-validate node content —
 * editors evolve faster than schemas — but we require the top-level skeleton
 * so we can render it safely and reject obviously-broken input.
 */
const contentJsonSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).default([]),
});

export const CreatePassageInput = z
  .object({
    title: z.string().min(1).max(300).trim(),
    contentJson: contentJsonSchema,
    orderIndex: z.number().int().min(0).optional(),
    audioPolicy: audioPolicy.optional(),
    maxAudioPlays: z.number().int().min(1).max(10).optional(),
    revealMode: revealMode.optional(),
    skillIds: z.array(z.string().uuid()).max(20).optional(),
  })
  .refine(
    (d) =>
      d.audioPolicy !== "limited_replay" ||
      (d.maxAudioPlays !== undefined && d.maxAudioPlays >= 1),
    {
      message: "maxAudioPlays required when audioPolicy=limited_replay",
      path: ["maxAudioPlays"],
    },
  );

export const UpdatePassageInput = z
  .object({
    title: z.string().min(1).max(300).trim().optional(),
    contentJson: contentJsonSchema.optional(),
    audioPolicy: audioPolicy.optional(),
    maxAudioPlays: z.number().int().min(1).max(10).nullable().optional(),
    revealMode: revealMode.optional(),
    skillIds: z.array(z.string().uuid()).max(20).optional(),
  });

async function assertExamDraft(examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status === "archived") throw new ExamError("exam_not_draft");
  return exam;
}

async function loadPassageWithCourse(passageId: string, db: PrismaClient) {
  const p = await db.examPassage.findUnique({
    where: { id: passageId },
    select: { id: true, examId: true, exam: { select: { courseId: true, status: true } } },
  });
  if (!p) throw new ExamError("passage_not_found");
  return p;
}

/** A7.2.1 — Create passage at given orderIndex (or append). */
export async function createPassage(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ passageId: string }> {
  const exam = await assertExamDraft(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const parsed = CreatePassageInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  const orderIndex =
    d.orderIndex ??
    (await db.examPassage.count({ where: { examId } }));

  const passage = await (db as typeof prisma).$transaction(async (tx) => {
    const p = await tx.examPassage.create({
      data: {
        examId,
        title: d.title,
        contentJson: d.contentJson as Prisma.InputJsonValue,
        orderIndex,
        audioPolicy: d.audioPolicy ?? "free_replay",
        maxAudioPlays:
          d.audioPolicy === "limited_replay" ? (d.maxAudioPlays ?? null) : null,
        revealMode: d.revealMode ?? "all_at_once",
      },
      select: { id: true },
    });
    if (d.skillIds && d.skillIds.length > 0) {
      await tx.examPassageSkillTag.createMany({
        data: d.skillIds.map((skillId) => ({ passageId: p.id, skillId })),
        skipDuplicates: true,
      });
    }
    return p;
  });

  return { passageId: passage.id };
}

export async function updatePassage(
  actorUserId: string,
  passageId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const p = await loadPassageWithCourse(passageId, db);
  if (p.exam.status === "archived") throw new ExamError("exam_not_draft");
  await assertCanEditCourse(actorUserId, p.exam.courseId, db);
  const parsed = UpdatePassageInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  // If switching to limited_replay, maxAudioPlays must be set (either in this
  // patch or already on the row).
  if (d.audioPolicy === "limited_replay") {
    const current = await db.examPassage.findUniqueOrThrow({
      where: { id: passageId },
      select: { maxAudioPlays: true },
    });
    const effective = d.maxAudioPlays ?? current.maxAudioPlays;
    if (!effective || effective < 1) {
      throw new ExamError("audio_policy_invalid", "maxAudioPlays required");
    }
  }

  await (db as typeof prisma).$transaction(async (tx) => {
    const data: Prisma.ExamPassageUpdateInput = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.contentJson !== undefined)
      data.contentJson = d.contentJson as Prisma.InputJsonValue;
    if (d.audioPolicy !== undefined) data.audioPolicy = d.audioPolicy;
    if (d.maxAudioPlays !== undefined) data.maxAudioPlays = d.maxAudioPlays;
    if (d.revealMode !== undefined) data.revealMode = d.revealMode;
    // Clear maxAudioPlays when policy is not limited.
    if (d.audioPolicy && d.audioPolicy !== "limited_replay") {
      data.maxAudioPlays = null;
    }
    if (Object.keys(data).length > 0) {
      await tx.examPassage.update({ where: { id: passageId }, data });
    }
    if (d.skillIds !== undefined) {
      await tx.examPassageSkillTag.deleteMany({ where: { passageId } });
      if (d.skillIds.length > 0) {
        await tx.examPassageSkillTag.createMany({
          data: d.skillIds.map((skillId) => ({ passageId, skillId })),
          skipDuplicates: true,
        });
      }
    }
  });
}

export async function deletePassage(
  actorUserId: string,
  passageId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const p = await loadPassageWithCourse(passageId, db);
  if (p.exam.status === "archived") throw new ExamError("exam_not_draft");
  await assertCanEditCourse(actorUserId, p.exam.courseId, db);
  await db.examPassage.delete({ where: { id: passageId } });
}

/** A7.2.4 — Reorder passages within an exam. Same 2-pass technique as modules. */
export async function reorderPassages(
  actorUserId: string,
  examId: string,
  orderedPassageIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await assertExamDraft(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const existing = await db.examPassage.findMany({
    where: { examId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  const incoming = new Set(orderedPassageIds);
  for (const id of orderedPassageIds) {
    if (!existingIds.has(id)) throw new ExamError("unknown_passage", id);
  }
  if (incoming.size !== existingIds.size) {
    throw new ExamError("must_include_all_passages");
  }
  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < orderedPassageIds.length; i++) {
      await tx.examPassage.update({
        where: { id: orderedPassageIds[i]! },
        data: { orderIndex: -1 - i },
      });
    }
    for (let i = 0; i < orderedPassageIds.length; i++) {
      await tx.examPassage.update({
        where: { id: orderedPassageIds[i]! },
        data: { orderIndex: i },
      });
    }
  });
}
