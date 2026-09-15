/**
 * Email Dispatch — review-before-send queue.
 *
 * Splits the old fire-and-forget `sendCodesToCandidates` into 2 phases:
 *   1. createExamCodeBatch — snapshot recipients + variables into a batch
 *      with status=draft. Caller redirects user to a review UI.
 *   2. approveBatchAndSend — once user confirms, iterate selected items and
 *      actually send via Resend. Untracked items become skipped.
 *
 * Each item records its own outcome so the UI can show "5 sent, 2 failed"
 * and offer a resend-failed button. Re-runs are idempotent at the item
 * level (status flip from pending/failed → sent).
 *
 * Authorization: callers must have already passed the API-level access
 * check (canEditCourse) before invoking these functions.
 */
import { prisma, type Prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { ExamError } from "../exam/types";
import { sendTemplatedEmail } from "./templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class DispatchError extends Error {
  constructor(
    public readonly code:
      | "batch_not_found"
      | "batch_not_in_draft"
      | "batch_already_completed"
      | "no_recipients_with_email"
      | "exam_not_found"
      | "forbidden",
  ) {
    super(code);
  }
}

export interface CreateExamCodeBatchInput {
  examId: string;
  actorUserId: string;
  baseUrl: string;
}

export interface CreateExamCodeBatchResult {
  batchId: string;
  totalItems: number;
  skippedNoEmail: number;
}

// ---------------------------------------------------------------------------
// Vietnamese datetime formatter — kept here so review UI sees the exact
// string that will reach the recipient.
// ---------------------------------------------------------------------------

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

// ---------------------------------------------------------------------------
// createExamCodeBatch — phase 1: build the batch + items, no email sent yet.
// ---------------------------------------------------------------------------

export async function createExamCodeBatch(
  input: CreateExamCodeBatchInput,
  db: PrismaClient = prisma,
): Promise<CreateExamCodeBatchResult> {
  const exam = await db.exam.findUnique({
    where: { id: input.examId },
    select: {
      id: true,
      courseId: true,
      createdById: true,
      title: true,
      openAt: true,
      closeAt: true,
      durationMin: true,
      course: { select: { organizationId: true } },
    },
  });
  if (!exam) throw new DispatchError("exam_not_found");
  await assertCanEditExam(input.actorUserId, exam, db);

  const organizationId = exam.course?.organizationId ?? null;

  // Pull every active candidate with a code. Whether they have an email
  // (in metadata) determines if they make the cut for this batch.
  const candidates = await db.examCandidate.findMany({
    where: { examId: exam.id, disabledAt: null, accessCode: { not: null } },
    select: { id: true, displayName: true, accessCode: true, metadata: true },
  });

  const itemsData: Array<{
    recipientEmail: string;
    recipientName: string;
    sourceType: string;
    sourceId: string;
    variables: Prisma.InputJsonValue;
  }> = [];
  let skippedNoEmail = 0;
  const baseUrlTrim = input.baseUrl.replace(/\/$/, "");

  for (const c of candidates) {
    const meta = c.metadata as Record<string, unknown> | null;
    const email = typeof meta?.email === "string" ? meta.email.trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skippedNoEmail++;
      continue;
    }
    const claimUrl = `${baseUrlTrim}/exam/${c.accessCode}`;
    itemsData.push({
      recipientEmail: email,
      recipientName: c.displayName,
      sourceType: "examCandidate",
      sourceId: c.id,
      variables: {
        candidateName: c.displayName,
        examTitle: exam.title,
        accessCode: c.accessCode!,
        claimUrl,
        examOpensAt: fmtDateTime(exam.openAt),
        examClosesAt: fmtDateTime(exam.closeAt),
        examDurationMin: exam.durationMin,
      } as Prisma.InputJsonValue,
    });
  }

  if (itemsData.length === 0) {
    throw new DispatchError("no_recipients_with_email");
  }

  const batch = await db.$transaction(async (tx) => {
    const b = await tx.emailDispatchBatch.create({
      data: {
        organizationId,
        templateKey: "exam.access_code",
        targetType: "exam",
        targetId: exam.id,
        title: `Gửi mã dự thi — ${exam.title}`,
        status: "draft",
        totalItems: itemsData.length,
        createdByUserId: input.actorUserId,
      },
      select: { id: true },
    });
    await tx.emailDispatchItem.createMany({
      data: itemsData.map((it) => ({ batchId: b.id, ...it })),
    });
    return b;
  });

  return { batchId: batch.id, totalItems: itemsData.length, skippedNoEmail };
}

