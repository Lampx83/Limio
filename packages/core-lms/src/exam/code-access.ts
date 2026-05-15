/**
 * A5.8 — Code-based exam access services.
 *
 * `claimByOpenCode`     — Open mode: anyone with the exam's openCode can enter.
 *                         Each claim creates a fresh ExamCandidate + attempt.
 *                         Q1: phone + email required.
 * `claimByAssignedCode` — Assigned mode: each candidate has their own code.
 *                         1 candidate × 1 exam = 1 attempt (Q5 resume).
 *
 * Both:
 *   - Validate exam.accessMode + exam window (openAt..closeAt).
 *   - Generate `sessionToken` (rotated by claimAttemptSession on tab-claim).
 *   - Emit `exam.candidate.created` / `exam.candidate.code_claimed` events.
 *
 * Caller (D4 route) wraps the result with `signExamSession` + cookie set.
 */

import { randomUUID } from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { buildShuffleSnapshot } from "./attempts";
import { ensureDefaultSession } from "./exam-rooms";
import { ExamError } from "./types";

// Alphabet without ambiguous 0/O, 1/I/l. Easier to read off a slide.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(len: number): string {
  const buf = new Uint8Array(len);
  // crypto.getRandomValues works in Node ≥18 globally.
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

/** Generate the shared open-mode code. */
export function generateOpenCode(): string {
  return generateCode(6);
}

/** Generate a per-candidate code for assigned mode. */
export function generateAssignedCode(): string {
  return generateCode(8);
}

export interface ClaimResult {
  candidateId: string;
  attemptId: string;
  examId: string;
  sessionToken: string;
  displayName: string;
  resumed: boolean;
  /** Seconds from now until the cookie should expire — caller passes to JWT.exp. */
  ttlSec: number;
}

interface OpenClaimInput {
  displayName: string;
  phone: string;
  email: string;
  studentCode?: string;
  class?: string;
  // PR2.12 — Resolved cohortId từ preview step (frontend đã verify mã lớp).
  cohortId?: string;
}

function normaliseName(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("candidate_name_required");
  const n = raw.trim();
  if (n.length === 0) throw new ExamError("candidate_name_required");
  if (n.length > 200) return n.slice(0, 200);
  return n;
}

function normalisePhone(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("candidate_phone_required");
  // VN-friendly: digits only, 9-11 length.
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 9 || digits.length > 11)
    throw new ExamError("candidate_phone_required");
  return digits;
}

function normaliseEmail(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("candidate_email_required");
  const e = raw.trim().toLowerCase();
  // Minimal regex: local@domain.tld — full RFC is impractical at this layer.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new ExamError("candidate_email_required");
  if (e.length > 200) throw new ExamError("candidate_email_required");
  return e;
}

function computeTtlSec(exam: { closeAt: Date }): number {
  // Q6 — cookie covers active exam window + 1h grace for late submit/review.
  // Hard cap at 7 days; floor at 5 min so a near-end claim still has room.
  const remaining = Math.floor((exam.closeAt.getTime() - Date.now()) / 1000) + 3600;
  return Math.max(300, Math.min(remaining, 7 * 24 * 3600));
}

