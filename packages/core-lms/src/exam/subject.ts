/**
 * A5.8 — Exam attempt subject discriminator.
 *
 * Lives in core-lms (not apps/web) so service functions can stay framework-
 * agnostic. The Next.js side has a thin mirror in `lib/session.ts` that
 * resolves NextAuth session OR exam-session cookie into one of these.
 */

import { ExamError } from "./types";

export type ExamSubject =
  | { kind: "user"; userId: string }
  | {
      kind: "candidate";
      candidateId: string;
      attemptId: string;
      examId: string;
      sessionToken: string;
    };

export type AttemptOwnership = {
  userId: string | null;
  candidateId: string | null;
};

/**
 * Throw `attempt_belongs_to_other` unless the subject owns the given attempt.
 * Candidate ownership requires both candidateId AND attemptId match (the
 * candidate cookie is scoped to a specific attempt).
 */
export function assertSubjectOwnsAttempt(
  subject: ExamSubject,
  attempt: AttemptOwnership & { id: string },
): void {
  if (subject.kind === "user") {
    if (attempt.userId !== subject.userId)
      throw new ExamError("attempt_belongs_to_other");
    return;
  }
  if (
    attempt.candidateId !== subject.candidateId ||
    attempt.id !== subject.attemptId
  ) {
    throw new ExamError("attempt_belongs_to_other");
  }
}

/** Convenience: extract the user/candidate id to pass into emitEvent. */
export function emitArgsForSubject(subject: ExamSubject): {
  userId: string | null;
  candidateId?: string;
} {
  if (subject.kind === "user") return { userId: subject.userId };
  return { userId: null, candidateId: subject.candidateId };
}
