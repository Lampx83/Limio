import { describe, expect, it } from "vitest";
import { BKT, updateMasteryBkt } from "../bkt";

describe("BKT — pure math", () => {
  it("AC-B1.6: defaults match spec §4.1", () => {
    expect(BKT.P_L0).toBe(0.1);
    expect(BKT.P_T).toBe(0.1);
    expect(BKT.P_S).toBe(0.1);
    expect(BKT.P_G).toBe(0.2);
  });

  it("AC-B1.3: correct answer increases mastery", () => {
    const r = updateMasteryBkt(0.5, true);
    expect(r.newMastery).toBeGreaterThan(0.5);
    // Posterior: 0.5*0.9 / (0.5*0.9 + 0.5*0.2) = 0.45/0.55 ≈ 0.818
    expect(r.posterior).toBeCloseTo(0.45 / 0.55, 4);
  });

  it("AC-B1.4: incorrect answer decreases mastery", () => {
    const r = updateMasteryBkt(0.5, false);
    expect(r.newMastery).toBeLessThan(0.5);
    // Posterior: 0.5*0.1 / (0.5*0.1 + 0.5*0.8) = 0.05/0.45 ≈ 0.111
    expect(r.posterior).toBeCloseTo(0.05 / 0.45, 4);
  });

  it("starting from prior 0.1 → correct answer → mastery rises", () => {
    const r = updateMasteryBkt(0.1, true);
    // posterior = 0.1*0.9 / (0.1*0.9 + 0.9*0.2) = 0.09 / 0.27 = 0.333
    // newMastery = 0.333 + (1 - 0.333) * 0.1 ≈ 0.4
    expect(r.posterior).toBeCloseTo(0.333, 2);
    expect(r.newMastery).toBeCloseTo(0.4, 1);
  });

  it("transition adds learning even without observation moving the needle much", () => {
    // Already at high mastery, correct answer barely changes posterior but
    // transition still nudges toward 1.
    const r = updateMasteryBkt(0.95, true);
    expect(r.newMastery).toBeGreaterThan(0.95);
    expect(r.newMastery).toBeLessThanOrEqual(1);
  });

  it("clamps to [0, 1]", () => {
    expect(updateMasteryBkt(-0.5, true).newMastery).toBeGreaterThanOrEqual(0);
    expect(updateMasteryBkt(1.5, true).newMastery).toBeLessThanOrEqual(1);
  });

  it("convergence: many correct answers in a row → mastery → ~1", () => {
    let m = 0.1;
    for (let i = 0; i < 30; i++) {
      m = updateMasteryBkt(m, true).newMastery;
    }
    expect(m).toBeGreaterThan(0.99);
  });

  it("many wrong answers in a row → mastery stays low (transition nudge offset by slip evidence)", () => {
    let m = 0.5;
    for (let i = 0; i < 5; i++) {
      m = updateMasteryBkt(m, false).newMastery;
    }
    expect(m).toBeLessThan(0.5);
  });
});