/** Q1: open-mode claim. Creates a fresh candidate + attempt every call. */
export async function claimByOpenCode(
  code: unknown,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<ClaimResult> {
  if (typeof code !== "string" || code.trim().length === 0)
    throw new ExamError("invalid_code");
  const upperCode = code.trim().toUpperCase();

  // PR2.12 — Lookup ExamSession.openCode trước (per-session). Mỗi ca có
  // mã access riêng + mode riêng. Fallback sang Exam.openCode (legacy) nếu
  // không match session nào.
  let resolvedSessionId: string | null = null;
  const sessionMatch = await db.examSession.findFirst({
    where: { openCode: upperCode, accessMode: "open_code" },
    select: {
      id: true,
      exam: {
        select: {
          id: true,
          accessMode: true,
          status: true,
          openAt: true,
          closeAt: true,
          durationMin: true,
          openMaxAttempts: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          courseId: true,
        },
      },
    },
  });

  let exam;
  if (sessionMatch) {
    resolvedSessionId = sessionMatch.id;
    exam = sessionMatch.exam;
  } else {
    exam = await db.exam.findUnique({
      where: { openCode: upperCode },
      select: {
        id: true,
        accessMode: true,
        status: true,
        openAt: true,
        closeAt: true,
        durationMin: true,
        openMaxAttempts: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        courseId: true,
      },
    });
  }
  if (!exam) throw new ExamError("invalid_code");
  if (exam.accessMode !== "open_code" && !sessionMatch)
    throw new ExamError("access_mode_mismatch");
  if (exam.status !== "published") throw new ExamError("exam_not_open");
  const now = new Date();
  if (now < exam.openAt) throw new ExamError("exam_not_open");
  if (now >= exam.closeAt) throw new ExamError("exam_window_closed");

  // Cap on total candidates (anti-spam — Q2 IP rate-limit is layered on top).
  if (exam.openMaxAttempts !== null && exam.openMaxAttempts !== undefined) {
    const used = await db.examCandidate.count({ where: { examId: exam.id } });
    if (used >= exam.openMaxAttempts)
      throw new ExamError("open_max_attempts_reached");
  }

  const input: OpenClaimInput = parseOpenInput(rawInput);

  // PR2.12 — Validate cohortId server-side (client preview is convenience,
  // not trust boundary). Cohort phải cùng course với exam.
  let resolvedCohortId: string | null = null;
  if (input.cohortId) {
    const cohort = await db.cohort.findUnique({
      where: { id: input.cohortId },
      select: { courseId: true },
    });
    if (cohort && cohort.courseId === exam.courseId) {
      resolvedCohortId = input.cohortId;
    }
    // Silent drop nếu cohort không match — không reject claim vì cohort là optional.
  }

  // A5.3 PR1c.4 — Open-code self-register cũng phải gắn candidate vào 1
  // ExamSession. Ensure default session trước transaction để tránh nhập-lồng
  // bằng cách insert ExamRound/ExamSession trong nested tx (risk dead-lock).
  // PR2.12 — Nếu code resolve qua ExamSession.openCode → dùng đúng session đó
  // (mỗi ca 1 mã). Fallback ensureDefaultSession chỉ khi vẫn dùng Exam.openCode.
  const sessionId =
    resolvedSessionId ?? (await ensureDefaultSession(exam.id, db));

  const { candidateId, attemptId, sessionToken } = await (db as typeof prisma).$transaction(
    async (tx) => {
      const c = await tx.examCandidate.create({
        data: {
          examId: exam.id,
          sessionId,
          cohortId: resolvedCohortId,
          displayName: input.displayName,
          metadata: {
            phone: input.phone,
            email: input.email,
            ...(input.studentCode ? { studentCode: input.studentCode } : {}),
            ...(input.class ? { class: input.class } : {}),
          },
        },
        select: { id: true },
      });
      const a = await tx.examAttempt.create({
        data: {
          examId: exam.id,
          candidateId: c.id,
          candidateDisplayName: input.displayName,
          durationSec: exam.durationMin * 60,
          status: "in_progress",
          lastHeartbeatAt: now,
        },
        select: { id: true, sessionToken: true },
      });
      const snapshot = await buildShuffleSnapshot(
        exam.id,
        a.id,
        exam.shuffleQuestions,
        exam.shuffleOptions,
        tx as typeof prisma,
      );
      await tx.examAttempt.update({
        where: { id: a.id },
        data: { shuffleSnapshot: snapshot as unknown as Prisma.InputJsonValue },
      });
      return { candidateId: c.id, attemptId: a.id, sessionToken: a.sessionToken };
    },
  );

  await emitEvent(
    null,
    LearningEventType.ExamCandidateCreated,
    { examId: exam.id, candidateId, mode: "open_code" },
    {
      courseId: exam.courseId,
      candidateId,
      eventKey: `exam.candidate.created:${candidateId}`,
    },
    db,
  );
  await emitEvent(
    null,
    LearningEventType.ExamCandidateCodeClaimed,
    { examId: exam.id, candidateId, attemptId, mode: "open_code" },
    {
      courseId: exam.courseId,
      candidateId,
      eventKey: `exam.candidate.code_claimed:${attemptId}`,
    },
    db,
  );

  return {
    candidateId,
    attemptId,
    examId: exam.id,
    sessionToken,
    displayName: input.displayName,
    resumed: false,
    ttlSec: computeTtlSec(exam),
  };
}

function parseOpenInput(raw: unknown): OpenClaimInput {
  if (!raw || typeof raw !== "object")
    throw new ExamError("candidate_name_required");
  const r = raw as Record<string, unknown>;
  return {
    displayName: normaliseName(r.displayName),
    phone: normalisePhone(r.phone),
    email: normaliseEmail(r.email),
    studentCode:
      typeof r.studentCode === "string" && r.studentCode.trim().length > 0
        ? r.studentCode.trim().slice(0, 50)
        : undefined,
    class:
      typeof r.class === "string" && r.class.trim().length > 0
        ? r.class.trim().slice(0, 100)
        : undefined,
    cohortId:
      typeof r.cohortId === "string" && r.cohortId.trim().length > 0
        ? r.cohortId.trim()
        : undefined,
  };
}

/** Q5: assigned-mode claim. Resumes if candidate already has an attempt. */
export async function claimByAssignedCode(
  code: unknown,
  db: PrismaClient = prisma,
): Promise<ClaimResult> {
  if (typeof code !== "string" || code.trim().length === 0)
    throw new ExamError("invalid_code");
  const candidate = await db.examCandidate.findFirst({
    where: { accessCode: code.trim().toUpperCase() },
    select: {
      id: true,
      examId: true,
      displayName: true,
      disabledAt: true,
      exam: {
        select: {
          id: true,
          accessMode: true,
          status: true,
          openAt: true,
          closeAt: true,
          durationMin: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          courseId: true,
        },
      },
    },
  });
  if (!candidate) throw new ExamError("invalid_code");
  if (candidate.disabledAt) throw new ExamError("candidate_disabled");
  const exam = candidate.exam;
  if (exam.accessMode !== "assigned_code")
    throw new ExamError("access_mode_mismatch");
  if (exam.status !== "published") throw new ExamError("exam_not_open");
  const now = new Date();
  if (now < exam.openAt) throw new ExamError("exam_not_open");
  if (now >= exam.closeAt) throw new ExamError("exam_window_closed");

  // Q5: 1 candidate = 1 attempt. Resume if in progress, reject if submitted.
  const existing = await db.examAttempt.findFirst({
    where: { examId: exam.id, candidateId: candidate.id },
    select: { id: true, status: true, sessionToken: true },
  });

  let attemptId: string;
  let sessionToken: string;
  let resumed = false;

  if (existing) {
    if (existing.status !== "in_progress")
      throw new ExamError("attempt_already_submitted");
    // Rotate sessionToken on re-claim (mirrors User flow A7.4.7).
    const newToken = randomUUID();
    await db.examAttempt.update({
      where: { id: existing.id },
      data: {
        sessionToken: newToken,
        resumeCount: { increment: 1 },
        lastHeartbeatAt: now,
      },
    });
    attemptId = existing.id;
    sessionToken = newToken;
    resumed = true;
  } else {
    const a = await db.examAttempt.create({
      data: {
        examId: exam.id,
        candidateId: candidate.id,
        candidateDisplayName: candidate.displayName,
        durationSec: exam.durationMin * 60,
        status: "in_progress",
        lastHeartbeatAt: now,
      },
      select: { id: true, sessionToken: true },
    });
    const snapshot = await buildShuffleSnapshot(
      exam.id,
      a.id,
      exam.shuffleQuestions,
      exam.shuffleOptions,
      db,
    );
    await db.examAttempt.update({
      where: { id: a.id },
      data: { shuffleSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    attemptId = a.id;
    sessionToken = a.sessionToken;
  }

  await emitEvent(
    null,
    LearningEventType.ExamCandidateCodeClaimed,
    {
      examId: exam.id,
      candidateId: candidate.id,
      attemptId,
      mode: "assigned_code",
      resumed,
    },
    {
      courseId: exam.courseId,
      candidateId: candidate.id,
      // One key per (attempt, claim-count) so retries aren't deduped silently.
      eventKey: resumed
        ? `exam.candidate.code_claimed:${attemptId}:${Date.now()}`
        : `exam.candidate.code_claimed:${attemptId}`,
    },
    db,
  );

  return {
    candidateId: candidate.id,
    attemptId,
    examId: exam.id,
    sessionToken,
    displayName: candidate.displayName,
    resumed,
    ttlSec: computeTtlSec(exam),
  };
}
