import { describe, expect, it } from "vitest";
import { computeStatsForQuestion } from "../analytics";

/**
 * Pure-function tests for the CTT computation kernel.
 * The DB-touching wrappers (computeExamAnalytics, listExamItemAnalytics) are
 * covered by integration tests against the test DB schema.
 */

function sample(correct: boolean, totalScore: number, optionId = "a") {
  return {
    correct,
    totalScore,
    type: "mcq",
    config: {
      options: [
        { id: "a", isCorrect: true },
        { id: "b", isCorrect: false },
        { id: "c", isCorrect: false },
      ],
    },
    answerJson: { selectedOptionId: optionId },
  };
}

describe("computeStatsForQuestion", () => {
  it("returns sentinels when n < 5", () => {
    const out = computeStatsForQuestion([
      sample(true, 10),
      sample(false, 5),
      sample(true, 8),
      sample(false, 6),
    ]);
    expect(out.attemptCount).toBe(4);
    expect(out.correctCount).toBe(2);
    expect(out.pValue).toBe(-1);
    expect(out.discrimination).toBe(-2);
  });

  it("computes p-value once n ≥ 5", () => {
    const samples = [
      sample(true, 10),
      sample(true, 9),
      sample(true, 8),
      sample(false, 7),
      sample(false, 6),
    ];
    const out = computeStatsForQuestion(samples);
    expect(out.attemptCount).toBe(5);
    expect(out.correctCount).toBe(3);
    expect(out.pValue).toBeCloseTo(0.6, 5);
  });

  it("D > 0 when correct answers come from higher-scoring attempts", () => {
    // High-scorers (10,10,9) got it right; low-scorers (3,2) wrong → positive r_pb.
    const samples = [
      sample(true, 10),
      sample(true, 10),
      sample(true, 9),
      sample(false, 3),
      sample(false, 2),
    ];
    const out = computeStatsForQuestion(samples);
    expect(out.discrimination).toBeGreaterThan(0.5);
  });

  it("D < 0 (flag for review) when low-scorers tend to get it right", () => {
    const samples = [
      sample(true, 2),
      sample(true, 3),
      sample(true, 4),
      sample(false, 9),
      sample(false, 10),
    ];
    const out = computeStatsForQuestion(samples);
    expect(out.discrimination).toBeLessThan(0);
  });

  it("D sentinel when all correct or all incorrect (no variance in item)", () => {
    const allCorrect = computeStatsForQuestion([
      sample(true, 8),
      sample(true, 7),
      sample(true, 6),
      sample(true, 5),
      sample(true, 4),
    ]);
    expect(allCorrect.pValue).toBe(1);
    expect(allCorrect.discrimination).toBe(-2);

    const allWrong = computeStatsForQuestion([
      sample(false, 8),
      sample(false, 7),
      sample(false, 6),
      sample(false, 5),
      sample(false, 4),
    ]);
    expect(allWrong.pValue).toBe(0);
    expect(allWrong.discrimination).toBe(-2);
  });

  it("distractorStats counts selections per option (MCQ)", () => {
    const samples = [
      sample(true, 10, "a"),
      sample(false, 5, "b"),
      sample(false, 5, "b"),
      sample(false, 4, "c"),
      sample(true, 9, "a"),
    ];
    const out = computeStatsForQuestion(samples);
    const ds = out.distractorStats as Record<
      string,
      { chosenBy: number; isCorrect: boolean }
    >;
    expect(ds.a).toEqual({ chosenBy: 2, isCorrect: true });
    expect(ds.b).toEqual({ chosenBy: 2, isCorrect: false });
    expect(ds.c).toEqual({ chosenBy: 1, isCorrect: false });
  });

  it("distractorStats is null for non-MCQ types", () => {
    const out = computeStatsForQuestion([
      { correct: true, totalScore: 8, type: "essay", config: {}, answerJson: { text: "x" } },
      { correct: false, totalScore: 6, type: "essay", config: {}, answerJson: { text: "y" } },
      { correct: true, totalScore: 7, type: "essay", config: {}, answerJson: { text: "z" } },
      { correct: false, totalScore: 5, type: "essay", config: {}, answerJson: { text: "q" } },
      { correct: true, totalScore: 9, type: "essay", config: {}, answerJson: { text: "r" } },
    ]);
    expect(out.distractorStats).toBeNull();
  });
});
