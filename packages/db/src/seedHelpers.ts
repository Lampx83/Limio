import { prisma, type PrismaClient } from "./index";

/** Seed-script equivalent of core-lms's resolveDefaultSectionId (can't import
 * core-lms from packages/db — would be a circular dependency). Finds or
 * creates the course's "Học viên chưa gán lớp" default CourseSection. */
export async function seedDefaultSectionId(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<string> {
  const existing = await db.courseSection.findFirst({
    where: { courseId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.courseSection.create({
    data: { courseId, name: "Học viên chưa gán lớp", isDefault: true },
    select: { id: true },
  });
  return created.id;
}
