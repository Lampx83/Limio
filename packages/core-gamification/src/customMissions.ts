/**
 * Tournament custom missions — pure deterministic helpers.
 *
 * DB-touching orchestration (assign reviewers, close window, emit events,
 * award XP) lives in separate files. This module is pure so the tricky math
 * (median, weighted aggregate, XP bonus curve, outlier detection, resubmit
 * gating, extend-window state machine) can be unit-tested without a database.
 *
 * AC reference: docs/tournament-custom-missions-AC.md
 */

export type VerifyMode =
  | "AUTO_GRADE"
  | "AUTO_CHECK"
  | "PEER_REVIEW"
  | "MANUAL_REVIEW";

export type RubricCriterion = {
  id: string;
  /** "1-5" → score in [1..5]; "pass_fail" → score in {0, 1}. */
  scale: "1-5" | "pass_fail";
  /** Relative weight; criteria don't need to sum to 1 — normalized internally. */
  weight: number;
};

export type ReviewerScoreEntry = { criterionId: string; score: number };

/** Median for an odd or even length array; throws on empty. */
export function calcMedian(values: number[]): number {
  if (values.length === 0) throw new Error("median_empty");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Aggregate a reviewer's per-criterion scores into a single 0..1 number using
 * the rubric's weights. Each criterion is normalized to 0..1 first
 * (1-5 → (score-1)/4; pass_fail → score as-is), then weighted average.
 *
 * Missing criteria from `scores` are treated as 0 — incomplete reviews are
 * penalized, not silently dropped.
 */
export function calcAggregateScore(
  scores: ReviewerScoreEntry[],
  rubric: RubricCriterion[],
): number {
  if (rubric.length === 0) throw new Error("rubric_empty");
  const totalWeight = rubric.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) throw new Error("rubric_weight_invalid");

  const scoreMap = new Map(scores.map((s) => [s.criterionId, s.score]));
  let weighted = 0;
  for (const c of rubric) {
    const raw = scoreMap.get(c.id) ?? 0;
    const normalized =
      c.scale === "1-5"
        ? Math.max(0, Math.min(1, (raw - 1) / 4))
        : raw === 1
          ? 1
          : 0;
    weighted += normalized * (c.weight / totalWeight);
  }
  return weighted;
}

/**
 * Reviewer XP formula (AC-4.7).
 * - Base 5 XP if reviewer submitted in time.
 * - Bonus by |aggregate - median|: ≤0.1 → +10, ≤0.2 → +5, else 0.
 *   (delta operates on normalized 0..1 aggregate, so 0.1 ≈ "within ±1 point on
 *    a 1-5 rubric criterion".)
 * - Cap: only the first 3 reviews per reviewer per mission get bonus.
 *   Reviews 4+ get base only.
 */
export function calcReviewerXp(params: {
  submittedInTime: boolean;
  deltaFromMedian: number;
  /** 1-based index of this review among the reviewer's reviews for THIS mission. */
  reviewIndexInMission: number;
}): { baseXp: number; bonusXp: number; totalXp: number } {
  if (!params.submittedInTime) {
    return { baseXp: 0, bonusXp: 0, totalXp: 0 };
  }
  const baseXp = 5;
  let bonusXp = 0;
  if (params.reviewIndexInMission <= 3) {
    const d = Math.abs(params.deltaFromMedian);
    if (d <= 0.1) bonusXp = 10;
    else if (d <= 0.2) bonusXp = 5;
  }
  return { baseXp, bonusXp, totalXp: baseXp + bonusXp };
}

/**
 * Outlier detection (AC-4.8). A review is an outlier if its |delta| exceeds
 * mean + 2*SD of the OTHER reviewers' |deltas| on the same submission.
 * Excluding self avoids the case where a large outlier inflates SD enough to
 * mask itself. Returns false when n_peers < 2 (not enough data).
 */
export function isOutlier(reviewerDelta: number, peerDeltas: number[]): boolean {
  if (peerDeltas.length < 2) return false;
  const abs = peerDeltas.map((d) => Math.abs(d));
  const mean = abs.reduce((s, d) => s + d, 0) / abs.length;
  const variance =
    abs.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / abs.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return Math.abs(reviewerDelta) > mean;
  return Math.abs(reviewerDelta) - mean > 2 * sd;
}

/**
 * Resubmit eligibility gate.
 * - AUTO_GRADE / AUTO_CHECK: allowed until submissionDeadline.
 * - PEER_REVIEW: allowed until submissionDeadline AND no review completed yet.
 * - MANUAL_REVIEW: allowed until submissionDeadline AND assignment not graded.
 */
export function canResubmit(params: {
  verifyMode: VerifyMode;
  now: Date;
  submissionDeadline: Date;
  hasCompletedReview?: boolean;
  isAssignmentGraded?: boolean;
}): boolean {
  // Resubmission is allowed freely until the deadline — only the deadline locks
  // it. (Product decision: supersedes the earlier per-mode locks that froze
  // resubmit once a peer review landed / a manual grade was given.)
  return params.now < params.submissionDeadline;
}

/**
 * Extend-window decision (AC-4.10).
 * - completed < required AND extendCount < 2 → extend +24h.
 * - completed < required AND extendCount >= 2 → fallback to MANUAL_REVIEW.
 * - completed >= required → close normally.
 */
export function decideWindowAction(params: {
  completedReviewCount: number;
  requiredReviewerCount: number;
  extendCount: number;
}): { action: "close" | "extend" | "fallback_manual"; nextExtendCount?: number } {
  if (params.completedReviewCount >= params.requiredReviewerCount) {
    return { action: "close" };
  }
  if (params.extendCount < 2) {
    return { action: "extend", nextExtendCount: params.extendCount + 1 };
  }
  return { action: "fallback_manual" };
}

/**
 * Speed-run guard (AC-6.3). Submission within 10s of mission open is rejected.
 */
export const SPEED_RUN_THRESHOLD_MS = 10_000;
export function isSpeedRunSubmission(elapsedMs: number): boolean {
  return elapsedMs < SPEED_RUN_THRESHOLD_MS;
}

/**
 * Collusion pattern check (AC-6.2). Given a pair (A reviewed B, B reviewed A)
 * and their aggregate scores plus the medians from OTHER reviewers, return true
 * if both directions are inflated by >0.2 above the peer median (mutual high).
 */
export function isMutualHighScoreCollusion(params: {
  aOnB: number;
  bOnA: number;
  peerMedianOnB: number;
  peerMedianOnA: number;
  threshold?: number;
}): boolean {
  const threshold = params.threshold ?? 0.2;
  return (
    params.aOnB - params.peerMedianOnB > threshold &&
    params.bOnA - params.peerMedianOnA > threshold
  );
}
