/**
 * A5.8 — Manage Exam.accessMode + openCode + openMaxAttempts from instructor
 * admin. Separate from `updateExam` because the access surface is conceptually
 * a distinct tab (different audit trail, different rules: can't change mode
 * while an attempt is in-flight).
 */

import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { generateOpenCode } from "./code-access";
import { ExamError } from "./types";

const AccessMode = z.enum(["authenticated", "open_code", "assigned_code"]);

export const UpdateExamAccessInput = z.object({
  accessMode: AccessMode.optional(),
  // Set null to clear; set a string to rotate. Server validates uniqueness.
  openCode: z.string().min(4).max(12).optional().nullable(),
  openMaxAttempts: z.number().int().min(1).max(10000).optional().nullable(),
  // PR2.13 — Cách sinh mã access cho assigned_code candidate.
  assignedCodeSource: z.enum(["random", "student_code"]).optional(),
});

export type UpdateExamAccessPayload = z.infer<typeof UpdateExamAccessInput>;

export async function updateExamAccess(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{
  accessMode: "authenticated" | "open_code" | "assigned_code";
  openCode: string | null;
  openMaxAttempts: number | null;
  assignedCodeSource: "random" | "student_code";
}> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      accessMode: true,
      openCode: true,
      openMaxAttempts: true,
      assignedCodeSource: true,
      status: true,
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const parsed = UpdateExamAccessInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());

  // Disallow changing accessMode if any in-progress attempt exists — flipping
  // mid-flight orphans the live tab and breaks the cookie scope.
  if (parsed.data.accessMode && parsed.data.accessMode !== exam.accessMode) {
    const inFlight = await db.examAttempt.count({
      where: { examId, status: "in_progress" },
    });
    if (inFlight > 0) throw new ExamError("exam_has_attempts");
  }

  const nextMode = parsed.data.accessMode ?? exam.accessMode;
  const data: {
    accessMode?: "authenticated" | "open_code" | "assigned_code";
    openCode?: string | null;
    openMaxAttempts?: number | null;
    assignedCodeSource?: "random" | "student_code";
  } = {};
  if (parsed.data.accessMode !== undefined) data.accessMode = parsed.data.accessMode;
  if (parsed.data.openCode !== undefined)
    data.openCode = parsed.data.openCode === null ? null : parsed.data.openCode.toUpperCase();
  if (parsed.data.openMaxAttempts !== undefined)
    data.openMaxAttempts = parsed.data.openMaxAttempts;
  if (parsed.data.assignedCodeSource !== undefined)
    data.assignedCodeSource = parsed.data.assignedCodeSource;

  // Clear open-mode fields when switching away.
  if (nextMode !== "open_code") {
    data.openCode = null;
    data.openMaxAttempts = null;
  } else {
    // Switching INTO open_code: auto-generate openCode if neither caller nor
    // existing row has one. Spares the UI from a 2-step "set mode → rotate"
    // dance — clicking "Tự do" is a single intent.
    if (data.openCode === undefined && exam.openCode === null) {
      // Lazy import: generateOpenCode is in this same module via re-export.
      // Retry on collision (astronomically unlikely but safe).
      for (let i = 0; i < 5; i++) {
        const candidate = generateOpenCode();
        const clash = await db.exam.findUnique({
          where: { openCode: candidate },
          select: { id: true },
        });
        if (!clash) {
          data.openCode = candidate;
          break;
        }
      }
      if (data.openCode === undefined)
        throw new ExamError("validation_failed", {
          reason: "openCode_collision",
        });
    }
  }

  try {
    const updated = await db.exam.update({
      where: { id: examId },
      data,
      select: {
        accessMode: true,
        openCode: true,
        openMaxAttempts: true,
        assignedCodeSource: true,
      },
    });
    await emitEvent(
      actorUserId,
      LearningEventType.ExamCreated, // No dedicated `access.updated` event yet; reuse for audit.
      {
        examId,
        action: "access_updated",
        next: { accessMode: updated.accessMode, openCode: updated.openCode, openMaxAttempts: updated.openMaxAttempts },
        prev: { accessMode: exam.accessMode, openCode: exam.openCode, openMaxAttempts: exam.openMaxAttempts },
      },
      {
        courseId: exam.courseId,
        eventKey: `exam.access_updated:${examId}:${Date.now()}`,
      },
      db,
    );
    return updated;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      // Unique constraint on openCode collided.
      throw new ExamError("validation_failed", { field: "openCode", reason: "duplicate" });
    }
    throw e;
  }
}

/** Generate a fresh openCode + persist. Used by "Rotate code" instructor button. */
export async function rotateOpenCode(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ openCode: string }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, accessMode: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  if (exam.accessMode !== "open_code")
    throw new ExamError("access_mode_mismatch");

  // Try up to 5 fresh codes — collision is astronomical (31^6 = 887M) but be safe.
  for (let i = 0; i < 5; i++) {
    const next = generateOpenCode();
    try {
      await db.exam.update({
        where: { id: examId },
        data: { openCode: next },
      });
      return { openCode: next };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      // collision — try again
    }
  }
  throw new ExamError("validation_failed", { reason: "openCode_collision" });
}
