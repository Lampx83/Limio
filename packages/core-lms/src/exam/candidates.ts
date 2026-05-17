/**
 * A5.8 — Candidate management for assigned_code mode (T3a-D3).
 *
 * Service surface:
 *   - listCandidates       — instructor table data + per-row attempt count
 *   - createCandidate      — single add with auto-generated accessCode
 *   - bulkCreateCandidates — CSV import
 *   - updateCandidate      — edit displayName/metadata/disable
 *   - deleteCandidate      — only if no attempt yet
 *   - sendCodesToCandidates — push email batch (Resend), set emailSentAt
 *
 * sendCodes intentionally runs inline here (no BullMQ yet) — fine for class-
 * size batches (≤ 200). When > 200, move to a queue (P5).
 */

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { generateAssignedCode } from "./code-access";
import { ensureDefaultSession } from "./exam-rooms";
import { ExamError } from "./types";

export interface CandidateRow {
  id: string;
  displayName: string;
  accessCode: string | null;
  metadata: Record<string, unknown> | null;
  disabledAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  attemptCount: number;
  roomId: string | null;
  roomName: string | null;
}

async function assertExamEditable(
  actorUserId: string,
  examId: string,
  db: PrismaClient,
): Promise<{ id: string; courseId: string; assignedCodeSource: "random" | "student_code" }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, assignedCodeSource: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  return exam;
}

