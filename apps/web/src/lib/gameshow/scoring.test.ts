import { describe, expect, it } from "vitest";
import { computeScore } from "./scoring";

describe("computeScore", () => {
  it("trả lời sai không có power-up → 0 điểm", () => {
    expect(computeScore({ isCorrect: false, responseTimeMs: 1000, timeLimitMs: 10_000 })).toBe(0);
  });

  it("trả lời sai nhưng có immunity → 500 điểm sàn", () => {
    expect(
      computeScore({
        isCorrect: false,
        responseTimeMs: 1000,
        timeLimitMs: 10_000,
        powerUp: "immunity",
      }),
    ).toBe(500);
  });

  it("trả lời đúng ngay lập tức (responseTimeMs=0) → điểm tối đa 1000", () => {
    expect(computeScore({ isCorrect: true, responseTimeMs: 0, timeLimitMs: 10_000 })).toBe(1000);
  });

  it("trả lời đúng đúng lúc hết giờ → điểm sàn 500", () => {
    expect(computeScore({ isCorrect: true, responseTimeMs: 10_000, timeLimitMs: 10_000 })).toBe(
      500,
    );
  });

  it("trả lời đúng giữa chừng → điểm nằm giữa 500-1000", () => {
    const points = computeScore({
      isCorrect: true,
      responseTimeMs: 5_000,
      timeLimitMs: 10_000,
    });
    expect(points).toBe(750);
  });

  it("double_points nhân đôi điểm câu đúng", () => {
    const points = computeScore({
      isCorrect: true,
      responseTimeMs: 0,
      timeLimitMs: 10_000,
      powerUp: "double_points",
    });
    expect(points).toBe(2000);
  });

  it("responseTimeMs vượt quá timeLimitMs vẫn clamp về điểm sàn (không âm)", () => {
    expect(computeScore({ isCorrect: true, responseTimeMs: 99_999, timeLimitMs: 10_000 })).toBe(
      500,
    );
  });
});
