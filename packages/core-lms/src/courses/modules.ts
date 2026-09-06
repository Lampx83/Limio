import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";

export const CreateModuleInput = z.object({
  title: z.string().min(1).max(200).trim(),
  orderIndex: z.number().int().nonnegative(),
});

export const UpdateModuleInput = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  isHidden: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

export async function createModule(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ moduleId: string }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CreateModuleInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const m = await db.module.create({
    data: { courseId, title: parsed.data.title, orderIndex: parsed.data.orderIndex },
  });
  return { moduleId: m.id };
}

export async function updateModule(
  actorUserId: string,
  moduleId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const mod = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!mod) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, mod.courseId, db);
  const parsed = UpdateModuleInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) return;
  await db.module.update({ where: { id: moduleId }, data });
}

export async function deleteModule(
  actorUserId: string,
  moduleId: string,
  db: DbClient = prisma,
): Promise<void> {
  const mod = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!mod) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, mod.courseId, db);
  await db.module.delete({ where: { id: moduleId } });
}

/**
 * Reorder modules within a course. `orderedModuleIds` lists every module ID
 * in the desired display order. Uses a 2-pass update to avoid the
 * (courseId, orderIndex) unique constraint during transitional state.
 */
export async function reorderModules(
  actorUserId: string,
  courseId: string,
  orderedModuleIds: string[],
  db: DbClient = prisma,
): Promise<void> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const existing = await db.module.findMany({
    where: { courseId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((m) => m.id));
  const incomingIds = new Set(orderedModuleIds);
  for (const id of orderedModuleIds) {
    if (!existingIds.has(id)) throw new CourseError("validation_failed", `unknown_module:${id}`);
  }
  if (incomingIds.size !== existingIds.size) {
    throw new CourseError("validation_failed", "must_include_all_modules");
  }
  // Run in transaction. Pass 1: shift to negative orderIndex slot per id;
  // Pass 2: set to final 0..N-1.
  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < orderedModuleIds.length; i++) {
      await tx.module.update({
        where: { id: orderedModuleIds[i]! },
        data: { orderIndex: -1 - i },
      });
    }
    for (let i = 0; i < orderedModuleIds.length; i++) {
      await tx.module.update({
        where: { id: orderedModuleIds[i]! },
        data: { orderIndex: i },
      });
    }
  });
}
