/**
 * A5.8 — Candidate session for code-based exam access.
 *
 * Anonymous candidates don't have a User row, so NextAuth doesn't apply.
 * After a successful `/api/public/exam/claim-code` (D4) the server issues a
 * compact JWT cookie that proves: "this browser owns attempt X under candidate
 * Y of exam Z, until exp". Cookie is HttpOnly + signed with NEXTAUTH_SECRET.
 *
 * Hand-rolled HS256 because we already require NEXTAUTH_SECRET; pulling in a
 * full jose/jsonwebtoken dep for one token shape is overkill at this stage.
 */

import crypto from "node:crypto";

export const EXAM_SESSION_COOKIE = "exam_session";

export type ExamSessionPayload = {
  candidateId: string;
  attemptId: string;
  examId: string;
  /** UNIX seconds. Cookie is rejected once now >= exp. */
  exp: number;
  /** Rotated whenever session is claimed from a new tab (mirrors User flow). */
  sessionToken: string;
};

function getSecret(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s)
    throw new Error("exam-session: NEXTAUTH_SECRET is required");
  // Match NextAuth's encoding choice; for HMAC any bytes are fine.
  return Buffer.from(s, "utf8");
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Sign an exam-session payload as a compact JWT (HS256). */
export function signExamSession(payload: ExamSessionPayload): string {
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** Verify + decode an exam-session JWT. Returns null on any failure. */
export function verifyExamSession(token: string): ExamSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  if (!safeEq(sig, expected)) return null;
  let payload: ExamSessionPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ExamSessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.candidateId !== "string" ||
    typeof payload.attemptId !== "string" ||
    typeof payload.examId !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.sessionToken !== "string"
  ) {
    return null;
  }
  if (payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

/** Cookie options for issuing the session. */
export function examSessionCookieOptions(maxAgeSec: number): {
  name: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    name: EXAM_SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  };
}
