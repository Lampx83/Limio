/**
 * A7.7.4 — Pattern detection on exam attempts.
 *
 * Two patterns surface as derived badges (not stored — no schema migration):
 *
 *   - **Speed run**: submitted in less than `MIN_SECONDS_PER_QUESTION`s per
 *     question on the attempt. Matches CLAUDE.md §5 anti-farming guard
 *     ("reject speed run < 10s pass quiz"), generalized to attempts of any
 *     size. Pure function on (startedAt, submittedAt, questionCount).
 *
 *   - **Paste flood**: ≥ `PASTE_FLOOD_THRESHOLD` paste incidents within any
 *     60-second rolling window. Pure function on the incident list.
 *
 * `evaluateAttemptPatterns` is a query — single attempt row + paste-only
 * incident scan. Safe to call from live-monitor SSR per attempt. Patterns
 * never auto-disqualify or mutate `attempt.status`; the `flagged` status is
 * reserved for explicit instructor action (A7.7.3 "flag only, no auto-DQ").
 */

import { prisma, type ExamIncidentType, type PrismaClient } from "@feedbackme/db";

/** Minimum seconds a candidate plausibly spends per question. */
export const MIN_SECONDS_PER_QUESTION = 10;
/** Paste events within the window required to trip the flag. */
export const PASTE_FLOOD_THRESHOLD = 3;
/** Rolling window (ms) for paste-flood detection. */
export const PASTE_FLOOD_WINDOW_MS = 60_000;

export type PatternFlag = "speed_run" | "paste_flood";

/**
 * Pure check: did the candidate submit faster than humanly plausible?
 *
 * @param startedAt   when the attempt was opened
 * @param finishedAt  submit / auto-submit time
 * @param questions   total questions on the attempt
 */
export function checkSpeedRun(
  startedAt: Date,
  finishedAt: Date,
  questions: number,
): boolean {
  if (questions <= 0) return false;
  const elapsedSec = (finishedAt.getTime() - startedAt.getTime()) / 1000;
  return elapsedSec < MIN_SECONDS_PER_QUESTION * questions;
}

/**
 * Pure check: ≥ THRESHOLD paste incidents inside any 60-second window?
 * Sliding window via two pointers — O(n) on the incident list.
 *
 * @param pasteTimestamps  occurredAt of incidents where type === "paste"
 */
export function checkPasteFlood(pasteTimestamps: Date[]): boolean {
  if (pasteTimestamps.length < PASTE_FLOOD_THRESHOLD) return false;
  const sorted = [...pasteTimestamps]
    .map((d) => d.getTime())
    .sort((a, b) => a - b);
  let left = 0;
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right]! - sorted[left]! > PASTE_FLOOD_WINDOW_MS) left++;
    if (right - left + 1 >= PASTE_FLOOD_THRESHOLD) return true;
  }
  return false;
}

/**
 * Evaluate both patterns against an attempt. Pure query — does NOT mutate
 * attempt.status. The `flagged` status is reserved for explicit instructor
 * action; patterns surface as derived badges that the live-monitor and
 * grading review render on top of existing status.
 *
 * Called from:
 *   - Live monitor drill-down (render badges next to incident timeline)
 *   - Per-attempt review panel
 *   - Post-submit hook for telemetry / audit if needed
 *
 * Returns the flags that tripped. Empty array means "clean".
 */
export async function evaluateAttemptPatterns(
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ flags: PatternFlag[] }> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      startedAt: true,
      submittedAt: true,
      examId: true,
      exam: { select: { _count: { select: { questions: true } } } },
    },
  });
  if (!attempt) return { flags: [] };

  const flags: PatternFlag[] = [];

  // Speed run: only meaningful once we have a submit timestamp.
  if (attempt.submittedAt && attempt.startedAt) {
    if (
      checkSpeedRun(
        attempt.startedAt,
        attempt.submittedAt,
        attempt.exam._count.questions,
      )
    ) {
      flags.push("speed_run");
    }
  }

  // Paste flood: count paste incidents inside any 60s window.
  const pasteIncidents = await db.examIncident.findMany({
    where: { attemptId, type: "paste" satisfies ExamIncidentType },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true },
  });
  if (checkPasteFlood(pasteIncidents.map((p) => p.occurredAt))) {
    flags.push("paste_flood");
  }

  return { flags };
}
