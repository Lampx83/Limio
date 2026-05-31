/**
 * Tournament custom missions — DB-touching orchestration.
 *
 * Pure helpers (median, XP math, gating logic) live in customMissions.ts and
 * are unit-tested without a database. This file wires them into Prisma + the
 * LearningEvent stream + XP ledger.
 *
 * AC reference: docs/tournament-custom-missions-AC.md
 */

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { awardXp } from "./xp";
import {
  calcAggregateScore,
  calcMedian,
  calcReviewerXp,
  canResubmit,
  decideWindowAction,
  isOutlier,
  isSpeedRunSubmission,
  type RubricCriterion,
  type ReviewerScoreEntry,
} from "./customMissions";

export class CustomMissionError extends Error {
  constructor(
    public readonly code:
      | "mission_not_found"
      | "submission_not_found"
      | "not_registered"
      | "past_deadline"
      | "speed_run_blocked"
      | "resubmit_blocked"
      | "verify_mode_mismatch"
      | "rubric_missing"
      | "rubric_score_invalid"
      | "self_review_forbidden"
      | "already_reviewed"
      | "review_not_assigned"
      | "reviewer_is_author"
      | "review_already_assigned"
      | "review_assignment_not_found"
      | "validation_failed"
      | "team_submission_captain_only",
    public readonly detail?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "CustomMissionError";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Submit mission (entry point for all 4 verify modes)
// ─────────────────────────────────────────────────────────────────────────

export type SubmitMissionInput = {
  missionId: string;
  userId: string;
  /** Shape varies by verifyMode; see MissionSubmission.payload doc in schema. */
  payload: Prisma.InputJsonValue;
  /** Time elapsed since mission was opened by the user (for AUTO_GRADE speed-run guard). */
  elapsedMsSinceOpen?: number;
};

export async function submitMission(
  input: SubmitMissionInput,
  db: PrismaClient = prisma,
): Promise<{ submissionId: string; status: "pending" | "passed" | "failed" }> {
  const mission = await db.tournamentMission.findUnique({
    where: { id: input.missionId },
    include: { tournament: true },
  });
  if (!mission) throw new CustomMissionError("mission_not_found");
  if (!mission.verifyMode) {
    throw new CustomMissionError("verify_mode_mismatch", {
      reason: "mission is behavior-based (COURSE_LINKED) — use completeMission",
    });
  }

  // Registration check.
  const reg = await db.tournamentRegistration.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId: mission.tournamentId,
        userId: input.userId,
      },
    },
  });
  if (!reg) throw new CustomMissionError("not_registered");

  // Team COLLECTIVE submission: only captain can submit. Stored under
  // captain.userId so member view derives status from captain's submission.
  if (mission.isTeamSubmission && mission.tournament.teamSize > 1) {
    if (!reg.teamId) {
      throw new CustomMissionError("team_submission_captain_only", {
        reason: "user has no team",
      });
    }
    const team = await db.tournamentTeam.findUnique({
      where: { id: reg.teamId },
      select: { captainId: true },
    });
    if (!team || team.captainId !== input.userId) {
      throw new CustomMissionError("team_submission_captain_only");
    }
  }

  const now = new Date();
  const deadline = mission.submissionDeadline;
  if (!deadline) {
    throw new CustomMissionError("validation_failed", {
      reason: "mission missing submissionDeadline",
    });
  }
  if (now >= deadline) throw new CustomMissionError("past_deadline");

  // AC-6.3: AUTO_GRADE speed-run guard.
  if (
    mission.verifyMode === "AUTO_GRADE" &&
    input.elapsedMsSinceOpen !== undefined &&
    isSpeedRunSubmission(input.elapsedMsSinceOpen)
  ) {
    await emitEvent(db, {
      userId: input.userId,
      eventType: LearningEventType.TournamentMissionSpeedRunBlocked,
      payload: {
        missionId: mission.id,
        elapsedMs: input.elapsedMsSinceOpen,
      },
      courseId: mission.tournament.courseId,
    });
    throw new CustomMissionError("speed_run_blocked");
  }

  // Resubmit gate.
  const existing = await db.missionSubmission.findUnique({
    where: {
      missionId_userId: { missionId: mission.id, userId: input.userId },
    },
    include: {
      reviewAssignments: {
        where: { completedAt: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (existing) {
    const isAssignmentGraded =
      mission.verifyMode === "MANUAL_REVIEW"
        ? await isLinkedAssignmentGraded(existing, db)
        : false;

    const ok = canResubmit({
      verifyMode: mission.verifyMode,
      now,
      submissionDeadline: deadline,
      hasCompletedReview: existing.reviewAssignments.length > 0,
      isAssignmentGraded,
    });
    if (!ok) throw new CustomMissionError("resubmit_blocked");
  }

  // Upsert submission row.
  const submission = await db.missionSubmission.upsert({
    where: {
      missionId_userId: { missionId: mission.id, userId: input.userId },
    },
    update: {
      payload: input.payload,
      submittedAt: now,
      // Resubmit on AUTO_GRADE/AUTO_CHECK re-runs verify below; clear stale state.
      status: "pending",
      finalScore: null,
      verifiedAt: null,
    },
    create: {
      missionId: mission.id,
      userId: input.userId,
      payload: input.payload,
    },
  });

  await emitEvent(db, {
    userId: input.userId,
    eventType: LearningEventType.TournamentMissionSubmitted,
    payload: {
      missionId: mission.id,
      submissionId: submission.id,
      missionType: mission.missionType,
      verifyMode: mission.verifyMode,
    },
    courseId: mission.tournament.courseId,
  });

  // Synchronous verify for AUTO_GRADE + AUTO_CHECK; async (peer/manual) stays pending.
  if (mission.verifyMode === "AUTO_GRADE") {
    return await verifyAutoGradeSubmission(submission.id, db);
  }
  if (mission.verifyMode === "AUTO_CHECK") {
    return await verifyAutoCheckSubmission(submission.id, db);
  }
  return { submissionId: submission.id, status: "pending" };
}

async function isLinkedAssignmentGraded(
  submission: { payload: Prisma.JsonValue },
  db: PrismaClient,
): Promise<boolean> {
  const payload = submission.payload as { assignmentSubmissionId?: string } | null;
  if (!payload?.assignmentSubmissionId) return false;
  const a = await db.assignmentSubmission.findUnique({
    where: { id: payload.assignmentSubmissionId },
    select: { status: true },
  });
  return a?.status === "graded";
}

// ─────────────────────────────────────────────────────────────────────────
// AUTO_GRADE — wraps a QuizAttempt result into MissionSubmission status.
// ─────────────────────────────────────────────────────────────────────────

async function verifyAutoGradeSubmission(
  submissionId: string,
  db: PrismaClient,
): Promise<{ submissionId: string; status: "passed" | "failed" }> {
  const submission = await db.missionSubmission.findUnique({
    where: { id: submissionId },
    include: { mission: { include: { tournament: true } } },
  });
  if (!submission) throw new CustomMissionError("submission_not_found");

  const payload = submission.payload as { quizAttemptId?: string } | null;
  if (!payload?.quizAttemptId) {
    throw new CustomMissionError("validation_failed", {
      reason: "AUTO_GRADE payload must include quizAttemptId",
    });
  }
  const attempt = await db.quizAttempt.findUnique({
    where: { id: payload.quizAttemptId },
  });
  if (!attempt || attempt.userId !== submission.userId) {
    throw new CustomMissionError("validation_failed", {
      reason: "quizAttempt not found or owner mismatch",
    });
  }

  const threshold = submission.mission.passThreshold ?? 0.7;
  // QuizAttempt stores scorePct (0..100). Normalize to 0..1.
  const finalScore =
    attempt.scorePct !== null ? attempt.scorePct / 100 : 0;
  const passed = finalScore >= threshold;

  await db.missionSubmission.update({
    where: { id: submissionId },
    data: {
      status: passed ? "passed" : "failed",
      finalScore,
      verifiedAt: new Date(),
    },
  });

  await emitEvent(db, {
    userId: submission.userId,
    eventType: LearningEventType.TournamentMissionVerified,
    payload: {
      submissionId,
      status: passed ? "passed" : "failed",
      finalScore,
    },
    courseId: submission.mission.tournament.courseId,
  });

  if (passed) {
    await awardMissionXp(submission, db);
  }
  return { submissionId, status: passed ? "passed" : "failed" };
}

// ─────────────────────────────────────────────────────────────────────────
// AUTO_CHECK — rule-based verify (url_pattern / file_format synchronous;
// webhook handled by a background worker that calls verifyAutoCheckSubmission
// again after callback).
// ─────────────────────────────────────────────────────────────────────────

async function verifyAutoCheckSubmission(
  submissionId: string,
  db: PrismaClient,
): Promise<{ submissionId: string; status: "pending" | "passed" | "failed" }> {
  const submission = await db.missionSubmission.findUnique({
    where: { id: submissionId },
    include: { mission: { include: { tournament: true } } },
  });
  if (!submission) throw new CustomMissionError("submission_not_found");

  const rule = submission.mission.autoCheckRule as {
    type?: string;
    config?: Record<string, unknown>;
  } | null;
  if (!rule?.type) {
    throw new CustomMissionError("validation_failed", {
      reason: "AUTO_CHECK mission missing autoCheckRule",
    });
  }
  const payload = submission.payload as Record<string, unknown>;

  let passed: boolean | null;
  switch (rule.type) {
    case "url_pattern": {
      const regex = new RegExp(String(rule.config?.regex ?? ""));
      passed = typeof payload.url === "string" && regex.test(payload.url);
      break;
    }
    case "file_format": {
      const allowed = (rule.config?.mime as string[] | undefined) ?? [];
      passed =
        typeof payload.fileMime === "string" && allowed.includes(payload.fileMime);
      break;
    }
    case "webhook":
      // Webhook is async — leave pending; the webhook worker will call
      // markAutoCheckResult() to settle.
      passed = null;
      break;
    default:
      throw new CustomMissionError("validation_failed", {
        reason: `unknown autoCheckRule.type: ${rule.type}`,
      });
  }

  if (passed === null) {
    return { submissionId, status: "pending" };
  }

  const finalScore = passed ? 1 : 0;
  await db.missionSubmission.update({
    where: { id: submissionId },
    data: {
      status: passed ? "passed" : "failed",
      finalScore,
      verifiedAt: new Date(),
    },
  });
  await emitEvent(db, {
    userId: submission.userId,
    eventType: LearningEventType.TournamentMissionVerified,
    payload: { submissionId, status: passed ? "passed" : "failed", finalScore },
    courseId: submission.mission.tournament.courseId,
  });
  if (passed) await awardMissionXp(submission, db);
  return { submissionId, status: passed ? "passed" : "failed" };
}

/** Called by the webhook worker once the 3rd-party endpoint replies. */
export async function markAutoCheckResult(
  submissionId: string,
  result: { passed: boolean; score?: number },
  db: PrismaClient = prisma,
): Promise<void> {
  const submission = await db.missionSubmission.findUnique({
    where: { id: submissionId },
    include: { mission: { include: { tournament: true } } },
  });
  if (!submission) throw new CustomMissionError("submission_not_found");

  const finalScore = result.score ?? (result.passed ? 1 : 0);
  await db.missionSubmission.update({
    where: { id: submissionId },
    data: {
      status: result.passed ? "passed" : "failed",
      finalScore,
      verifiedAt: new Date(),
    },
  });
  await emitEvent(db, {
    userId: submission.userId,
    eventType: LearningEventType.TournamentMissionVerified,
    payload: {
      submissionId,
      status: result.passed ? "passed" : "failed",
      finalScore,
    },
    courseId: submission.mission.tournament.courseId,
  });
  if (result.passed) await awardMissionXp(submission, db);
}

// ─────────────────────────────────────────────────────────────────────────
// MANUAL_REVIEW — listener: when the linked Assignment is graded, fold the
// score into MissionSubmission.
// ─────────────────────────────────────────────────────────────────────────

export async function onAssignmentGraded(
  assignmentSubmissionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const aSub = await db.assignmentSubmission.findUnique({
    where: { id: assignmentSubmissionId },
    include: { assignment: true },
  });
  if (!aSub || aSub.status !== "graded" || aSub.score === null) return;
  const missionId = aSub.assignment.tournamentMissionId;
  if (!missionId) return; // Not a tournament-backed assignment.

  const mission = await db.tournamentMission.findUnique({
    where: { id: missionId },
    include: { tournament: true },
  });
  if (!mission) return;

  const submission = await db.missionSubmission.findUnique({
    where: {
      missionId_userId: { missionId, userId: aSub.userId },
    },
  });
  if (!submission) return; // Submission row should have been created at submit time.

  const finalScore = aSub.score / aSub.assignment.maxScore;
  const threshold = mission.passThreshold ?? 0.5;
  const passed = finalScore >= threshold;

  await db.missionSubmission.update({
    where: { id: submission.id },
    data: {
      status: passed ? "passed" : "failed",
      finalScore,
      verifiedAt: new Date(),
    },
  });
  await emitEvent(db, {
    userId: aSub.userId,
    eventType: LearningEventType.TournamentMissionVerified,
    payload: { submissionId: submission.id, status: passed ? "passed" : "failed", finalScore },
    courseId: mission.tournament.courseId,
  });
  if (passed) {
    await awardMissionXp(
      { id: submission.id, userId: aSub.userId, mission },
      db,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PEER_REVIEW — reviewer submits scores
// ─────────────────────────────────────────────────────────────────────────

export type SubmitPeerReviewInput = {
  reviewAssignmentId: string;
  reviewerId: string;
  scores: ReviewerScoreEntry[];
  comment?: string;
};

export async function submitPeerReview(
  input: SubmitPeerReviewInput,
  db: PrismaClient = prisma,
): Promise<void> {
  const ra = await db.missionReviewAssignment.findUnique({
    where: { id: input.reviewAssignmentId },
    include: { submission: { include: { mission: { include: { tournament: true } } } } },
  });
  if (!ra) throw new CustomMissionError("review_not_assigned");
  if (ra.reviewerId !== input.reviewerId) {
    throw new CustomMissionError("review_not_assigned");
  }
  if (ra.completedAt) throw new CustomMissionError("already_reviewed");
  if (ra.submission.userId === input.reviewerId) {
    throw new CustomMissionError("self_review_forbidden");
  }

  const rubric = ra.submission.mission.rubric as RubricCriterion[] | null;
  if (!rubric || rubric.length === 0) {
    throw new CustomMissionError("rubric_missing");
  }
  validateScoresAgainstRubric(input.scores, rubric);

  await db.missionReviewAssignment.update({
    where: { id: ra.id },
    data: {
      scores: input.scores as unknown as Prisma.InputJsonValue,
      comment: input.comment,
      completedAt: new Date(),
    },
  });

  await emitEvent(db, {
    userId: input.reviewerId,
    eventType: LearningEventType.TournamentMissionReviewed,
    payload: {
      submissionId: ra.submissionId,
      reviewerId: input.reviewerId,
      aggregateScore: calcAggregateScore(input.scores, rubric),
    },
    courseId: ra.submission.mission.tournament.courseId,
  });
}

function validateScoresAgainstRubric(
  scores: ReviewerScoreEntry[],
  rubric: RubricCriterion[],
): void {
  const rubricIds = new Set(rubric.map((c) => c.id));
  for (const s of scores) {
    if (!rubricIds.has(s.criterionId)) {
      throw new CustomMissionError("rubric_score_invalid", {
        reason: `unknown criterionId: ${s.criterionId}`,
      });
    }
    const c = rubric.find((r) => r.id === s.criterionId)!;
    const inRange =
      c.scale === "1-5"
        ? Number.isInteger(s.score) && s.score >= 1 && s.score <= 5
        : s.score === 0 || s.score === 1;
    if (!inRange) {
      throw new CustomMissionError("rubric_score_invalid", {
        reason: `score ${s.score} out of range for ${c.scale}`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PEER_REVIEW — random-assign reviewers when submission deadline closes.
// Called by background job.
// ─────────────────────────────────────────────────────────────────────────

export async function assignPeerReviewers(
  missionId: string,
  db: PrismaClient = prisma,
): Promise<{ assignedCount: number }> {
  const mission = await db.tournamentMission.findUnique({
    where: { id: missionId },
  });
  if (!mission || mission.verifyMode !== "PEER_REVIEW") {
    throw new CustomMissionError("verify_mode_mismatch");
  }
  if (!mission.reviewWindowEndAt) {
    throw new CustomMissionError("validation_failed", {
      reason: "PEER_REVIEW mission missing reviewWindowEndAt",
    });
  }
  const N = mission.peerReviewerCount ?? 3;

  // Hackathon judges: if tournament has judges configured AND this mission is
  // COLLECTIVE (isTeamSubmission), use judges instead of random peer assignment.
  const judges = mission.isTeamSubmission
    ? await db.tournamentJudge.findMany({
        where: { tournamentId: mission.tournamentId },
        select: { userId: true },
      })
    : [];
  const useJudges = judges.length > 0;

  const submissions = await db.missionSubmission.findMany({
    where: { missionId },
    select: { id: true, userId: true },
  });
  if (submissions.length === 0) return { assignedCount: 0 };
  if (!useJudges && submissions.length < 2) return { assignedCount: 0 };

  const submitterIds = submissions.map((s) => s.userId);
  let assignedCount = 0;

  for (const submission of submissions) {
    // Hackathon: every judge reviews every submission (no random sampling).
    // Standard peer: pool = other submitters; randomly pick N.
    const pool = useJudges
      ? judges.map((j) => j.userId).filter((id) => id !== submission.userId)
      : submitterIds.filter((id) => id !== submission.userId);
    if (pool.length === 0) continue;

    // Skip if already assigned (job is idempotent).
    const existing = await db.missionReviewAssignment.findMany({
      where: { submissionId: submission.id },
      select: { reviewerId: true },
    });
    const targetCount = useJudges ? pool.length : N; // all judges, or N peers
    if (existing.length >= targetCount) continue;
    const alreadyAssigned = new Set(existing.map((e) => e.reviewerId));
    const remaining = pool.filter((id) => !alreadyAssigned.has(id));
    const needed = targetCount - existing.length;
    // Judges: assign all remaining (deterministic). Peers: random sample.
    const picks = useJudges ? remaining.slice(0, needed) : pickRandom(remaining, needed);

    for (const reviewerId of picks) {
      await db.missionReviewAssignment.create({
        data: {
          submissionId: submission.id,
          reviewerId,
          dueAt: mission.reviewWindowEndAt,
        },
      });
      await emitEvent(db, {
        userId: reviewerId,
        eventType: LearningEventType.TournamentMissionReviewAssigned,
        payload: {
          submissionId: submission.id,
          reviewerId,
          dueAt: mission.reviewWindowEndAt.toISOString(),
        },
        courseId: null,
      });
      assignedCount++;
    }
  }
  return { assignedCount };
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a.slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────
// PEER_REVIEW — manual reviewer override (instructor UI).
// Auto-assign (assignPeerReviewers) still runs; these let the instructor patch
// the roster by hand — e.g. a reviewer dropped out, or a submission is short.
// Both emit a LearningEvent so the roster change is auditable (§5.1).
// ─────────────────────────────────────────────────────────────────────────

export async function assignReviewerManually(
  input: { submissionId: string; reviewerId: string },
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const submission = await db.missionSubmission.findUnique({
    where: { id: input.submissionId },
    include: {
      mission: { select: { verifyMode: true, reviewWindowEndAt: true } },
    },
  });
  if (!submission) throw new CustomMissionError("submission_not_found");
  if (submission.mission.verifyMode !== "PEER_REVIEW") {
    throw new CustomMissionError("verify_mode_mismatch");
  }
  if (!submission.mission.reviewWindowEndAt) {
    throw new CustomMissionError("validation_failed", {
      reason: "PEER_REVIEW mission missing reviewWindowEndAt",
    });
  }
  if (submission.userId === input.reviewerId) {
    throw new CustomMissionError("reviewer_is_author");
  }
  const existing = await db.missionReviewAssignment.findUnique({
    where: {
      submissionId_reviewerId: {
        submissionId: input.submissionId,
        reviewerId: input.reviewerId,
      },
    },
    select: { id: true },
  });
  if (existing) throw new CustomMissionError("review_already_assigned");

  const created = await db.missionReviewAssignment.create({
    data: {
      submissionId: input.submissionId,
      reviewerId: input.reviewerId,
      dueAt: submission.mission.reviewWindowEndAt,
    },
    select: { id: true },
  });
  await emitEvent(db, {
    userId: input.reviewerId,
    eventType: LearningEventType.TournamentMissionReviewAssigned,
    payload: {
      submissionId: input.submissionId,
      reviewerId: input.reviewerId,
      dueAt: submission.mission.reviewWindowEndAt.toISOString(),
      manual: true,
    },
    courseId: null,
  });
  return created;
}

export async function removeReviewerAssignment(
  input: { assignmentId: string },
  db: PrismaClient = prisma,
): Promise<{ wasCompleted: boolean }> {
  const ra = await db.missionReviewAssignment.findUnique({
    where: { id: input.assignmentId },
    select: { id: true, submissionId: true, reviewerId: true, completedAt: true },
  });
  if (!ra) throw new CustomMissionError("review_assignment_not_found");

  await db.missionReviewAssignment.delete({ where: { id: ra.id } });
  await emitEvent(db, {
    userId: ra.reviewerId,
    eventType: LearningEventType.TournamentMissionReviewUnassigned,
    payload: {
      submissionId: ra.submissionId,
      reviewerId: ra.reviewerId,
      wasCompleted: ra.completedAt !== null,
      manual: true,
    },
    courseId: null,
  });
  return { wasCompleted: ra.completedAt !== null };
}

// ─────────────────────────────────────────────────────────────────────────
// PEER_REVIEW — close review window: median, XP, status.
// Called by background job at mission.reviewWindowEndAt.
// ─────────────────────────────────────────────────────────────────────────

export async function closeReviewWindow(
  missionId: string,
  db: PrismaClient = prisma,
): Promise<{
  closed: number;
  extended: number;
  fallbackManual: number;
}> {
  const mission = await db.tournamentMission.findUnique({
    where: { id: missionId },
    include: { tournament: true },
  });
  if (!mission || mission.verifyMode !== "PEER_REVIEW") {
    throw new CustomMissionError("verify_mode_mismatch");
  }

  const rubric = mission.rubric as RubricCriterion[] | null;
  if (!rubric) throw new CustomMissionError("rubric_missing");
  const threshold = mission.passThreshold;
  if (threshold === null || threshold === undefined) {
    throw new CustomMissionError("validation_failed", {
      reason: "PEER_REVIEW mission missing passThreshold",
    });
  }
  const required = mission.peerReviewerCount ?? 3;

  const submissions = await db.missionSubmission.findMany({
    where: { missionId, status: "pending" },
    include: { reviewAssignments: true },
  });

  let closed = 0;
  let extended = 0;
  let fallbackManual = 0;

  for (const submission of submissions) {
    const completed = submission.reviewAssignments.filter((r) => r.completedAt);
    const decision = decideWindowAction({
      completedReviewCount: completed.length,
      requiredReviewerCount: required,
      extendCount: mission.reviewExtendCount,
    });

    if (decision.action === "extend") {
      // Extend window +24h; persist increment on mission.
      const newEnd = new Date(
        (mission.reviewWindowEndAt ?? new Date()).getTime() +
          24 * 60 * 60 * 1000,
      );
      await db.tournamentMission.update({
        where: { id: missionId },
        data: {
          reviewWindowEndAt: newEnd,
          reviewExtendCount: { increment: 1 },
        },
      });
      // Push existing review-assignment dueAt forward too.
      await db.missionReviewAssignment.updateMany({
        where: {
          submissionId: submission.id,
          completedAt: null,
        },
        data: { dueAt: newEnd },
      });
      await emitEvent(db, {
        userId: submission.userId,
        eventType: LearningEventType.TournamentMissionReviewWindowExtended,
        payload: {
          missionId,
          submissionId: submission.id,
          newEndAt: newEnd.toISOString(),
          extendCount: decision.nextExtendCount,
        },
        courseId: mission.tournament.courseId,
      });
      extended++;
      // Mission-level extend only fires once per close-window run; break to avoid
      // double-extending other submissions in the same loop iteration.
      break;
    }

    if (decision.action === "fallback_manual") {
      await emitEvent(db, {
        userId: submission.userId,
        eventType: LearningEventType.TournamentMissionReviewFallbackManual,
        payload: { missionId, submissionId: submission.id },
        courseId: mission.tournament.courseId,
      });
      fallbackManual++;
      // Leave submission pending; instructor decides via UI to manually mark
      // passed/failed (out of scope for this function).
      continue;
    }

    // decision.action === "close" — aggregate per-reviewer + finalize.
    const aggregates: { ra: typeof completed[number]; score: number }[] = [];
    for (const ra of completed) {
      const score = calcAggregateScore(
        (ra.scores as ReviewerScoreEntry[]) ?? [],
        rubric,
      );
      aggregates.push({ ra, score });
    }
    const median = calcMedian(aggregates.map((a) => a.score));
    const allDeltas = aggregates.map((a) => Math.abs(a.score - median));

    // Per-reviewer XP + outlier flag.
    let reviewIndex = 1;
    for (const { ra, score } of aggregates) {
      const delta = score - median;
      const peerDeltas = allDeltas.filter((_, i) => aggregates[i]!.ra.id !== ra.id);
      const outlier = isOutlier(delta, peerDeltas);
      const xp = calcReviewerXp({
        submittedInTime: true,
        deltaFromMedian: delta,
        reviewIndexInMission: reviewIndex,
      });
      await db.missionReviewAssignment.update({
        where: { id: ra.id },
        data: {
          aggregateScore: score,
          deltaFromMedian: delta,
          xpAwarded: xp.totalXp,
          flagged: outlier,
          flagReason: outlier ? "outlier_delta_gt_2sd" : null,
        },
      });
      if (xp.totalXp > 0) {
        await awardXp(
          {
            userId: ra.reviewerId,
            courseId: mission.tournament.courseId ?? "",
            amount: xp.totalXp,
            reason: "tournament.mission.review.awarded",
            sourceId: `mission-review:${ra.id}`,
          },
          db,
        );
      }
      await emitEvent(db, {
        userId: ra.reviewerId,
        eventType: LearningEventType.TournamentMissionReviewAwarded,
        payload: {
          reviewerId: ra.reviewerId,
          missionId,
          baseXp: xp.baseXp,
          bonusXp: xp.bonusXp,
          deltaFromMedian: delta,
        },
        courseId: mission.tournament.courseId,
      });
      if (outlier) {
        await emitEvent(db, {
          userId: ra.reviewerId,
          eventType: LearningEventType.TournamentMissionReviewFlagged,
          payload: { reviewerId: ra.reviewerId, missionId, reason: "outlier_delta_gt_2sd" },
          courseId: mission.tournament.courseId,
        });
      }
      reviewIndex++;
    }

    // Settle submission.
    const passed = median >= threshold;
    await db.missionSubmission.update({
      where: { id: submission.id },
      data: {
        status: passed ? "passed" : "failed",
        finalScore: median,
        verifiedAt: new Date(),
      },
    });
    await emitEvent(db, {
      userId: submission.userId,
      eventType: LearningEventType.TournamentMissionVerified,
      payload: {
        submissionId: submission.id,
        status: passed ? "passed" : "failed",
        finalScore: median,
      },
      courseId: mission.tournament.courseId,
    });
    if (passed) {
      await awardMissionXp({ ...submission, mission }, db);
    }
    closed++;
  }

  return { closed, extended, fallbackManual };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal: emit event + award submitter XP helpers
// ─────────────────────────────────────────────────────────────────────────

async function emitEvent(
  db: PrismaClient,
  input: {
    userId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    courseId: string | null;
  },
): Promise<void> {
  await db.learningEvent.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      payload: input.payload,
      courseId: input.courseId,
    },
  });
}

async function awardMissionXp(
  submission: { id: string; userId: string; mission: { id: string; points: number; tournament: { courseId: string | null } } },
  db: PrismaClient,
): Promise<void> {
  const points = submission.mission.points;
  if (points <= 0) return;
  await awardXp(
    {
      userId: submission.userId,
      courseId: submission.mission.tournament.courseId ?? "",
      amount: points,
      reason: "tournament.mission.completed",
      sourceId: `mission-passed:${submission.id}`,
    },
    db,
  );
}
