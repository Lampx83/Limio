import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";
import { attachLessonActivity } from "./lessonActivity";
import {
  ensureLessonTag,
  ensureQuestionTag,
  isAutoLessonSkillCode,
  removeLessonTag,
  syncLessonTagName,
} from "./autoTags";

export const CreateLessonInput = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2_000).optional(),
  orderIndex: z.number().int().nonnegative(),
  completionThresholdPct: z.number().int().min(1).max(100).optional(),
  durationSec: z.number().int().nonnegative().optional(),
});

export const UpdateLessonInput = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2_000).optional().nullable(),
  orderIndex: z.number().int().nonnegative().optional(),
  completionThresholdPct: z.number().int().min(1).max(100).optional().nullable(),
  durationSec: z.number().int().nonnegative().optional().nullable(),
  previewable: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

async function getCourseIdForLesson(lessonId: string, db: DbClient): Promise<string> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!row) throw new CourseAuthzError("not_found");
  return row.module.courseId;
}

export async function createLesson(
  actorUserId: string,
  moduleId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ lessonId: string }> {
  const mod = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!mod) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, mod.courseId, db);
  const parsed = CreateLessonInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const l = await db.lesson.create({ data: { moduleId, ...parsed.data } });
  // B1.5 — every lesson carries its own tag so personalization has something to
  // work with without the instructor tagging anything by hand.
  await ensureLessonTag(l.id, db);
  return { lessonId: l.id };
}

export async function updateLesson(
  actorUserId: string,
  lessonId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = UpdateLessonInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const { orderIndex, ...rest } = parsed.data;
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));

  if (orderIndex !== undefined) {
    // (moduleId, orderIndex) là UNIQUE, nên gán thẳng số thứ tự người dùng gõ
    // sẽ đụng bài đang giữ chỗ đó và ném P2002 — API trả 500, form đứng im,
    // học viên/GV chỉ thấy "bấm Lưu không ăn". Coi ORDER là "chuyển bài này
    // tới vị trí thứ N" và đánh số lại cả module.
    await moveLessonToPosition(lessonId, orderIndex, Object.keys(data).length > 0 ? data : null, db);
  } else if (Object.keys(data).length > 0) {
    await db.lesson.update({ where: { id: lessonId }, data });
  } else {
    return;
  }

  if (parsed.data.title !== undefined) {
    await syncLessonTagName(lessonId, parsed.data.title, db);
  }
}

/**
 * Đặt lesson vào vị trí `position` trong module của nó rồi đánh số lại các bài
 * còn lại thành 0..n-1. Hai pha (âm rồi dương) để không đụng unique
 * (moduleId, orderIndex) giữa chừng — cùng cách reorderLessons đang làm.
 */
async function moveLessonToPosition(
  lessonId: string,
  position: number,
  otherData: Record<string, unknown> | null,
  db: DbClient,
): Promise<void> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { moduleId: true, orderIndex: true },
  });
  if (!lesson) throw new CourseAuthzError("not_found");

  const siblings = await db.lesson.findMany({
    where: { moduleId: lesson.moduleId },
    select: { id: true },
    orderBy: { orderIndex: "asc" },
  });
  const rest = siblings.map((l) => l.id).filter((id) => id !== lessonId);
  const target = Math.min(Math.max(position, 0), rest.length);
  const ordered = [...rest.slice(0, target), lessonId, ...rest.slice(target)];

  const unchanged =
    lesson.orderIndex === target && ordered.every((id, i) => siblings[i]?.id === id);
  if (unchanged) {
    if (otherData) await db.lesson.update({ where: { id: lessonId }, data: otherData });
    return;
  }

  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i++) {
      await tx.lesson.update({ where: { id: ordered[i]! }, data: { orderIndex: -1 - i } });
    }
    for (let i = 0; i < ordered.length; i++) {
      await tx.lesson.update({
        where: { id: ordered[i]! },
        data: ordered[i] === lessonId && otherData ? { orderIndex: i, ...otherData } : { orderIndex: i },
      });
    }
  });
}

export async function deleteLesson(
  actorUserId: string,
  lessonId: string,
  db: DbClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  await removeLessonTag(lessonId, db);
  await db.lesson.delete({ where: { id: lessonId } });
}

/**
 * Move a lesson to a different module within the same course. Appends to the
 * end of the target module (orderIndex = max + 1) to keep things simple.
 */
export async function moveLessonToModule(
  actorUserId: string,
  lessonId: string,
  targetModuleId: string,
  db: DbClient = prisma,
): Promise<void> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { moduleId: true, module: { select: { courseId: true } } },
  });
  if (!lesson) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, lesson.module.courseId, db);

  if (lesson.moduleId === targetModuleId) return;

  const target = await db.module.findUnique({
    where: { id: targetModuleId },
    select: { courseId: true },
  });
  if (!target) throw new CourseError("validation_failed", "target_module_not_found");
  if (target.courseId !== lesson.module.courseId) {
    throw new CourseError("validation_failed", "cross_course_move_forbidden");
  }

  const max = await db.lesson.aggregate({
    where: { moduleId: targetModuleId },
    _max: { orderIndex: true },
  });
  const nextOrder = (max._max.orderIndex ?? -1) + 1;

  await db.lesson.update({
    where: { id: lessonId },
    data: { moduleId: targetModuleId, orderIndex: nextOrder },
  });
}

