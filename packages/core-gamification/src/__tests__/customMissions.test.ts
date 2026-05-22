import { describe, expect, it } from "vitest";
import {
  calcAggregateScore,
  calcMedian,
  calcReviewerXp,
  canResubmit,
  decideWindowAction,
  isMutualHighScoreCollusion,
  isOutlier,
  isSpeedRunSubmission,
  type RubricCriterion,
} from "../customMissions";

describe("calcMedian", () => {
  it("odd length", () => {
    expect(calcMedian([0.3, 0.7, 0.5])).toBe(0.5);
  });
  it("even length averages middle two", () => {
    expect(calcMedian([0.2, 0.4, 0.6, 0.8])).toBeCloseTo(0.5);
  });
  it("throws on empty", () => {
    expect(() => calcMedian([])).toThrow("median_empty");
  });
});

describe("calcAggregateScore", () => {
  const rubric: RubricCriterion[] = [
    { id: "clarity", scale: "1-5", weight: 2 },
    { id: "originality", scale: "1-5", weight: 1 },
    { id: "completed", scale: "pass_fail", weight: 1 },
  ];

  it("AC-4.7: weighted normalized average", () => {
    const score = calcAggregateScore(
      [
        { criterionId: "clarity", score: 5 },
        { criterionId: "originality", score: 3 },
        { criterionId: "completed", score: 1 },
      ],
      rubric,
    );
    // clarity normalized = 1, originality = 0.5, completed = 1
    // weighted = (1*2 + 0.5*1 + 1*1) / 4 = 3.5/4 = 0.875
    expect(score).toBeCloseTo(0.875);
  });

  it("missing criterion treated as 0", () => {
    const score = calcAggregateScore(
      [{ criterionId: "clarity", score: 5 }],
      rubric,
    );
    // only clarity = 1 with weight 2 of 4 → 0.5
    expect(score).toBeCloseTo(0.5);
  });

  it("throws on empty rubric", () => {
    expect(() => calcAggregateScore([], [])).toThrow("rubric_empty");
  });

  it("clamps 1-5 score above range", () => {
    const r: RubricCriterion[] = [{ id: "x", scale: "1-5", weight: 1 }];
    expect(calcAggregateScore([{ criterionId: "x", score: 10 }], r)).toBe(1);
  });
});

describe("calcReviewerXp", () => {
  it("AC-4.7: in-time + delta ≤ 0.1 → base 5 + bonus 10", () => {
    expect(
      calcReviewerXp({
        submittedInTime: true,
        deltaFromMedian: 0.05,
        reviewIndexInMission: 1,
      }),
    ).toEqual({ baseXp: 5, bonusXp: 10, totalXp: 15 });
  });

  it("AC-4.7: delta in (0.1, 0.2] → bonus 5", () => {
    expect(
      calcReviewerXp({
        submittedInTime: true,
        deltaFromMedian: 0.15,
        reviewIndexInMission: 1,
      }).bonusXp,
    ).toBe(5);
  });

  it("AC-4.7: delta > 0.2 → no bonus", () => {
    expect(
      calcReviewerXp({
        submittedInTime: true,
        deltaFromMedian: 0.4,
        reviewIndexInMission: 1,
      }).bonusXp,
    ).toBe(0);
  });

  it("AC-4.7: 4th review onwards gets base only (cap)", () => {
    const r = calcReviewerXp({
      submittedInTime: true,
      deltaFromMedian: 0.05,
      reviewIndexInMission: 4,
    });
    expect(r).toEqual({ baseXp: 5, bonusXp: 0, totalXp: 5 });
  });

  it("AC-4.9: not in time → 0 XP", () => {
    expect(
      calcReviewerXp({
        submittedInTime: false,
        deltaFromMedian: 0,
        reviewIndexInMission: 1,
      }),
    ).toEqual({ baseXp: 0, bonusXp: 0, totalXp: 0 });
  });
});

describe("isOutlier", () => {
  it("AC-4.8: extreme delta vs peers flagged", () => {
    expect(isOutlier(0.8, [0.05, 0.03, 0.04, 0.06])).toBe(true);
  });

  it("not enough peers (n<2) → false", () => {
    expect(isOutlier(1, [1])).toBe(false);
  });

  it("uniform peer deltas (sd=0) — own delta within mean → false", () => {
    expect(isOutlier(0.1, [0.1, 0.1, 0.1])).toBe(false);
  });

  it("uniform peer deltas (sd=0) — own delta above mean → true", () => {
    expect(isOutlier(0.8, [0.1, 0.1, 0.1])).toBe(true);
  });
});

