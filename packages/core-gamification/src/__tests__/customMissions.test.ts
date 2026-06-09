import { describe, expect, it } from "vitest";
import {
  calcAggregateScore,
  calcMedian,
  calcReviewerXp,
  canResubmit,
  decideWindowAction,
  gateAutoAssignReviewers,
  isMutualHighScoreCollusion,
  isOutlier,
  isSpeedRunSubmission,
  planBalancedReviewerAssignments,
  type ReviewerPlanInput,
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

  it("before deadline → true regardless of completed peer review", () => {
    // Deadline-only policy: resubmit stays open even after a review lands.
    expect(
      canResubmit({
        verifyMode: "PEER_REVIEW",
        now: before,
        submissionDeadline: deadline,
        hasCompletedReview: true,
      }),
    ).toBe(true);
    expect(
      canResubmit({
        verifyMode: "PEER_REVIEW",
        now: before,
        submissionDeadline: deadline,
        hasCompletedReview: false,
      }),
    ).toBe(true);
  });

  it("before deadline → true regardless of manual grade", () => {
    // Deadline-only policy: resubmit stays open even after a manual grade.
    expect(
      canResubmit({
        verifyMode: "MANUAL_REVIEW",
        now: before,
        submissionDeadline: deadline,
        isAssignmentGraded: true,
      }),
    ).toBe(true);
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

describe("gateAutoAssignReviewers", () => {
  const past = new Date("2026-06-01T00:00:00Z");
  const future = new Date("2026-06-30T00:00:00Z");
  const now = new Date("2026-06-09T00:00:00Z");

  it("PEER_REVIEW + đã qua hạn nộp → allowed", () => {
    expect(
      gateAutoAssignReviewers({
        verifyMode: "PEER_REVIEW",
        submissionDeadline: past,
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it("không phải PEER_REVIEW → chặn verify_mode_mismatch (ưu tiên hơn hạn nộp)", () => {
    expect(
      gateAutoAssignReviewers({
        verifyMode: "MANUAL_REVIEW",
        submissionDeadline: past,
        now,
      }),
    ).toEqual({ allowed: false, reason: "verify_mode_mismatch" });
  });

  it("chưa tới hạn nộp → chặn submission_deadline_not_reached", () => {
    expect(
      gateAutoAssignReviewers({
        verifyMode: "PEER_REVIEW",
        submissionDeadline: future,
        now,
      }),
    ).toEqual({ allowed: false, reason: "submission_deadline_not_reached" });
  });

  it("chưa đặt hạn nộp (null) → chặn submission_deadline_not_reached", () => {
    expect(
      gateAutoAssignReviewers({
        verifyMode: "PEER_REVIEW",
        submissionDeadline: null,
        now,
      }),
    ).toEqual({ allowed: false, reason: "submission_deadline_not_reached" });
  });

  it("đúng thời khắc hạn nộp (deadline === now) → allowed", () => {
    expect(
      gateAutoAssignReviewers({
        verifyMode: "PEER_REVIEW",
        submissionDeadline: now,
        now,
      }),
    ).toEqual({ allowed: true });
  });
});

describe("planBalancedReviewerAssignments", () => {
  /** Đếm tải mỗi reviewer từ kết quả plan. */
  function loadOf(
    plan: { submissionId: string; reviewerId: string }[],
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const a of plan) m.set(a.reviewerId, (m.get(a.reviewerId) ?? 0) + 1);
    return m;
  }

  it("solo: mỗi bài đủ N reviewer, không tự chấm, tải cân bằng", () => {
    const subs = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      authorId: `u${i}`,
      groupKey: null,
    }));
    const reviewers = Array.from({ length: 6 }, (_, i) => ({
      userId: `u${i}`,
      groupKey: null,
    }));
    const plan = planBalancedReviewerAssignments({
      submissions: subs,
      reviewers,
      perSubmission: 3,
      existing: [],
    });
    // 6 bài × 3 = 18 suất.
    expect(plan).toHaveLength(18);
    const load = loadOf(plan);
    const counts = reviewers.map((r) => load.get(r.userId) ?? 0);
    // Greedy least-loaded: chênh lệch tải nhỏ (≤2 ở pool nhỏ adversarial này;
    // với pool lớn thực tế sẽ ≤1). Khác hẳn random thuần (từng cho 7-vs-2).
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
    // Không ai tự chấm bài mình.
    for (const a of plan) {
      const sub = subs.find((s) => s.id === a.submissionId)!;
      expect(a.reviewerId).not.toBe(sub.authorId);
    }
  });

  it("team: reviewer luôn khác nhóm tác giả + tải cân bằng giữa mọi thành viên", () => {
    // 3 nhóm, mỗi nhóm 2 thành viên; mỗi nhóm nộp 1 bài (captain nộp).
    const teams = ["A", "B", "C"];
    const reviewers = teams.flatMap((t) => [
      { userId: `${t}1`, groupKey: t },
      { userId: `${t}2`, groupKey: t },
    ]);
    const subs = teams.map((t) => ({
      id: `sub${t}`,
      authorId: `${t}1`, // captain
      groupKey: t,
    }));
    const plan = planBalancedReviewerAssignments({
      submissions: subs,
      reviewers,
      perSubmission: 3,
      existing: [],
    });
    // Không reviewer nào chấm bài nhóm mình.
    for (const a of plan) {
      const sub = subs.find((s) => s.id === a.submissionId)!;
      const rev = reviewers.find((r) => r.userId === a.reviewerId)!;
      expect(rev.groupKey).not.toBe(sub.groupKey);
    }
    // 3 bài × 3 = 9 suất; 6 thành viên (cả captain + member đều được phân).
    expect(plan).toHaveLength(9);
    const load = loadOf(plan);
    const counts = reviewers.map((r) => load.get(r.userId) ?? 0);
    // Cân bằng: chênh lệch tải tối đa ≤ 1.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("top-up: tôn trọng existing (tính tải + không phân trùng)", () => {
    const subs = Array.from({ length: 4 }, (_, i) => ({
      id: `s${i}`,
      authorId: `u${i}`,
      groupKey: null,
    }));
    const reviewers = Array.from({ length: 4 }, (_, i) => ({
      userId: `u${i}`,
      groupKey: null,
    }));
    // s0 đã có 1 reviewer (u1); cần bù để mỗi bài đủ 2.
    const existing = [{ submissionId: "s0", reviewerId: "u1" }];
    const plan = planBalancedReviewerAssignments({
      submissions: subs,
      reviewers,
      perSubmission: 2,
      existing,
    });
    // s0 chỉ cần thêm 1 (đã có u1) → không phân lại u1 cho s0.
    const s0Picks = plan.filter((a) => a.submissionId === "s0");
    expect(s0Picks).toHaveLength(1);
    expect(s0Picks[0]!.reviewerId).not.toBe("u1");
    // Tổng cộng (existing + plan) = 4 bài × 2 = 8 suất → plan thêm 7.
    expect(plan).toHaveLength(7);
  });

  it("không đủ người hợp lệ → best effort, không ném lỗi", () => {
    // 2 thành viên cùng 1 nhóm, 1 bài của nhóm đó → không ai hợp lệ.
    const plan = planBalancedReviewerAssignments({
      submissions: [{ id: "s0", authorId: "A1", groupKey: "A" }],
      reviewers: [
        { userId: "A1", groupKey: "A" },
        { userId: "A2", groupKey: "A" },
      ],
      perSubmission: 3,
      existing: [],
    });
    expect(plan).toHaveLength(0);
  });

  it("deterministic: cùng input → cùng output", () => {
    const input: ReviewerPlanInput = {
      submissions: Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        authorId: `u${i}`,
        groupKey: null,
      })),
      reviewers: Array.from({ length: 5 }, (_, i) => ({
        userId: `u${i}`,
        groupKey: null,
      })),
      perSubmission: 2,
      existing: [],
    };
    expect(planBalancedReviewerAssignments(input)).toEqual(
      planBalancedReviewerAssignments(input),
    );
  });
});
