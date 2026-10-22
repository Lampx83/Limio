import { describe, expect, it } from "vitest";
import { MOODS, STEPS_PER_PATTERN } from "./sound";

describe("MOODS (nhạc gameshow)", () => {
  for (const [name, spec] of Object.entries(MOODS)) {
    it(`${name}: bass và lead đủ ${STEPS_PER_PATTERN} bước, trống đủ 16 ký tự hoặc trống hẳn`, () => {
      expect(spec.bass).toHaveLength(STEPS_PER_PATTERN);
      expect(spec.lead).toHaveLength(STEPS_PER_PATTERN);
      for (const d of [spec.kick, spec.hat, spec.snare]) {
        expect(d.length === 0 || d.length === 16).toBe(true);
      }
    });
  }

  it("những giây cuối nhanh hơn lúc đang trả lời", () => {
    expect(MOODS.urgent.bpm).toBeGreaterThan(MOODS.question.bpm);
  });
});
