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

export type AutoAssignReviewersGate =
  | { allowed: true }
  | {
      allowed: false;
      reason: "verify_mode_mismatch" | "submission_deadline_not_reached";
    };

/**
 * Gate cho việc instructor bấm-tay "Tự động phân reviewer". Pure (không DB) để
 * test được + tái dùng ở route layer. Quy tắc khớp với điều kiện cron
 * `tournamentTick`: chỉ phân khi đúng mode PEER_REVIEW và đã qua hạn nộp
 * (pool reviewer = người đã nộp bài).
 */
export function gateAutoAssignReviewers(input: {
  verifyMode: string | null;
  submissionDeadline: Date | null;
  now: Date;
}): AutoAssignReviewersGate {
  if (input.verifyMode !== "PEER_REVIEW") {
    return { allowed: false, reason: "verify_mode_mismatch" };
  }
  if (
    !input.submissionDeadline ||
    input.submissionDeadline.getTime() > input.now.getTime()
  ) {
    return { allowed: false, reason: "submission_deadline_not_reached" };
  }
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────
// PEER_REVIEW — phân reviewer CÂN BẰNG TẢI (deterministic, không random).
//
// Vấn đề của random thuần (pickRandom per-submission): chỉ cap "mỗi bài N
// reviewer", không cap "mỗi người gánh bao nhiêu bài" → phương sai dồn tải lên
// vài người (vd 1 SV bị phân 7 bài, người khác 2). Hàm này thay bằng greedy
// least-loaded: mỗi suất luôn rơi vào reviewer hợp lệ đang gánh ÍT nhất → tải
// phân đều gần tuyệt đối, và reproducible (test được).
//
// Ràng buộc:
//   - reviewer ≠ tác giả submission
//   - nếu bài thuộc nhóm (groupKey != null): reviewer phải KHÁC nhóm tác giả
//     (và bản thân reviewer phải thuộc một nhóm — groupKey != null)
//   - không phân trùng (1 reviewer / 1 submission)
//   - `existing` (đã phân, kể cả đã chấm) được tính vào tải + tránh trùng →
//     dùng được cho cả lần phân mới lẫn top-up.
// ─────────────────────────────────────────────────────────────────────────

export interface ReviewerPlanSubmission {
  id: string;
  authorId: string;
  /** teamId cho mission nộp-nhóm; null cho mission solo. */
  groupKey: string | null;
}

export interface ReviewerPlanReviewer {
  userId: string;
  /** teamId nếu reviewer thuộc nhóm; null cho solo. */
  groupKey: string | null;
}

export interface ReviewerPlanInput {
  submissions: ReviewerPlanSubmission[];
  reviewers: ReviewerPlanReviewer[];
  /** Số reviewer mong muốn mỗi submission (peerReviewerCount). */
  perSubmission: number;
  /** Assignment đã tồn tại (completed hoặc pending) — tính tải + tránh trùng. */
  existing: Array<{ submissionId: string; reviewerId: string }>;
}

export interface PlannedReviewerAssignment {
  submissionId: string;
  reviewerId: string;
}

/**
 * Gợi ý số reviewer/bài (peerReviewerCount) để MỖI reviewer chấm ~K bài.
 *
 * Quan hệ tổng lượt chấm: số_bài × reviewer_mỗi_bài = pool × bài_mỗi_reviewer.
 *   ⇒ reviewer_mỗi_bài = ceil( K × pool / số_bài )
 *
 * K=1 ⇒ "phủ hết tối thiểu" (mọi người trong pool chấm ≥1 bài).
 * Trả 0 khi không đủ dữ liệu (số_bài ≤ 0).
 */
export function suggestPeerReviewerCount(input: {
  poolSize: number;
  submissionCount: number;
  reviewsPerReviewer: number;
}): number {
  if (input.submissionCount <= 0 || input.reviewsPerReviewer <= 0) return 0;
  return Math.ceil(
    (input.reviewsPerReviewer * input.poolSize) / input.submissionCount,
  );
}

/**
 * Số người trong pool sẽ thực sự được phân ≥1 bài khi đặt N reviewer/bài.
 * = min(số_bài × N, pool) — vì tổng suất là số_bài×N, không vượt quá pool.
 */
export function reviewerCoverage(input: {
  poolSize: number;
  submissionCount: number;
  reviewersPerSubmission: number;
}): number {
  return Math.min(
    input.submissionCount * input.reviewersPerSubmission,
    input.poolSize,
  );
}

function isEligibleReviewer(
  reviewer: ReviewerPlanReviewer,
  submission: ReviewerPlanSubmission,
): boolean {
  if (reviewer.userId === submission.authorId) return false;
  if (submission.groupKey !== null) {
    // Bài nộp-nhóm: reviewer phải thuộc một nhóm KHÁC nhóm tác giả.
    if (reviewer.groupKey === null) return false;
    if (reviewer.groupKey === submission.groupKey) return false;
  }
  return true;
}

export function planBalancedReviewerAssignments(
  input: ReviewerPlanInput,
): PlannedReviewerAssignment[] {
  const N = Math.max(0, Math.floor(input.perSubmission));
  const load = new Map<string, number>();
  for (const r of input.reviewers) load.set(r.userId, 0);

  // Tải hiện có + tập đã-phân để tránh trùng.
  const assigned = new Set<string>(); // `${submissionId}|${reviewerId}`
  const existingPerSubmission = new Map<string, number>();
  for (const e of input.existing) {
    assigned.add(`${e.submissionId}|${e.reviewerId}`);
    existingPerSubmission.set(
      e.submissionId,
      (existingPerSubmission.get(e.submissionId) ?? 0) + 1,
    );
    if (load.has(e.reviewerId)) {
      load.set(e.reviewerId, (load.get(e.reviewerId) ?? 0) + 1);
    }
  }

  const result: PlannedReviewerAssignment[] = [];
  // Thứ tự ổn định theo submission.id để deterministic.
  const submissions = [...input.submissions].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  for (const sub of submissions) {
    const already = existingPerSubmission.get(sub.id) ?? 0;
    let need = N - already;
    if (need <= 0) continue;

    while (need > 0) {
      // Candidate = hợp lệ, chưa phân cho bài này, sắp theo (tải tăng, userId tăng).
      const candidates = input.reviewers
        .filter(
          (r) =>
            isEligibleReviewer(r, sub) &&
            !assigned.has(`${sub.id}|${r.userId}`),
        )
        .sort((a, b) => {
          const la = load.get(a.userId) ?? 0;
          const lb = load.get(b.userId) ?? 0;
          if (la !== lb) return la - lb;
          return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
        });
      const pick = candidates[0];
      if (!pick) break; // hết người hợp lệ → best effort, dừng bài này
      result.push({ submissionId: sub.id, reviewerId: pick.userId });
      assigned.add(`${sub.id}|${pick.userId}`);
      load.set(pick.userId, (load.get(pick.userId) ?? 0) + 1);
      need--;
    }
  }
  return result;
}