// ---------------------------------------------------------------------------
// Toggle item selected — used by review UI before approval.
// ---------------------------------------------------------------------------

export async function toggleBatchItem(
  batchId: string,
  itemId: string,
  selected: boolean,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertActorCanEditBatch(batchId, actorUserId, db);

  const item = await db.emailDispatchItem.findUnique({
    where: { id: itemId },
    select: { batchId: true, status: true },
  });
  if (!item || item.batchId !== batchId) {
    throw new DispatchError("batch_not_found");
  }
  // Only allow toggling while batch is still in draft. After approval,
  // items are immutable except for status updates from the sender.
  const batch = await db.emailDispatchBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { status: true },
  });
  if (batch.status !== "draft") {
    throw new DispatchError("batch_not_in_draft");
  }
  await db.emailDispatchItem.update({
    where: { id: itemId },
    data: { selected },
  });
}

// ---------------------------------------------------------------------------
// Cancel — only valid while draft.
// ---------------------------------------------------------------------------

export async function cancelBatch(
  batchId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertActorCanEditBatch(batchId, actorUserId, db);
  const batch = await db.emailDispatchBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { status: true },
  });
  if (batch.status !== "draft") {
    throw new DispatchError("batch_not_in_draft");
  }
  await db.emailDispatchBatch.update({
    where: { id: batchId },
    data: { status: "cancelled" },
  });
}

// ---------------------------------------------------------------------------
// approveBatchAndSend — phase 2: actually send selected items.
// ---------------------------------------------------------------------------

export interface ApproveBatchResult {
  batchId: string;
  sent: number;
  failed: number;
  skipped: number;
}

export async function approveBatchAndSend(
  batchId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<ApproveBatchResult> {
  await assertActorCanEditBatch(batchId, actorUserId, db);

  const batch = await db.emailDispatchBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { items: true },
  });
  if (batch.status !== "draft") {
    throw new DispatchError("batch_not_in_draft");
  }

  // Move to sending + record approver atomically.
  await db.emailDispatchBatch.update({
    where: { id: batchId },
    data: {
      status: "sending",
      approvedByUserId: actorUserId,
      approvedAt: new Date(),
    },
  });

  // Mark unticked items as skipped up front so counters stay accurate
  // even if a crash interrupts the send loop.
  const skippedIds = batch.items.filter((i) => !i.selected).map((i) => i.id);
  if (skippedIds.length > 0) {
    await db.emailDispatchItem.updateMany({
      where: { id: { in: skippedIds } },
      data: { status: "skipped" },
    });
  }

  const toSend = batch.items.filter((i) => i.selected);
  let sent = 0;
  let failed = 0;

  for (const item of toSend) {
    const result = await sendItem(item.id, batch, db);
    if (result.ok) sent++;
    else failed++;
  }

  const completed = await db.emailDispatchBatch.update({
    where: { id: batchId },
    data: {
      status: "completed",
      completedAt: new Date(),
      sentCount: sent,
      failedCount: failed,
      skippedCount: skippedIds.length,
    },
    select: { id: true },
  });

  return {
    batchId: completed.id,
    sent,
    failed,
    skipped: skippedIds.length,
  };
}

// ---------------------------------------------------------------------------
// resendFailedItems — retry items that previously failed.
// ---------------------------------------------------------------------------

export interface ResendFailedResult {
  retried: number;
  recovered: number;
  stillFailed: number;
}

