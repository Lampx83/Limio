import { cookies } from "next/headers";
import { auth } from "./auth";
import {
  isAdmin,
  isAnyOrgAdmin,
  isInstructor,
  isOrgAdminOf,
  getUserOrgId,
} from "@feedbackme/core-lms";
import { EXAM_SESSION_COOKIE, verifyExamSession } from "./exam-session";

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireAdmin(): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const ok = await isAdmin(userId);
  return ok ? userId : null;
}

export async function requireInstructor(): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const ok = await isInstructor(userId);
  return ok ? userId : null;
}

// PR2.17 — Multi-tenancy helpers thin wrappers on top of core-lms.

export async function requireOrgAdmin(
  organizationId: string,
): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const ok = await isOrgAdminOf(userId, organizationId);
  return ok ? userId : null;
}

export async function requireAnyOrgAdmin(): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const ok = await isAnyOrgAdmin(userId);
  return ok ? userId : null;
}

export async function currentUserOrgId(): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  return getUserOrgId(userId);
}

/**
 * A5.8 — Discriminated subject for exam-attempt-bound routes.
 *
 *   `user`      — authenticated User (NextAuth session).
 *   `candidate` — anonymous test-taker holding a valid exam_session cookie
 *                 issued by /api/public/exam/claim-code (D4). The cookie is
 *                 scoped to a specific (candidateId, attemptId) pair, so the
 *                 caller must validate the requested attempt matches.
 */
export type ExamSubject =
  | { kind: "user"; userId: string }
  | {
      kind: "candidate";
      candidateId: string;
      attemptId: string;
      examId: string;
      sessionToken: string;
    };

/**
 * Resolve the subject of an exam-attempt request. Order:
 *   1. NextAuth User session (covers logged-in students + instructors).
 *   2. exam_session cookie (anonymous candidate). The cookie's attemptId
 *      MUST match the requested attemptId; otherwise it's rejected.
 *
 * When `requireAttemptId` is provided and the User has no session, this
 * checks the cookie payload against that attempt. Pass `null` to allow
 * a User-session-only lookup (e.g. for routes that don't take an attempt id).
 */
export async function requireExamSubject(
  requireAttemptId: string | null,
  options: { candidateOnly?: boolean } = {},
): Promise<ExamSubject | null> {
  // Try the candidate cookie FIRST when the route is candidate-only. This
  // matches the intent of /exam-take/ pages — instructors should hit
  // /learn/.../ not the public route. Falls through to User session otherwise.
  const token = cookies().get(EXAM_SESSION_COOKIE)?.value;
  const payload = token ? verifyExamSession(token) : null;
  const cookieOk =
    payload &&
    (!requireAttemptId || payload.attemptId === requireAttemptId);

  if (options.candidateOnly) {
    if (!cookieOk) return null;
    return {
      kind: "candidate",
      candidateId: payload.candidateId,
      attemptId: payload.attemptId,
      examId: payload.examId,
      sessionToken: payload.sessionToken,
    };
  }

  const userId = await requireUserId();
  if (userId) return { kind: "user", userId };
  if (!cookieOk) return null;
  return {
    kind: "candidate",
    candidateId: payload.candidateId,
    attemptId: payload.attemptId,
    examId: payload.examId,
    sessionToken: payload.sessionToken,
  };
}
