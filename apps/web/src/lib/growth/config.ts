/**
 * Cờ + bí mật của growth attribution. Đọc thẳng `process.env` (không qua
 * `getEnv()` zod) để thiếu/sai biến chỉ làm tính năng TẮT, tuyệt đối không làm
 * hỏng boot — xem sự cố 2026-09-28 ghi ở lib/env.ts.
 *
 * Không import gì ngoài kiểu: dùng được cả ở middleware (edge).
 */

export const GROWTH_SECRET_MIN_LENGTH = 32;

type Env = Record<string, string | undefined>;

/** `GROWTH_ATTRIBUTION_ENABLED=true` (không phân biệt hoa thường, bỏ khoảng trắng). */
export function isGrowthAttributionEnabled(env: Env = process.env): boolean {
  return (env.GROWTH_ATTRIBUTION_ENABLED ?? "").trim().toLowerCase() === "true";
}

export interface GrowthSecrets {
  /** HMAC key dùng chung với SIM để ký request. */
  eventsSecret: string;
  /** HMAC key làm ẩn danh id. */
  anonSecret: string;
}

/** null nếu thiếu hoặc ngắn hơn 32 ký tự — endpoint khi đó trả 404. */
export function getGrowthSecrets(env: Env = process.env): GrowthSecrets | null {
  const eventsSecret = env.GROWTH_EVENTS_SECRET ?? "";
  const anonSecret = env.GROWTH_ANON_SECRET ?? "";
  if (eventsSecret.length < GROWTH_SECRET_MIN_LENGTH) return null;
  if (anonSecret.length < GROWTH_SECRET_MIN_LENGTH) return null;
  return { eventsSecret, anonSecret };
}
