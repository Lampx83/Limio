import { z } from "zod";
import { Prisma, prisma, type ExamIncidentType, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import {
  assertSubjectOwnsAttempt,
  emitArgsForSubject,
  type ExamSubject,
} from "./subject";
import { ExamError } from "./types";

const INCIDENT_TYPES = [
  "tab_blur",
  "fullscreen_exit",
  "paste",
  "multi_tab",
  "network_lost",
] as const satisfies readonly ExamIncidentType[];

export const LogIncidentInput = z.object({
  type: z.enum(INCIDENT_TYPES),
  /** Type-specific extras: { pastedLength }, { offlineSec }, { tabId }, … */
  payload: z.record(z.unknown()).optional(),
});

/**
 * A7.7.3 — Append an incident to the attempt's log. Per AC: only flag, never
 * auto-disqualify. Idempotency is not enforced — the same client-side event
 * fired twice yields two rows (browsers misbehave; instructors review later).
 */
export async function logExamIncident(
  subject: ExamSubject,
  attemptId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ incidentId: string }> {
  const parsed = LogIncidentInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      candidateId: true,
      status: true,
      exam: { select: { id: true, courseId: true } },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  // Only meaningful during the active attempt window.
  if (attempt.status !== "in_progress") {
    throw new ExamError("attempt_already_submitted");
  }

  const incident = await db.examIncident.create({
    data: {
      attemptId,
      type: parsed.data.type,
      payload: (parsed.data.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true },
  });

  const ev = emitArgsForSubject(subject);
  await emitEvent(
    ev.userId,
    LearningEventType.ExamIncidentFlagged,
    {
      attemptId,
      incidentId: incident.id,
      type: parsed.data.type,
      ...(parsed.data.payload ? { payload: parsed.data.payload } : {}),
    },
    {
      courseId: attempt.exam.courseId,
      candidateId: ev.candidateId,
      eventKey: `exam.incident:${incident.id}`,
    },
    db,
  );

  return { incidentId: incident.id };
}

/** Convenience for instructors reviewing flagged behavior on an attempt. */
export async function listAttemptIncidents(
  attemptId: string,
  db: PrismaClient = prisma,
) {
  return db.examIncident.findMany({
    where: { attemptId },
    orderBy: { occurredAt: "asc" },
  });
}
