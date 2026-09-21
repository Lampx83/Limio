import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Prisma,
  prisma,
  type ExamAttempt,
  type ExamAttemptStatus,
  type PrismaClient,
} from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { assertEligibleForExam } from "./cohorts";
import { materializeRandomSections } from "./sections";
import {
  assertSubjectOwnsAttempt,
  emitArgsForSubject,
  type ExamSubject,
} from "./subject";
import { ExamError } from "./types";

/**
 * Deterministic Fisher-Yates shuffle seeded from a string. We never shuffle
 * with Math.random() at runtime — the snapshot must be reproducible for
 * resume + dispute review.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = arr.slice();
  // FNV-1a -> 32 bit state for reproducibility.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

interface ShuffleSnapshot {
  /** Question IDs per passage (key = passageId), plus "standalone" bucket. */
  questionOrderByPassage: Record<string, string[]>;
  /** Option IDs per MCQ/MULTI question. Other types omitted. */
  optionOrderByQuestion: Record<string, string[]>;
}

export async function buildShuffleSnapshot(
  examId: string,
  attemptId: string,
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
  db: PrismaClient,
): Promise<ShuffleSnapshot> {
  const questions = await db.examQuestion.findMany({
    where: { examId },
    orderBy: [{ orderInExam: "asc" }],
    select: {
      id: true,
      type: true,
      passageId: true,
      orderInPassage: true,
      config: true,
    },
  });

  const byPassage: Record<string, typeof questions> = { standalone: [] };
  for (const q of questions) {
    const key = q.passageId ?? "standalone";
    (byPassage[key] ??= []).push(q);
  }
  const questionOrderByPassage: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(byPassage)) {
    const sorted = list
      .slice()
      .sort((a, b) =>
        key === "standalone"
          ? 0
          : (a.orderInPassage ?? 0) - (b.orderInPassage ?? 0),
      );
    const ids = sorted.map((q) => q.id);
    questionOrderByPassage[key] = shuffleQuestions
      ? seededShuffle(ids, `${attemptId}:passage:${key}`)
      : ids;
  }

  const optionOrderByQuestion: Record<string, string[]> = {};
  if (shuffleOptions) {
    for (const q of questions) {
      if (q.type !== "mcq" && q.type !== "multi") continue;
      const cfg = q.config as { options?: Array<{ id: string }> };
      const ids = (cfg.options ?? []).map((o) => o.id);
      optionOrderByQuestion[q.id] = seededShuffle(ids, `${attemptId}:opt:${q.id}`);
    }
  }

  return { questionOrderByPassage, optionOrderByQuestion };
}

async function loadExamForRuntime(examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      status: true,
      openAt: true,
      closeAt: true,
      durationMin: true,
      attemptPolicy: true,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  return exam;
}

/**
 * A7.4.1 / A7.4.5 — Start or resume an attempt.
 *
 * If learner already has an IN_PROGRESS attempt → resume (returns same row,
 * increments resumeCount, rotates sessionToken so the new tab "claims" it).
 *
 * If attemptPolicy=single and learner has a SUBMITTED/GRADED attempt → 409.
 */
