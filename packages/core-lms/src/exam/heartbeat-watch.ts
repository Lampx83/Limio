/**
 * A5.3.6 — Heartbeat-lost detector.
 *
 * Scans for in-progress attempts whose lastHeartbeatAt is older than the
 * threshold (default 90s). For each detected attempt, emits exactly one
 * `exam.attempt.heartbeat_lost` event per dedup window (default 5 minutes),
 * so the instructor dashboard doesn't get spammed when the cron tick keeps
 * picking up the same stale row every 2 minutes.
 *
 * Does NOT auto-submit, mark as flagged, or mutate the attempt — only
 * surfaces the signal for instructor review (§spec).
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";

const STALE_THRESHOLD_MS = 90_000;
const DEDUP_TTL_MS = 5 * 60_000;

// Module-scoped — in-memory dedup. attemptId -> last emit timestamp.
const recentlyEmitted = new Map<string, number>();

function shouldEmit(attemptId: string): boolean {
  const last = recentlyEmitted.get(attemptId);
  const now = Date.now();
  if (last && now - last < DEDUP_TTL_MS) return false;
  recentlyEmitted.set(attemptId, now);
  return true;
}

// Clear stale entries from the dedup map periodically so it doesn't grow
// unbounded for long-lived processes.
function vacuumDedup(): void {
  const now = Date.now();
  for (const [id, ts] of recentlyEmitted) {
    if (now - ts > DEDUP_TTL_MS * 2) recentlyEmitted.delete(id);
  }
}

export type HeartbeatLostResult = {
  scanned: number;
  // A5.8 — userId is null when the attempt belongs to an anonymous candidate.
  detected: {
    attemptId: string;
    examId: string;
    userId: string | null;
    lostForMs: number;
  }[];
  suppressed: number;
};

export async function detectHeartbeatLost(
  db: PrismaClient = prisma,
): Promise<HeartbeatLostResult> {
  vacuumDedup();
  const now = Date.now();
  const threshold = new Date(now - STALE_THRESHOLD_MS);

  // Index `(status, lastHeartbeatAt)` makes this cheap. Cap to 500 to bound
  // worst-case cost per tick.
  const rows = await db.examAttempt.findMany({
    where: {
      status: "in_progress",
      lastHeartbeatAt: { lt: threshold },
    },
    select: {
      id: true,
      examId: true,
      userId: true,
      candidateId: true,
      lastHeartbeatAt: true,
      exam: { select: { courseId: true } },
    },
    take: 500,
  });

  const detected: HeartbeatLostResult["detected"] = [];
  let suppressed = 0;
  for (const r of rows) {
    if (!shouldEmit(r.id)) {
      suppressed++;
      continue;
    }
    const lostForMs = r.lastHeartbeatAt
      ? now - r.lastHeartbeatAt.getTime()
      : STALE_THRESHOLD_MS;
    await emitEvent(
      r.userId,
      LearningEventType.ExamAttemptHeartbeatLost,
      {
        examId: r.examId,
        attemptId: r.id,
        learnerUserId: r.userId,
        candidateId: r.candidateId,
        lostForMs,
        lastHeartbeatAt: r.lastHeartbeatAt?.toISOString() ?? null,
      },
      {
        courseId: r.exam.courseId,
        candidateId: r.candidateId ?? undefined,
        // One key per dedup window so re-runs within the window are silently
        // deduped at the LearningEvent level too.
        eventKey: `exam.attempt.heartbeat_lost:${r.id}:${Math.floor(now / DEDUP_TTL_MS)}`,
      },
      db,
    );
    detected.push({
      attemptId: r.id,
      examId: r.examId,
      userId: r.userId,
      lostForMs,
    });
  }

  return { scanned: rows.length, detected, suppressed };
}

/** Visible for tests — clears the in-memory dedup state. */
export function __resetHeartbeatLostDedup(): void {
  recentlyEmitted.clear();
}