export async function resendFailedItems(
  batchId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<ResendFailedResult> {
  await assertActorCanEditBatch(batchId, actorUserId, db);

  const batch = await db.emailDispatchBatch.findUniqueOrThrow({
    where: { id: batchId },
  });
  if (batch.status !== "completed") {
    throw new DispatchError("batch_not_in_draft"); // semantic: must be completed
  }

  const failedItems = await db.emailDispatchItem.findMany({
    where: { batchId, status: "failed" },
  });

  let recovered = 0;
  let stillFailed = 0;
  for (const item of failedItems) {
    const r = await sendItem(item.id, batch, db);
    if (r.ok) recovered++;
    else stillFailed++;
  }

  // Refresh batch counters.
  const newSent = batch.sentCount + recovered;
  const newFailed = batch.failedCount - recovered;
  await db.emailDispatchBatch.update({
    where: { id: batchId },
    data: { sentCount: newSent, failedCount: newFailed },
  });

  return { retried: failedItems.length, recovered, stillFailed };
}

// ---------------------------------------------------------------------------
// Internal: send one item, update its row + the source examCandidate.
// ---------------------------------------------------------------------------

async function sendItem(
  itemId: string,
  batch: { templateKey: string; organizationId: string | null },
  db: PrismaClient,
): Promise<{ ok: boolean }> {
  const item = await db.emailDispatchItem.findUniqueOrThrow({
    where: { id: itemId },
  });
  const vars = item.variables as Record<string, string | number>;

  await db.emailDispatchItem.update({
    where: { id: itemId },
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  try {
    const result = await sendTemplatedEmail({
      key: batch.templateKey as "exam.access_code", // template key is typed at call-site; trust the seeded value here
      to: item.recipientEmail,
      organizationId: batch.organizationId,
      variables: vars,
    });
    if (result.delivered || result.loggedOnly) {
      await db.emailDispatchItem.update({
        where: { id: itemId },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerId: result.providerId,
          errorMessage: null,
        },
      });
      // Mirror onto the source row (e.g. examCandidate.emailSentAt) so the
      // candidates list UI shows green ticks immediately.
      if (item.sourceType === "examCandidate" && item.sourceId) {
        await db.examCandidate
          .update({
            where: { id: item.sourceId },
            data: { emailSentAt: new Date() },
          })
          .catch(() => {
            /* candidate row might have been deleted — non-fatal */
          });
      }
      return { ok: true };
    }
    await db.emailDispatchItem.update({
      where: { id: itemId },
      data: { status: "failed", errorMessage: result.error ?? "send_failed" },
    });
    return { ok: false };
  } catch (e) {
    await db.emailDispatchItem.update({
      where: { id: itemId },
      data: { status: "failed", errorMessage: (e as Error).message.slice(0, 500) },
    });
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Internal authz helper: ensures the actor can edit the underlying target.
// ---------------------------------------------------------------------------

async function assertActorCanEditBatch(
  batchId: string,
  actorUserId: string,
  db: PrismaClient,
): Promise<void> {
  const batch = await db.emailDispatchBatch.findUnique({
    where: { id: batchId },
    select: { targetType: true, targetId: true },
  });
  if (!batch) throw new DispatchError("batch_not_found");

  // For now we only know how to authorize "exam" targets. Extend here when
  // adding cohort/round-level batches.
  if (batch.targetType === "exam") {
    const exam = await db.exam.findUnique({
      where: { id: batch.targetId },
      select: { courseId: true, createdById: true },
    });
    if (!exam) throw new DispatchError("exam_not_found");
    await assertCanEditExam(actorUserId, exam, db);
    return;
  }
  // Unknown target type — refuse rather than silently allow.
  throw new DispatchError("forbidden");
}

// ---------------------------------------------------------------------------
// Read helpers used by API + UI.
// ---------------------------------------------------------------------------

export async function getBatchWithItems(
  batchId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
) {
  await assertActorCanEditBatch(batchId, actorUserId, db);
  return db.emailDispatchBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      items: { orderBy: { recipientName: "asc" } },
      createdBy: { select: { id: true, displayName: true, email: true } },
      approvedBy: { select: { id: true, displayName: true } },
    },
  });
}

export async function listBatchesForExam(
  examId: string,
  actorUserId: string,
  db: PrismaClient = prisma,
) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true },
  });
  if (!exam) throw new DispatchError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);

  return db.emailDispatchBatch.findMany({
    where: { targetType: "exam", targetId: examId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { displayName: true } },
      approvedBy: { select: { displayName: true } },
    },
  });
}
