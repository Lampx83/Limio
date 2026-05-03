import { describe, expect, it } from "vitest";
import { gradeAnswer } from "../grading";

function mcq(opts: Array<{ id: string; isCorrect: boolean; misconceptionCode?: string }>) {
  return {
    id: "q1",
    type: "mcq" as const,
    quizId: "x",
    prompt: "p",
    explanation: null,
    points: 1,
    orderIndex: 0,
    extra: null,
    options: opts.map((o, i) => ({
      id: o.id,
      label: o.id,
      isCorrect: o.isCorrect,
      orderIndex: i,
      misconceptionId: o.misconceptionCode ? `m-${o.id}` : null,
      questionId: "q1",
      misconception: o.misconceptionCode ? { code: o.misconceptionCode } : null,
      extra: null,
    })),
  };
}

describe("gradeAnswer", () => {
  it("AC-A4.8 MCQ single-correct: matches exactly", () => {
    const q = mcq([{ id: "a", isCorrect: true }, { id: "b", isCorrect: false }]);
    expect(gradeAnswer(q, ["a"]).isCorrect).toBe(true);
    expect(gradeAnswer(q, ["b"]).isCorrect).toBe(false);
    expect(gradeAnswer(q, []).isCorrect).toBe(false);
  });

  it("MCQ multi-correct: requires exact set", () => {
    const q = mcq([
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: true },
      { id: "c", isCorrect: false },
    ]);
    expect(gradeAnswer(q, ["a", "b"]).isCorrect).toBe(true);
    expect(gradeAnswer(q, ["b", "a"]).isCorrect).toBe(true); // order doesn't matter
    expect(gradeAnswer(q, ["a"]).isCorrect).toBe(false); // partial
    expect(gradeAnswer(q, ["a", "b", "c"]).isCorrect).toBe(false); // extra
  });

  it("AC-A4.7 misconception: returned for wrong option that has one", () => {
    const q = mcq([
      { id: "right", isCorrect: true },
      { id: "wrong", isCorrect: false, misconceptionCode: "confused_x" },
    ]);
    const result = gradeAnswer(q, ["wrong"]);
    expect(result.isCorrect).toBe(false);
    expect(result.misconceptionCode).toBe("confused_x");
  });

  it("misconception not returned when answer is correct", () => {
    const q = mcq([
      { id: "right", isCorrect: true },
      { id: "wrong", isCorrect: false, misconceptionCode: "confused_x" },
    ]);
    expect(gradeAnswer(q, ["right"]).misconceptionCode).toBeUndefined();
  });

  it("AC-A4.9 true_false: matches the single correct option", () => {
    const q = { ...mcq([{ id: "T", isCorrect: true }, { id: "F", isCorrect: false }]), type: "true_false" as const };
    expect(gradeAnswer(q, ["T"]).isCorrect).toBe(true);
    expect(gradeAnswer(q, ["F"]).isCorrect).toBe(false);
  });

  it("AC-A4.10 fill_in: case-insensitive trimmed match against any correct option", () => {
    const q = {
      ...mcq([
        { id: "a", isCorrect: true }, // "a" used as label too via the helper
      ]),
      type: "fill_in" as const,
      options: [
        {
          id: "a",
          label: "Three",
          isCorrect: true,
          orderIndex: 0,
          misconceptionId: null,
          questionId: "q1",
          misconception: null,
          extra: null,
        },
        {
          id: "b",
          label: "3",
          isCorrect: true,
          orderIndex: 1,
          misconceptionId: null,
          questionId: "q1",
          misconception: null,
          extra: null,
        },
      ],
    };
    expect(gradeAnswer(q, "  three  ").isCorrect).toBe(true);
    expect(gradeAnswer(q, "THREE").isCorrect).toBe(true);
    expect(gradeAnswer(q, "3").isCorrect).toBe(true);
    expect(gradeAnswer(q, "four").isCorrect).toBe(false);
    expect(gradeAnswer(q, "").isCorrect).toBe(false);
  });

  it("non-array response for MCQ → not correct", () => {
    const q = mcq([{ id: "a", isCorrect: true }]);
    expect(gradeAnswer(q, "a").isCorrect).toBe(false);
  });

  it("ordering: correct iff user's order matches canonical orderIndex", () => {
    const q = {
      id: "q",
      type: "ordering" as const,
      quizId: "x",
      prompt: "p",
      explanation: null,
      points: 1,
      orderIndex: 0,
      extra: null,
      options: [
        { id: "a", label: "1", isCorrect: false, orderIndex: 0, misconceptionId: null, questionId: "q", misconception: null, extra: null },
        { id: "b", label: "2", isCorrect: false, orderIndex: 1, misconceptionId: null, questionId: "q", misconception: null, extra: null },
        { id: "c", label: "3", isCorrect: false, orderIndex: 2, misconceptionId: null, questionId: "q", misconception: null, extra: null },
      ],
    };
    expect(gradeAnswer(q, ["a", "b", "c"]).isCorrect).toBe(true);
    expect(gradeAnswer(q, ["b", "a", "c"]).isCorrect).toBe(false);
    expect(gradeAnswer(q, ["a", "b"]).isCorrect).toBe(false); // missing one
  });

  it("matching: pairs identified via extra.pairKey + extra.side", () => {
    const make = (id: string, side: "left" | "right", pairKey: string) => ({
      id,
      label: id,
      isCorrect: false,
      orderIndex: 0,
      misconceptionId: null,
      questionId: "q",
      misconception: null,
      extra: { side, pairKey },
    });
    const q = {
      id: "q",
      type: "matching" as const,
      quizId: "x",
      prompt: "p",
      explanation: null,
      points: 1,
      orderIndex: 0,
      extra: null,
      options: [
        make("L1", "left", "p1"),
        make("L2", "left", "p2"),
        make("R1", "right", "p1"),
        make("R2", "right", "p2"),
      ],
    };
    expect(
      gradeAnswer(q, [
        { leftId: "L1", rightId: "R1" },
        { leftId: "L2", rightId: "R2" },
      ]).isCorrect,
    ).toBe(true);
    // Wrong pairing
    expect(
      gradeAnswer(q, [
        { leftId: "L1", rightId: "R2" },
        { leftId: "L2", rightId: "R1" },
      ]).isCorrect,
    ).toBe(false);
    // Missing pair
    expect(
      gradeAnswer(q, [{ leftId: "L1", rightId: "R1" }]).isCorrect,
    ).toBe(false);
  });

  it("numerical: within tolerance is correct", () => {
    const q = {
      id: "q",
      type: "numerical" as const,
      quizId: "x",
      prompt: "p",
      explanation: null,
      points: 1,
      orderIndex: 0,
      extra: { expected: 3.14, tolerance: 0.01 },
      options: [],
    };
    expect(gradeAnswer(q, 3.14).isCorrect).toBe(true);
    expect(gradeAnswer(q, "3.15").isCorrect).toBe(true);
    expect(gradeAnswer(q, 3.16).isCorrect).toBe(false);
    expect(gradeAnswer(q, "abc").isCorrect).toBe(false);
  });

  it("numerical with no tolerance requires exact match", () => {
    const q = {
      id: "q",
      type: "numerical" as const,
      quizId: "x",
      prompt: "p",
      explanation: null,
      points: 1,
      orderIndex: 0,
      extra: { expected: 42 },
      options: [],
    };
    expect(gradeAnswer(q, 42).isCorrect).toBe(true);
    expect(gradeAnswer(q, 42.0001).isCorrect).toBe(false);
  });

  it("short_answer: exact match against options OR regex from extra.acceptedRegexes", () => {
    const q = {
      id: "q",
      type: "short_answer" as const,
      quizId: "x",
      prompt: "p",
      explanation: null,
      points: 1,
      orderIndex: 0,
      extra: { acceptedRegexes: ["^h(e|a)llo$"] },
      options: [
        {
          id: "a",
          label: "Hi",
          isCorrect: true,
          orderIndex: 0,
          misconceptionId: null,
          questionId: "q",
          misconception: null,
          extra: null,
        },
      ],
    };
    expect(gradeAnswer(q, "hi").isCorrect).toBe(true);
    expect(gradeAnswer(q, "Hello").isCorrect).toBe(true); // regex match
    expect(gradeAnswer(q, "hallo").isCorrect).toBe(true);
    expect(gradeAnswer(q, "bye").isCorrect).toBe(false);
  });

  it("essay: returns needsGrading=true, isCorrect=false (manual)", () => {
    const q = {
      id: "q",
      type: "essay" as const,
      quizId: "x",
      prompt: "p",
      explanation: null,
      points: 1,
      orderIndex: 0,
      extra: null,
      options: [],
    };
    const r = gradeAnswer(q, "long answer text...");
    expect(r.needsGrading).toBe(true);
    expect(r.isCorrect).toBe(false);
  });
});
