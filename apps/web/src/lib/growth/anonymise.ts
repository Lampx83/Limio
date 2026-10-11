/**
 * Làm ẩn danh id trước khi rời khỏi Limio. HMAC-SHA256 với `GROWTH_ANON_SECRET`:
 * không đảo ngược được nếu không có secret, và ổn định (cùng user ⇒ cùng anonId)
 * để SIM nối được các sự kiện của một người mà không biết người đó là ai.
 */
import { createHmac } from "node:crypto";

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/** 32 ký tự hex đầu của HMAC(secret, userId). */
export function anonIdOf(secret: string, userId: string): string {
  return hmacHex(secret, userId).slice(0, 32);
}

/** 16 ký tự hex đầu của HMAC(secret, orderId) — dùng làm eventId cho order.*. */
export function orderRefOf(secret: string, orderId: string): string {
  return hmacHex(secret, orderId).slice(0, 16);
}
