/**
 * Phiên giám thị — vào bằng mã phòng, không có tài khoản.
 *
 * Cùng khuôn với `exam-session.ts` (cookie thí sinh): HS256 ký bằng
 * NEXTAUTH_SECRET, HttpOnly. Tách file riêng thay vì nhét chung một cookie vì
 * hai vai này không bao giờ trùng nhau, và trộn chung thì một lỗi kiểm tra
 * payload sẽ cho thí sinh mở được màn giám sát.
 */

import crypto from "node:crypto";

export const PROCTOR_SESSION_COOKIE = "proctor_session";

export type ProctorSessionPayload = {
  roomId: string;
  sessionId: string;
  examId: string;
  /** UNIX seconds. */
  exp: number;
};

function getSecret(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("proctor-session: NEXTAUTH_SECRET is required");
  return Buffer.from(s, "utf8");
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signProctorSession(payload: ProctorSessionPayload): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyProctorSession(token: string): ProctorSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  if (!safeEq(sig, expected)) return null;
  let payload: ProctorSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof payload.roomId !== "string" ||
    typeof payload.sessionId !== "string" ||
    typeof payload.examId !== "string" ||
    typeof payload.exp !== "number"
  )
    return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

/** 8 tiếng — dài hơn mọi ca thi, ngắn hơn một ngày làm việc. */
export const PROCTOR_SESSION_TTL_SEC = 8 * 60 * 60;

export function proctorCookieOptions(maxAgeSec: number) {
  return {
    name: PROCTOR_SESSION_COOKIE,
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
