/**
 * Ký / kiểm chữ ký request cho `GET /api/internal/growth/events`.
 *
 *   signature = lowercase-hex( HMAC-SHA256( key = GROWTH_EVENTS_SECRET,
 *                 message = `${timestamp}\n${METHOD}\n${pathname}\n${rawQuery}` ) )
 *
 * - `timestamp`: unix giây (chuỗi số nguyên), lệch tối đa ±300s so với giờ server.
 * - `METHOD`: chữ hoa (`GET`).
 * - `pathname`: đúng như nhận được, ví dụ `/api/internal/growth/events`.
 * - `rawQuery`: query string THÔ, không có dấu `?` đứng đầu (rỗng nếu không có).
 *
 * Hàm thuần (chỉ phụ thuộc `node:crypto`) để SIM (C#) đối chiếu bằng test vector
 * cố định — xem signature.test.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_TOLERANCE_SEC = 300;

export interface SignInput {
  secret: string;
  timestamp: string | number;
  method: string;
  pathname: string;
  /** Không có `?` đứng đầu. */
  rawQuery: string;
}

export function signMessage(i: Omit<SignInput, "secret">): string {
  return `${i.timestamp}\n${i.method.toUpperCase()}\n${i.pathname}\n${i.rawQuery}`;
}

export function signGrowthRequest(i: SignInput): string {
  return createHmac("sha256", i.secret).update(signMessage(i), "utf8").digest("hex");
}

export type VerifyFailure =
  | "missing_headers"
  | "bad_timestamp"
  | "expired"
  | "bad_signature_format"
  | "signature_mismatch";

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

export interface VerifyInput {
  secret: string;
  timestampHeader: string | null | undefined;
  signatureHeader: string | null | undefined;
  method: string;
  pathname: string;
  rawQuery: string;
  nowSec: number;
  toleranceSec?: number;
}

export function verifyGrowthRequest(i: VerifyInput): VerifyResult {
  const ts = i.timestampHeader?.trim();
  const sig = i.signatureHeader?.trim();
  if (!ts || !sig) return { ok: false, reason: "missing_headers" };
  if (!/^\d{1,12}$/.test(ts)) return { ok: false, reason: "bad_timestamp" };
  const tolerance = i.toleranceSec ?? SIGNATURE_TOLERANCE_SEC;
  if (Math.abs(i.nowSec - Number(ts)) > tolerance) return { ok: false, reason: "expired" };
  // Chỉ nhận hex thường, đúng 64 ký tự — không cố "dễ tính".
  if (!/^[0-9a-f]{64}$/.test(sig)) return { ok: false, reason: "bad_signature_format" };

  const expected = signGrowthRequest({
    secret: i.secret,
    timestamp: ts,
    method: i.method,
    pathname: i.pathname,
    rawQuery: i.rawQuery,
  });
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}
