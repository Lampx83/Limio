/**
 * A6 — CourseSection: "lớp học" tách khỏi nội dung course, mỗi section có
 * invite link riêng để học viên tự enroll (Enrollment.sectionId).
 *
 * KHÁC với CohortMember (packages/core-lms/src/exam/cohorts.ts) — đó là
 * roster dùng cho exam-gating (assertEligibleForExam), tách biệt với
 * Enrollment.sectionId trong vòng MVP này. File này chỉ quản lý section CRUD
 * + invite code + roster theo Enrollment; không đụng vào exam-gating.
 */

import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { generateSectionInviteCode } from "../exam/code-access";
import { assertCanEditCourse } from "./authz";
import { CourseError } from "./courses";
import { getCourseProgress } from "../learning/progress";

export const CreateCourseSectionInput = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
});

export const UpdateCourseSectionInput = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional().nullable(),
});

const INVITE_CODE_MAX_ATTEMPTS = 5;

async function createUniqueInviteCode(db: PrismaClient): Promise<string> {
  for (let i = 0; i < INVITE_CODE_MAX_ATTEMPTS; i++) {
    const code = generateSectionInviteCode();
    const existing = await db.courseSection.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique section invite code");
}

export interface CourseSectionItem {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string | null;
  isDefault: boolean;
  enrolledCount: number;
  createdAt: string;
}

/** Create a new section under a course, with a freshly generated invite code. */
export async function createCourseSection(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<CourseSectionItem> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CreateCourseSectionInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());

  const inviteCode = await createUniqueInviteCode(db);
  try {
    const section = await db.courseSection.create({
      data: {
        courseId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        inviteCode,
        isDefault: false,
      },
    });
    return {
      id: section.id,
      name: section.name,
      description: section.description,
      inviteCode: section.inviteCode,
      isDefault: section.isDefault,
      enrolledCount: 0,
      createdAt: section.createdAt.toISOString(),
    };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new CourseError("section_name_taken");
    }
    throw e;
  }
}

/** List sections of a course (excludes the auto-created default section). */
export async function listCourseSections(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<CourseSectionItem[]> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const rows = await db.courseSection.findMany({
    where: { courseId, isDefault: false },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { enrollments: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    inviteCode: r.inviteCode,
    isDefault: r.isDefault,
    enrolledCount: r._count.enrollments,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function assertCanEditSection(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient,
): Promise<{ id: string; courseId: string; isDefault: boolean }> {
  const section = await db.courseSection.findUnique({
    where: { id: sectionId },
    select: { id: true, courseId: true, isDefault: true },
  });
  if (!section) throw new CourseError("section_not_found");
  await assertCanEditCourse(actorUserId, section.courseId, db);
  return section;
}

export async function updateCourseSection(
  actorUserId: string,
  sectionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const section = await assertCanEditSection(actorUserId, sectionId, db);
  if (section.isDefault) throw new CourseError("section_not_found");
  const parsed = UpdateCourseSectionInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());

  const data: { name?: string; description?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (Object.keys(data).length === 0) return;

  try {
    await db.courseSection.update({ where: { id: sectionId }, data });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new CourseError("section_name_taken");
    }
    throw e;
  }
}

/** Delete a section. Rejects if it still has active enrollments — reassign or drop them first. */
export async function deleteCourseSection(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const section = await assertCanEditSection(actorUserId, sectionId, db);
  if (section.isDefault) throw new CourseError("section_not_found");

  const activeCount = await db.enrollment.count({
    where: { sectionId, status: { in: ["active", "completed"] } },
  });
  if (activeCount > 0) throw new CourseError("section_has_enrollments");

  await db.courseSection.delete({ where: { id: sectionId } });
}

/** Rotate a section's invite code — the old link stops resolving immediately. */
export async function regenerateInviteCode(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<{ inviteCode: string }> {
  const section = await assertCanEditSection(actorUserId, sectionId, db);
  if (section.isDefault) throw new CourseError("section_not_found");

  const inviteCode = await createUniqueInviteCode(db);
  await db.courseSection.update({ where: { id: sectionId }, data: { inviteCode } });
  return { inviteCode };
}

export interface SectionRosterEntry {
  enrollmentId: string;
  status: "active" | "completed" | "dropped" | "refunded";
  enrolledAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  completedLessons: number;
  totalLessons: number;
  courseCompletionPct: number;
  latestQuizScorePct: number | null;
}

export interface SectionRoster {
  section: {
    id: string;
    name: string;
    description: string | null;
    courseId: string;
    courseTitle: string;
  };
  otherSections: Array<{ id: string; name: string }>;
  entries: SectionRosterEntry[];
}

/** Roster of a section: enrolled learners + course-progress % + latest quiz score. */
export async function getSectionRoster(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<SectionRoster> {
  const section = await assertCanEditSection(actorUserId, sectionId, db);

  const [sectionRow, course, enrollments, otherSections] = await Promise.all([
    db.courseSection.findUniqueOrThrow({
      where: { id: sectionId },
      select: { name: true, description: true },
    }),
    db.course.findUniqueOrThrow({
      where: { id: section.courseId },
      select: { title: true },
    }),
    db.enrollment.findMany({
      where: { sectionId },
      orderBy: { enrolledAt: "desc" },
      include: {
        user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
      },
    }),
    db.courseSection.findMany({
      where: { courseId: section.courseId, isDefault: false, id: { not: sectionId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const entries = await Promise.all(
    enrollments.map(async (e): Promise<SectionRosterEntry> => {
      const [progress, latestAttempt] = await Promise.all([
        getCourseProgress(e.userId, section.courseId, db),
        db.quizAttempt.findFirst({
          where: {
            userId: e.userId,
            status: "submitted",
            quiz: { courseId: section.courseId, tournamentMissionId: null },
          },
          orderBy: { submittedAt: "desc" },
          select: { scorePct: true },
        }),
      ]);
      return {
        enrollmentId: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        user: e.user,
        completedLessons: progress.completedLessons,
        totalLessons: progress.totalLessons,
        courseCompletionPct: progress.courseCompletionPct,
        latestQuizScorePct: latestAttempt?.scorePct ?? null,
      };
    }),
  );

  return {
    section: {
      id: sectionId,
      name: sectionRow.name,
      description: sectionRow.description,
      courseId: section.courseId,
      courseTitle: course.title,
    },
    otherSections,
    entries,
  };
}

/** Move an enrollment to a different section of the same course. */
export async function transferEnrollmentSection(
  actorUserId: string,
  enrollmentId: string,
  targetSectionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, courseId: true, sectionId: true },
  });
  if (!enrollment) throw new CourseError("not_found");
  await assertCanEditCourse(actorUserId, enrollment.courseId, db);

  if (targetSectionId === enrollment.sectionId) return;

  const targetSection = await db.courseSection.findUnique({
    where: { id: targetSectionId },
    select: { id: true, courseId: true },
  });
  if (!targetSection || targetSection.courseId !== enrollment.courseId) {
    throw new CourseError("section_not_found");
  }

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { sectionId: targetSectionId },
  });
}