export async function listCandidates(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<CandidateRow[]> {
  await assertExamEditable(actorUserId, examId, db);
  const rows = await db.examCandidate.findMany({
    where: { examId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      accessCode: true,
      metadata: true,
      disabledAt: true,
      emailSentAt: true,
      createdAt: true,
      roomId: true,
      room: { select: { id: true, name: true } },
      _count: { select: { attempts: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    accessCode: r.accessCode,
    metadata: r.metadata as Record<string, unknown> | null,
    disabledAt: r.disabledAt?.toISOString() ?? null,
    emailSentAt: r.emailSentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    attemptCount: r._count.attempts,
    roomId: r.roomId,
    roomName: r.room?.name ?? null,
  }));
}

export interface NewCandidateInput {
  displayName: string;
  metadata?: Record<string, unknown>;
}

async function genUniqueAccessCode(examId: string, db: PrismaClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateAssignedCode();
    const existing = await db.examCandidate.findFirst({
      where: { examId, accessCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new ExamError("candidate_code_collision");
}

function normaliseName(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("candidate_name_required");
  const n = raw.trim().slice(0, 200);
  if (n.length === 0) throw new ExamError("candidate_name_required");
  return n;
}

export async function createCandidate(
  actorUserId: string,
  examId: string,
  input: NewCandidateInput,
  db: PrismaClient = prisma,
): Promise<{ id: string; accessCode: string }> {
  const exam = await assertExamEditable(actorUserId, examId, db);
  const displayName = normaliseName(input.displayName);
  // PR2.13 — Khi exam.assignedCodeSource = student_code, dùng MSSV trong
  // metadata làm accessCode. Random là fallback mặc định.
  let code: string;
  if (exam.assignedCodeSource === "student_code") {
    const mssv =
      typeof input.metadata?.studentCode === "string"
        ? (input.metadata.studentCode as string).trim()
        : "";
    if (!mssv)
      throw new ExamError("validation_failed", {
        reason: "student_code_required",
      });
    const dup = await db.examCandidate.findFirst({
      where: { examId, accessCode: mssv },
      select: { id: true },
    });
    if (dup) throw new ExamError("candidate_code_collision");
    code = mssv;
  } else {
    code = await genUniqueAccessCode(examId, db);
  }
  // A5.3 PR1c.4 — Candidate phải gắn vào ExamSession. Legacy assigned-code
  // flow gọi từ exam scope, nên ensure 1 session mặc định (idempotent).
  const sessionId = await ensureDefaultSession(examId, db);
  const c = await db.examCandidate.create({
    data: {
      examId,
      sessionId,
      displayName,
      accessCode: code,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, accessCode: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamCandidateCreated,
    { examId, candidateId: c.id, mode: "assigned_code" },
    {
      courseId: exam.courseId,
      candidateId: c.id,
      eventKey: `exam.candidate.created:${c.id}`,
    },
    db,
  );
  return { id: c.id, accessCode: c.accessCode! };
}

export async function bulkCreateCandidates(
  actorUserId: string,
  examId: string,
  rows: NewCandidateInput[],
  db: PrismaClient = prisma,
): Promise<{ created: number; failed: { row: number; error: string }[] }> {
  await assertExamEditable(actorUserId, examId, db);
  let created = 0;
  const failed: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      await createCandidate(actorUserId, examId, rows[i]!, db);
      created++;
    } catch (e) {
      const code = e instanceof ExamError ? e.code : (e as Error).message;
      failed.push({ row: i + 1, error: code });
    }
  }
  return { created, failed };
}

export async function updateCandidate(
  actorUserId: string,
  candidateId: string,
  patch: { displayName?: string; metadata?: Record<string, unknown>; disabled?: boolean },
  db: PrismaClient = prisma,
): Promise<void> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, examId: true, displayName: true, exam: { select: { courseId: true } } },
  });
  if (!c) throw new ExamError("candidate_not_found");
  await assertCanEditCourse(actorUserId, c.exam.courseId, db);

  const data: { displayName?: string; metadata?: Record<string, unknown>; disabledAt?: Date | null } = {};
  if (patch.displayName !== undefined) data.displayName = normaliseName(patch.displayName);
  if (patch.metadata !== undefined) data.metadata = patch.metadata;
  if (patch.disabled !== undefined)
    data.disabledAt = patch.disabled ? new Date() : null;

  if (Object.keys(data).length === 0) return;
  await db.examCandidate.update({
    where: { id: candidateId },
    data: data as never,
  });
  if (patch.displayName && patch.displayName !== c.displayName) {
    // Audit rename — visible to instructor in dashboard timeline (§6.6.6 Q4).
    await emitEvent(
      actorUserId,
      LearningEventType.ExamCandidateCreated, // reuse for now; dedicated event = future
      {
        examId: c.examId,
        candidateId,
        action: "renamed",
        from: c.displayName,
        to: data.displayName,
      },
      {
        courseId: c.exam.courseId,
        candidateId,
        eventKey: `exam.candidate.renamed:${candidateId}:${Date.now()}`,
      },
      db,
    );
  }
}

export async function deleteCandidate(
  actorUserId: string,
  candidateId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      exam: { select: { courseId: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!c) throw new ExamError("candidate_not_found");
  await assertCanEditCourse(actorUserId, c.exam.courseId, db);
  if (c._count.attempts > 0) throw new ExamError("candidate_has_attempts");
  await db.examCandidate.delete({ where: { id: candidateId } });
}

export interface SendCodesParams {
  examId: string;
  /** Where the CTA link in the email should point. Build with origin + /exam/<code>. */
  baseUrl: string;
  /** Pass an injectable sender for tests; defaults to the real lib/email helper. */
  send: (input: {
    candidateName: string;
    examTitle: string;
    accessCode: string;
    claimUrl: string;
    examOpensAt: Date;
    examClosesAt: Date;
    examDurationMin: number;
    to: string;
    /** Org of the owning course; null = use global template. */
    organizationId: string | null;
  }) => Promise<{ delivered: boolean; loggedOnly: boolean; error?: string }>;
}

export interface SendCodesResult {
  attempted: number;
  delivered: number;
  loggedOnly: number;
  failed: { candidateId: string; error: string }[];
}

/**
 * A5.8 (Nghị định 13/2023 Điều 12 — quyền truy cập). Export all data
 * associated with a single ExamCandidate as a single JSON document. The
 * instructor delivers this to the candidate on request.
 *
 * Delete handled out-of-band for now (manual DB anonymise if requested).
 * If a delete API is added later it should anonymise PII (phone/email/name)
 * rather than cascade-delete attempts — academic record stays intact.
 */
export async function exportCandidateData(
  actorUserId: string,
  candidateId: string,
  db: PrismaClient = prisma,
): Promise<Record<string, unknown>> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      examId: true,
      displayName: true,
      accessCode: true,
      metadata: true,
      createdAt: true,
      disabledAt: true,
      emailSentAt: true,
      exam: { select: { id: true, title: true, courseId: true } },
      attempts: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          gradedAt: true,
          durationSec: true,
          score: true,
          scorePct: true,
          passed: true,
          resumeCount: true,
          candidateDisplayName: true,
          answers: {
            select: {
              questionId: true,
              answerJson: true,
              autoScore: true,
              manualScore: true,
              gradedAt: true,
              comment: true,
            },
          },
          incidents: {
            select: { id: true, type: true, payload: true, occurredAt: true },
            orderBy: { occurredAt: "asc" },
          },
        },
      },
    },
  });
  if (!c) throw new ExamError("candidate_not_found");
  await assertCanEditCourse(actorUserId, c.exam.courseId, db);

  // Audit events emitted by/for this candidate (Q7 — LearningEvent.candidateId).
  const events = await db.learningEvent.findMany({
    where: { candidateId },
    select: { id: true, eventType: true, payload: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: actorUserId,
    legalBasis: "Nghị định 13/2023/NĐ-CP Điều 12 — quyền truy cập dữ liệu cá nhân",
    candidate: {
      id: c.id,
      displayName: c.displayName,
      accessCode: c.accessCode,
      metadata: c.metadata,
      createdAt: c.createdAt.toISOString(),
      disabledAt: c.disabledAt?.toISOString() ?? null,
      emailSentAt: c.emailSentAt?.toISOString() ?? null,
    },
    exam: c.exam,
    attempts: c.attempts.map((a) => ({
      ...a,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      gradedAt: a.gradedAt?.toISOString() ?? null,
      incidents: a.incidents.map((i) => ({ ...i, occurredAt: i.occurredAt.toISOString() })),
    })),
    events: events.map((e) => ({
      id: e.id.toString(),
      eventType: e.eventType,
      payload: e.payload,
      occurredAt: e.occurredAt.toISOString(),
    })),
    note: "Yêu cầu xoá dữ liệu cá nhân: hiện xử lý thủ công qua admin DB. Liên hệ giám thị/trường.",
  };
}

export async function sendCodesToCandidates(
  actorUserId: string,
  params: SendCodesParams,
  db: PrismaClient = prisma,
): Promise<SendCodesResult> {
  const exam = await db.exam.findUnique({
    where: { id: params.examId },
    select: {
      id: true,
      courseId: true,
      title: true,
      openAt: true,
      closeAt: true,
      durationMin: true,
      // For per-org email template lookup.
      course: { select: { organizationId: true } },
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const organizationId = exam.course.organizationId ?? null;

  const rows = await db.examCandidate.findMany({
    where: { examId: exam.id, disabledAt: null, accessCode: { not: null } },
    select: { id: true, displayName: true, accessCode: true, metadata: true },
  });

  const result: SendCodesResult = { attempted: 0, delivered: 0, loggedOnly: 0, failed: [] };
  for (const c of rows) {
    const meta = c.metadata as Record<string, unknown> | null;
    const email = typeof meta?.email === "string" ? meta.email : null;
    if (!email) continue; // silently skip — no email = no send
    result.attempted++;
    const claimUrl = `${params.baseUrl.replace(/\/$/, "")}/exam/${c.accessCode}`;
    try {
      const r = await params.send({
        to: email,
        candidateName: c.displayName,
        examTitle: exam.title,
        accessCode: c.accessCode!,
        claimUrl,
        examOpensAt: exam.openAt,
        examClosesAt: exam.closeAt,
        examDurationMin: exam.durationMin,
        organizationId,
      });
      if (r.delivered || r.loggedOnly) {
        if (r.delivered) result.delivered++;
        if (r.loggedOnly) result.loggedOnly++;
        await db.examCandidate.update({
          where: { id: c.id },
          data: { emailSentAt: new Date() },
        });
      } else {
        result.failed.push({ candidateId: c.id, error: r.error ?? "send_failed" });
      }
    } catch (e) {
      result.failed.push({ candidateId: c.id, error: (e as Error).message });
    }
  }
  return result;
}