export async function startExamAttempt(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<{
  attemptId: string;
  sessionToken: string;
  resumed: boolean;
  durationSec: number;
}> {
  const exam = await loadExamForRuntime(examId, db);

  // A5.8: composite unique was replaced with partial unique index in raw SQL;
  // Prisma can't model partial unique, so we use findFirst here. Still hits the
  // index because the where matches (examId, userId).
  const existing = await db.examAttempt.findFirst({
    where: { examId, userId },
    select: {
      id: true,
      status: true,
      sessionToken: true,
      durationSec: true,
      resumeCount: true,
    },
  });

  // Bài đã có được xử lý TRƯỚC khi kiểm tra ca còn mở: người đã nộp mở lại link
  // ở trang khoá học sau giờ đóng phải được báo "đã nộp" (để chuyển sang kết quả),
  // không phải "bài thi đã đóng"; người rớt mạng giữa chừng vẫn vào lại được bài
  // của mình. Điều kiện tham dự (ghi danh, lớp, cửa sổ) đã được kiểm lúc bắt đầu.
  if (existing) {
    if (existing.status === "in_progress") {
      // Resume — rotate session token so new tab claims the lock (A7.4.7).
      const newToken = randomUUID();
      await db.examAttempt.update({
        where: { id: existing.id },
        data: {
          sessionToken: newToken,
          resumeCount: { increment: 1 },
        },
      });
      return {
        attemptId: existing.id,
        sessionToken: newToken,
        resumed: true,
        durationSec: existing.durationSec,
      };
    }
    if (exam.attemptPolicy === "single") {
      throw new ExamError("attempt_already_submitted");
    }
    // multi attempts not implemented in P0; treat same as single for safety.
    throw new ExamError("attempt_already_submitted");
  }

  // A5.2 — eligibility (status, schedule window, cohort, enrollment, duration)
  // all live in assertEligibleForExam now. Legacy exam.openAt/closeAt is the
  // fallback when no ExamSchedule rows exist. Chỉ cần khi BẮT ĐẦU bài mới.
  const eligibility = await assertEligibleForExam(userId, examId, db);
  const durationSec = eligibility.durationSec;
  const attemptId = randomUUID();
  const sessionToken = randomUUID();
  const baseSnapshot = await buildShuffleSnapshot(
    examId,
    attemptId,
    exam.shuffleQuestions,
    exam.shuffleOptions,
    db,
  );
  // A5.2.4 — run random pool samplers for sections with selectionMode=
  // random_from_bank + per_attempt. Deterministic per (examId, userId, sectionId)
  // so resume picks up the same questions.
  const sectionMaterializations = await materializeRandomSections(
    examId,
    userId,
    db,
  ).catch((e) => {
    // Vẫn cho vào thi (đường ExamQuestion cố định không phụ thuộc bước này),
    // nhưng KHÔNG nuốt im: pool thiếu/hỏng phải để lại dấu vết để còn biết.
    console.error("[attempts] materializeRandomSections failed", { examId, userId, e });
    return {};
  });
  const snapshot = {
    ...baseSnapshot,
    sectionMaterializations,
  };
  await db.examAttempt.create({
    data: {
      id: attemptId,
      examId,
      userId,
      durationSec,
      sessionToken,
      // Chốt ca thi ngay đây. assertEligibleForExam vừa chọn ca theo "ca nào
      // đang mở lúc này"; không lưu lại thì lúc xem kết quả phải đoán lại, mà
      // lúc đó ca có thể đã đóng hoặc đã có ca khác mở.
      sessionId: eligibility.scheduleId,
      shuffleSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.ExamStarted,
    { examId, attemptId, durationSec },
    {
      courseId: exam.courseId,
      eventKey: `exam.started:${attemptId}`,
    },
    db,
  );
  return { attemptId, sessionToken, resumed: false, durationSec };
}

/**
 * A7.4.3 — Runtime payload. Returns server clock + answers so client can
 * compute remaining time and rehydrate UI state on resume.
 */
export async function getAttemptRuntime(
  subject: ExamSubject,
  attemptId: string,
  db: PrismaClient = prisma,
) {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          courseId: true,
          title: true,
          durationMin: true,
          closeAt: true,
          status: true,
          showResultsAfterSubmit: true,
        },
      },
      answers: {
        select: {
          questionId: true,
          answerJson: true,
          answerHash: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    status: attempt.status as ExamAttemptStatus,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    durationSec: attempt.durationSec,
    serverNow: new Date().toISOString(),
    sessionToken: attempt.sessionToken,
    shuffleSnapshot: attempt.shuffleSnapshot as unknown as ShuffleSnapshot,
    exam: attempt.exam,
    answers: attempt.answers,
  };
}

const SaveAnswerInput = z.object({
  /** Free-form per question type — server validates via questionType config. */
  answerJson: z.unknown(),
  /** Required for single-tab enforcement (A7.4.7). */
  sessionToken: z.string().min(1),
});

function hashAnswer(value: unknown): string {
  // Stable JSON: keys sorted recursively so identical content => identical hash.
  const stable = JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
  return createHash("sha256").update(stable ?? "null").digest("hex");
}

/**
 * A7.4.4 — Upsert learner answer. Idempotent: identical answerJson
 * (same hash) → no row update, no duplicate events.
 *
 * A7.4.7 — sessionToken from client must match attempt's current token. Stale
 * tokens (issued before another tab claimed the attempt) are rejected 409.
 */
export async function saveAnswer(
  subject: ExamSubject,
  attemptId: string,
  questionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ answerHash: string; persisted: boolean }> {
  const parsed = SaveAnswerInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());

  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      userId: true,
      candidateId: true,
      status: true,
      sessionToken: true,
      startedAt: true,
      durationSec: true,
      exam: { select: { courseId: true } },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  if (attempt.status !== "in_progress") {
    throw new ExamError("attempt_already_submitted");
  }
  if (attempt.sessionToken !== parsed.data.sessionToken) {
    throw new ExamError("session_stale");
  }
  // Reject if past hard deadline. (Autosubmit job will flip status, but a
  // racing autosave should still be refused.)
  const deadlineMs =
    attempt.startedAt.getTime() + attempt.durationSec * 1000;
  if (Date.now() > deadlineMs) {
    throw new ExamError("attempt_already_submitted");
  }

  // Verify question belongs to this exam (defense: client-supplied id).
  const question = await db.examQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, examId: true, passageId: true },
  });
  if (!question || question.examId !== attempt.examId) {
    throw new ExamError("question_not_in_exam");
  }

  const newHash = hashAnswer(parsed.data.answerJson);
  const elapsedMs = Date.now() - attempt.startedAt.getTime();

  const result = await (db as typeof prisma).$transaction(async (tx) => {
    const existing = await tx.examAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      select: { id: true, answerHash: true },
    });
    if (existing && existing.answerHash === newHash) {
      return { persisted: false };
    }
    await tx.examAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        answerJson: parsed.data.answerJson as Prisma.InputJsonValue,
        answerHash: newHash,
        needsGrading: true,
      },
      update: {
        answerJson: parsed.data.answerJson as Prisma.InputJsonValue,
        answerHash: newHash,
        needsGrading: true,
        autoScore: null,
        manualScore: null,
        graderId: null,
        gradedAt: null,
      },
    });
    return { persisted: true };
  });

  if (result.persisted) {
    const ev = emitArgsForSubject(subject);
    // Emit per-question event (used by Feedback Engine for BKT) and the
    // generic autosave event. Idempotency key is (attemptId, questionId,
    // hash) — replays with same content won't double-emit.
    await emitEvent(
      ev.userId,
      LearningEventType.ExamQuestionAnswered,
      {
        examId: attempt.examId,
        attemptId,
        questionId,
        passageId: question.passageId ?? undefined,
        answerJson: parsed.data.answerJson,
        answerHash: newHash,
        elapsedMs,
      },
      {
        courseId: attempt.exam.courseId,
        candidateId: ev.candidateId,
        eventKey: `exam.question.answered:${attemptId}:${questionId}:${newHash}`,
      },
      db,
    );
    await emitEvent(
      ev.userId,
      LearningEventType.ExamAutosaved,
      { attemptId, questionId, answerHash: newHash },
      {
        courseId: attempt.exam.courseId,
        candidateId: ev.candidateId,
        eventKey: `exam.autosaved:${attemptId}:${questionId}:${newHash}`,
      },
      db,
    );
  }

  return { answerHash: newHash, persisted: result.persisted };
}

/**
 * A7.4.7 — Explicit session claim. Used when a learner opens a second tab and
 * wants to take over the attempt (browser flow: warn "in-progress in another
 * tab — claim here?"). Rotates the sessionToken so the original tab's saves
 * start returning session_stale.
 */
export async function claimAttemptSession(
  subject: ExamSubject,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ sessionToken: string }> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, candidateId: true, status: true },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  if (attempt.status !== "in_progress") {
    throw new ExamError("attempt_already_submitted");
  }
  const sessionToken = randomUUID();
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { sessionToken, resumeCount: { increment: 1 } },
  });
  return { sessionToken };
}

/** Visible to tests / future routes for incident logging in A7.7.3. */
export type { ExamAttempt };