/**
 * Deep-clone a lesson (incl. content items, quizzes with questions+options,
 * assignments, skill tags) within the same module. Cloned lesson appended at
 * end. Skips per-user data (notes, forum, attempts, AI conversations).
 */
export async function duplicateLesson(
  actorUserId: string,
  lessonId: string,
  db: DbClient = prisma,
): Promise<{ lessonId: string }> {
  const src = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { select: { courseId: true } },
      contentItems: { orderBy: { orderIndex: "asc" } },
      skillTags: { select: { skillId: true, skill: { select: { code: true } } } },
      assignments: true,
      quizzes: {
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
            include: {
              options: { orderBy: { orderIndex: "asc" } },
              skillTags: { select: { skillId: true, skill: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });
  if (!src) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, src.module.courseId, db);

  const max = await db.lesson.aggregate({
    where: { moduleId: src.moduleId },
    _max: { orderIndex: true },
  });
  const nextOrder = (max._max.orderIndex ?? -1) + 1;

  return (db as typeof prisma).$transaction(async (tx) => {
    const dup = await tx.lesson.create({
      data: {
        moduleId: src.moduleId,
        title: `${src.title} (bản sao)`,
        description: src.description,
        orderIndex: nextOrder,
        completionThresholdPct: src.completionThresholdPct,
        durationSec: src.durationSec,
        previewable: src.previewable,
        // Cloned lessons start hidden so instructor can review before exposing.
        isHidden: true,
      },
    });

    // Skill tags on the lesson itself. B1.5 auto tags are lesson-specific, so
    // the clone mints its own instead of inheriting the source's.
    for (const t of src.skillTags) {
      if (isAutoLessonSkillCode(t.skill.code)) continue;
      await tx.contentSkillMapping.create({
        data: { contentType: "lesson", contentId: dup.id, skillId: t.skillId },
      });
    }
    await ensureLessonTag(dup.id, tx);

    // Content items
    for (const ci of src.contentItems) {
      const ciDup = await tx.contentItem.create({
        data: {
          lessonId: dup.id,
          type: ci.type,
          payload: ci.payload as object,
          orderIndex: ci.orderIndex,
          isHidden: ci.isHidden,
        },
      });
      await attachLessonActivity(tx, dup.id, "content", ciDup.id);
    }

    // Assignments
    for (const a of src.assignments) {
      const aDup = await tx.assignment.create({
        data: {
          lessonId: dup.id,
          title: a.title,
          description: a.description,
          dueAt: a.dueAt,
          maxScore: a.maxScore,
          isHidden: a.isHidden,
        },
      });
      await attachLessonActivity(tx, dup.id, "assignment", aDup.id);
    }

    // Quizzes (deep: questions + options + question skill tags)
    for (const q of src.quizzes) {
      const quizDup = await tx.quiz.create({
        data: {
          lessonId: dup.id,
          courseId: q.courseId,
          title: q.title,
          difficulty: q.difficulty,
          requireConfidence: q.requireConfidence,
          timeLimitSec: q.timeLimitSec,
          maxAttempts: q.maxAttempts,
          isHidden: q.isHidden,
        },
      });
      await attachLessonActivity(tx, dup.id, "quiz", quizDup.id);
      for (const qq of q.questions) {
        const questionDup = await tx.quizQuestion.create({
          data: {
            quizId: quizDup.id,
            type: qq.type,
            prompt: qq.prompt,
            points: qq.points,
            orderIndex: qq.orderIndex,
            explanation: qq.explanation,
            extra: qq.extra as object,
          },
        });
        for (const opt of qq.options) {
          await tx.questionOption.create({
            data: {
              questionId: questionDup.id,
              label: opt.label,
              isCorrect: opt.isCorrect,
              orderIndex: opt.orderIndex,
              misconceptionId: opt.misconceptionId,
              extra: opt.extra as object,
            },
          });
        }
        for (const st of qq.skillTags) {
          if (isAutoLessonSkillCode(st.skill.code)) continue;
          await tx.questionSkillTag.create({
            data: { questionId: questionDup.id, skillId: st.skillId },
          });
        }
        await ensureQuestionTag(questionDup.id, tx);
      }
    }

    return { lessonId: dup.id };
  });
}

/**
 * Reorder lessons within a module. 2-pass update to dodge the
 * (moduleId, orderIndex) unique constraint.
 */
export async function reorderLessons(
  actorUserId: string,
  moduleId: string,
  orderedLessonIds: string[],
  db: DbClient = prisma,
): Promise<void> {
  const mod = await db.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) throw new CourseError("validation_failed", "module_not_found");
  await assertCanEditCourse(actorUserId, mod.courseId, db);
  const existing = await db.lesson.findMany({
    where: { moduleId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((l) => l.id));
  for (const id of orderedLessonIds) {
    if (!existingIds.has(id)) throw new CourseError("validation_failed", `unknown_lesson:${id}`);
  }
  if (orderedLessonIds.length !== existingIds.size) {
    throw new CourseError("validation_failed", "must_include_all_lessons");
  }
  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await tx.lesson.update({
        where: { id: orderedLessonIds[i]! },
        data: { orderIndex: -1 - i },
      });
    }
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await tx.lesson.update({
        where: { id: orderedLessonIds[i]! },
        data: { orderIndex: i },
      });
    }
  });
}
