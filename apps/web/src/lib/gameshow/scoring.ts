export type PowerUpType = "double_points" | "immunity";

// Kahoot/Wayground-style: điểm giảm dần theo thời gian trả lời, sàn 50% điểm
// tối đa cho bất kỳ câu đúng nào trong thời gian cho phép.
const BASE_POINTS = 1000;
const MIN_CORRECT_POINTS = 500;
// Miễn nhiễm: trả lời sai vẫn được nửa điểm sàn, bảo toàn streak.
const IMMUNITY_POINTS = 500;

export function computeScore(params: {
  isCorrect: boolean;
  responseTimeMs: number;
  timeLimitMs: number;
  powerUp?: PowerUpType | null;
}): number {
  const { isCorrect, responseTimeMs, timeLimitMs, powerUp } = params;

  if (!isCorrect) {
    return powerUp === "immunity" ? IMMUNITY_POINTS : 0;
  }

  const clampedMs = Math.min(Math.max(responseTimeMs, 0), timeLimitMs);
  const speedFraction = timeLimitMs > 0 ? 1 - clampedMs / timeLimitMs : 1;
  let points = Math.round(
    MIN_CORRECT_POINTS + speedFraction * (BASE_POINTS - MIN_CORRECT_POINTS),
  );

  if (powerUp === "double_points") points *= 2;

  return points;
}
