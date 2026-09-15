/**
 * A5.3.5 — Live messages from instructor to candidates during an exam.
 *
 * Two flavours:
 *   1. Per-attempt:  ExamMessage.attemptId set       → only that learner sees it
 *   2. Broadcast:    ExamMessage.attemptId = null    → every in-progress attempt
 *                                                       of the exam fetches it
 *
 * Append-only: body / fromUserId / sentAt never change. `readAt` is the only
 * mutable field — set once by the student client when the message is acked,
 * which is a state marker, not message content (§4.5 CLAUDE.md).
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanModerateLiveExamForExam } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { ExamError } from "./types";

const MAX_BODY_CHARS = 500;

function normaliseBody(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("message_body_required");
  const body = raw.trim();
  if (body.length === 0) throw new ExamError("message_body_required");
  if (body.length > MAX_BODY_CHARS) throw new ExamError("message_too_long");
  return body;
}

/** Send a message to a single in-progress attempt. */
export async function sendMessageToAttempt(
  actorUserId: string,
  attemptId: string,
  rawBody: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const body = normaliseBody(rawBody);
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      examId: true,
      userId: true,
      exam: { select: { courseId: true, createdById: true } },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  await assertCanModerateLiveExamForExam(actorUserId, attempt.exam, db);
  if (attempt.status !== "in_progress")
    throw new ExamError("attempt_not_in_progress");

  const msg = await db.examMessage.create({
    data: {
      examId: attempt.examId,
      attemptId,
      fromUserId: actorUserId,
      body,
    },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamMessageSent,
    {
      examId: attempt.examId,
      attemptId,
      messageId: msg.id,
      learnerUserId: attempt.userId,
      bodyLen: body.length,
    },
    {
      courseId: attempt.exam.courseId,
      eventKey: `exam.message.sent:${msg.id}`,
    },
    db,
  );
  return msg;
}

/** Broadcast a message to every in-progress attempt of an exam. */
export async function broadcastMessageToExam(
  actorUserId: string,
  examId: string,
  rawBody: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const body = normaliseBody(rawBody);
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanModerateLiveExamForExam(actorUserId, exam, db);

  const msg = await db.examMessage.create({
    data: { examId, attemptId: null, fromUserId: actorUserId, body },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamMessageBroadcast,
    { examId, messageId: msg.id, bodyLen: body.length },
    {
      courseId: exam.courseId,
      eventKey: `exam.message.broadcast:${msg.id}`,
    },
    db,
  );
  return msg;
}

/**
 * Student-side: fetch direct + broadcast messages for one attempt, optionally
 * since a timestamp (poll cursor). Returns oldest first so client renders in
 * conversation order.
 */
export async function listMessagesForAttempt(
  userId: string,
  attemptId: string,
  sinceMs: number | undefined,
  db: PrismaClient = prisma,
) {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, examId: true, startedAt: true },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (attempt.userId !== userId) throw new ExamError("attempt_belongs_to_other");

  // Broadcasts only count if sent AFTER the learner started — older
  // broadcasts belong to a different ca thi.
  const sinceFloor = sinceMs ? new Date(sinceMs) : attempt.startedAt;

  const rows = await db.examMessage.findMany({
    where: {
      AND: [
        { sentAt: { gt: sinceFloor } },
        {
          OR: [
            { attemptId },
            { attemptId: null, examId: attempt.examId, sentAt: { gte: attempt.startedAt } },
          ],
        },
      ],
    },
    orderBy: { sentAt: "asc" },
    select: {
      id: true,
      attemptId: true,
      body: true,
      sentAt: true,
      readAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.attemptId ? "direct" : "broadcast",
    body: r.body,
    sentAt: r.sentAt.getTime(),
    readAt: r.readAt?.getTime() ?? null,
  }));
}

/** Student marks a message as read. Idempotent — first call wins. */
export async function markMessageRead(
  userId: string,
  messageId: string,
  db: PrismaClient = prisma,
): Promise<{ readAt: Date }> {
  const msg = await db.examMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      attemptId: true,
      examId: true,
      readAt: true,
      attempt: { select: { userId: true } },
    },
  });
  if (!msg) throw new ExamError("message_not_found");
  // Direct message: only the owning learner can ack. Broadcast: any owner of
  // an attempt of this exam — but for the prototype we don't track per-user
  // read state for broadcasts; first ack wins.
  if (msg.attemptId && msg.attempt?.userId !== userId) {
    throw new ExamError("attempt_belongs_to_other");
  }
  if (msg.readAt) return { readAt: msg.readAt };
  const updated = await db.examMessage.update({
    where: { id: messageId },
    data: { readAt: new Date() },
    select: { readAt: true },
  });
  return { readAt: updated.readAt! };
}