describe("canResubmit", () => {
  const before = new Date("2026-05-21T10:00:00Z");
  const deadline = new Date("2026-05-21T12:00:00Z");
  const after = new Date("2026-05-21T13:00:00Z");

  it("AC-2.3: past deadline → false (all modes)", () => {
    for (const verifyMode of [
      "AUTO_GRADE",
      "AUTO_CHECK",
      "PEER_REVIEW",
      "MANUAL_REVIEW",
    ] as const) {
      expect(
        canResubmit({ verifyMode, now: after, submissionDeadline: deadline }),
      ).toBe(false);
    }
  });

  it("AC-2.2: AUTO_GRADE before deadline → true", () => {
    expect(
      canResubmit({
        verifyMode: "AUTO_GRADE",
        now: before,
        submissionDeadline: deadline,
      }),
    ).toBe(true);
  });

  it("AC-4.4: PEER_REVIEW with completed review → false", () => {
    expect(
      canResubmit({
        verifyMode: "PEER_REVIEW",
        now: before,
        submissionDeadline: deadline,
        hasCompletedReview: true,
      }),
    ).toBe(false);
  });

  it("AC-4.4: PEER_REVIEW without any completed review → true", () => {
    expect(
      canResubmit({
        verifyMode: "PEER_REVIEW",
        now: before,
        submissionDeadline: deadline,
        hasCompletedReview: false,
      }),
    ).toBe(true);
  });

  it("AC-5.5: MANUAL_REVIEW graded → false", () => {
    expect(
      canResubmit({
        verifyMode: "MANUAL_REVIEW",
        now: before,
        submissionDeadline: deadline,
        isAssignmentGraded: true,
      }),
    ).toBe(false);
  });

  it("AC-5.5: MANUAL_REVIEW not graded → true", () => {
    expect(
      canResubmit({
        verifyMode: "MANUAL_REVIEW",
        now: before,
        submissionDeadline: deadline,
        isAssignmentGraded: false,
      }),
    ).toBe(true);
  });
});

describe("decideWindowAction", () => {
  it("AC-4.10: enough reviews → close", () => {
    expect(
      decideWindowAction({
        completedReviewCount: 3,
        requiredReviewerCount: 3,
        extendCount: 0,
      }),
    ).toEqual({ action: "close" });
  });

  it("AC-4.10: short and never extended → extend (count=1)", () => {
    expect(
      decideWindowAction({
        completedReviewCount: 1,
        requiredReviewerCount: 3,
        extendCount: 0,
      }),
    ).toEqual({ action: "extend", nextExtendCount: 1 });
  });

  it("AC-4.10: short and extended once → extend (count=2)", () => {
    expect(
      decideWindowAction({
        completedReviewCount: 2,
        requiredReviewerCount: 3,
        extendCount: 1,
      }),
    ).toEqual({ action: "extend", nextExtendCount: 2 });
  });

  it("AC-4.10: short after 2 extends → fallback manual", () => {
    expect(
      decideWindowAction({
        completedReviewCount: 2,
        requiredReviewerCount: 3,
        extendCount: 2,
      }),
    ).toEqual({ action: "fallback_manual" });
  });
});

describe("isSpeedRunSubmission", () => {
  it("AC-6.3: < 10s → blocked", () => {
    expect(isSpeedRunSubmission(5_000)).toBe(true);
  });
  it("AC-6.3: ≥ 10s → allowed", () => {
    expect(isSpeedRunSubmission(10_000)).toBe(false);
    expect(isSpeedRunSubmission(15_000)).toBe(false);
  });
});

describe("isMutualHighScoreCollusion", () => {
  it("AC-6.2: both inflated > 0.2 above peer median → flag", () => {
    expect(
      isMutualHighScoreCollusion({
        aOnB: 0.95,
        bOnA: 0.95,
        peerMedianOnB: 0.5,
        peerMedianOnA: 0.5,
      }),
    ).toBe(true);
  });

  it("AC-6.2: only one direction inflated → no flag", () => {
    expect(
      isMutualHighScoreCollusion({
        aOnB: 0.95,
        bOnA: 0.55,
        peerMedianOnB: 0.5,
        peerMedianOnA: 0.5,
      }),
    ).toBe(false);
  });

  it("AC-6.2: both close to peer median → no flag", () => {
    expect(
      isMutualHighScoreCollusion({
        aOnB: 0.55,
        bOnA: 0.55,
        peerMedianOnB: 0.5,
        peerMedianOnA: 0.5,
      }),
    ).toBe(false);
  });
});
