/**
 * A5.2.5 — Clone exam (P2 T4-D7).
 *
 * Deep copy of an exam's authoring state into a new draft exam in the same
 * course (default) or a target course the actor can edit. Copies:
 *   - meta (title, description, durations, configs)
 *   - passages + assets (asset rows duplicated)
 *   - questions + skill tags
 *   - sections + section items (re-mapped to new question ids)
 *   - ExamQuestionFromBank links (preserved, point to original bank versions)
 *
 * Does NOT copy:
 *   - attempts, answers, incidents, messages (per-attempt state)
 *   - schedules, candidates, openCode (per-deployment state)
 *   - publishedAt (reset; new exam starts as draft)
 */

import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse, assertCanEditExam } from "../courses/authz";
import { ExamError } from "./types";

export const CloneExamInput = z.object({
  /** Target course; defaults to source course. Actor must edit both. */
  targetCourseId: z.string().uuid().optional(),
  /** New title; defaults to "Copy of <original>". */
  title: z.string().min(1).max(200).trim().optional(),
});

export async function cloneExam(
  actorUserId: string,
  sourceExamId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ examId: string }> {
  const parsed = CloneExamInput.safeParse(rawInput ?? {});
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());

  const source = await db.exam.findUnique({
    where: { id: sourceExamId },
    include: {
      passages: true,
      questions: {
        include: { skillTags: true, fromBank: true, sectionItem: true },
      },
      assets: true,
      sections: true,
    },
  });
  if (!source) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, source, db);
  const targetCourseId = parsed.data.targetCourseId ?? source.courseId;
  if (targetCourseId && targetCourseId !== source.courseId)
    await assertCanEditCourse(actorUserId, targetCourseId, db);

  return (db as typeof prisma).$transaction(async (tx) => {
    // 1) Create the new exam shell — reset to draft, drop publish-time fields.
    const newExam = await tx.exam.create({
      data: {
        courseId: targetCourseId,
        title: parsed.data.title ?? `Copy of ${source.title}`,
        description: source.description,
        durationMin: source.durationMin,
        openAt: source.openAt,
        closeAt: source.closeAt,
        attemptPolicy: source.attemptPolicy,
        maxAttempts: source.maxAttempts,
        gradingMode: source.gradingMode,
        proctoringLevel: source.proctoringLevel,
        shuffleQuestions: source.shuffleQuestions,
        shuffleOptions: source.shuffleOptions,
        showResultsAfterSubmit: source.showResultsAfterSubmit,
        status: "draft",
        // Code-based access reset to authenticated — instructor wires fresh.
        accessMode: "authenticated",
      },
      select: { id: true },
    });

    // 2) Duplicate assets first — passages may reference asset ids in their
    //    contentJson, but mapping that JSON is a separate task. For prototype
    //    we copy asset rows so the s3Keys still work; passage contentJson
    //    references the OLD asset ids and rendering still resolves because
    //    s3Keys are shared. Future: rewrite contentJson with mapped ids.
    const assetIdMap = new Map<string, string>();
    for (const a of source.assets) {
      const ns = await tx.examAsset.create({
        data: {
          examId: newExam.id,
          type: a.type,
          s3Key: a.s3Key,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          metadata: a.metadata as Prisma.InputJsonValue | undefined,
          altText: a.altText,
          transcript: a.transcript,
          uploadedById: a.uploadedById,
        },
        select: { id: true },
      });
      assetIdMap.set(a.id, ns.id);
    }

    // 3) Passages.
    const passageIdMap = new Map<string, string>();
    for (const p of source.passages) {
      const np = await tx.examPassage.create({
        data: {
          examId: newExam.id,
          title: p.title,
          contentJson: p.contentJson as Prisma.InputJsonValue,
          orderIndex: p.orderIndex,
          audioPolicy: p.audioPolicy,
          maxAudioPlays: p.maxAudioPlays,
          revealMode: p.revealMode,
        },
        select: { id: true },
      });
      passageIdMap.set(p.id, np.id);
    }
    // Skill tags on passages
    const skillTagsP = await tx.examPassageSkillTag.findMany({
      where: { passageId: { in: source.passages.map((p) => p.id) } },
    });
    for (const t of skillTagsP) {
      const npId = passageIdMap.get(t.passageId);
      if (!npId) continue;
      await tx.examPassageSkillTag.create({
        data: { passageId: npId, skillId: t.skillId, weight: t.weight },
      });
    }

    // 4) Questions (+ skill tags + bank-link).
    const questionIdMap = new Map<string, string>();
    for (const q of source.questions) {
      const nq = await tx.examQuestion.create({
        data: {
          examId: newExam.id,
          passageId: q.passageId ? passageIdMap.get(q.passageId) ?? null : null,
          type: q.type,
          prompt: q.prompt,
          config: q.config as Prisma.InputJsonValue,
          evidenceSpan: q.evidenceSpan as Prisma.InputJsonValue | undefined,
          points: q.points,
          orderInPassage: q.orderInPassage,
          orderInExam: q.orderInExam,
        },
        select: { id: true },
      });
      questionIdMap.set(q.id, nq.id);
      // skill tags
      for (const t of q.skillTags) {
        await tx.examQuestionSkillTag.create({
          data: { questionId: nq.id, skillId: t.skillId, weight: t.weight },
        });
      }
      // fromBank link preserved (points at same source version → frozen)
      if (q.fromBank) {
        await tx.examQuestionFromBank.create({
          data: {
            examQuestionId: nq.id,
            bankQuestionId: q.fromBank.bankQuestionId,
            bankQuestionVersionId: q.fromBank.bankQuestionVersionId,
          },
        });
      }
    }

    // 5) Sections + section items.
    const sectionIdMap = new Map<string, string>();
    for (const s of source.sections) {
      const ns = await tx.examSection.create({
        data: {
          examId: newExam.id,
          title: s.title,
          orderIndex: s.orderIndex,
          selectionMode: s.selectionMode,
          resolutionMode: s.resolutionMode,
          poolFilter: s.poolFilter as Prisma.InputJsonValue | undefined,
          materializedQuestionIds:
            s.materializedQuestionIds as Prisma.InputJsonValue | undefined,
        },
        select: { id: true },
      });
      sectionIdMap.set(s.id, ns.id);
    }
    // Section items — pull from source questions (where sectionItem exists)
    for (const q of source.questions) {
      if (!q.sectionItem) continue;
      const newSectionId = sectionIdMap.get(q.sectionItem.sectionId);
      const newQuestionId = questionIdMap.get(q.id);
      if (!newSectionId || !newQuestionId) continue;
      await tx.examSectionItem.create({
        data: {
          sectionId: newSectionId,
          examQuestionId: newQuestionId,
          orderInSection: q.sectionItem.orderInSection,
          points: q.sectionItem.points,
        },
      });
    }

    return { examId: newExam.id };
  });
}
