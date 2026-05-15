/**
 * In-memory pub/sub + per-attempt live state cache for the realtime exam
 * dashboard prototype (A5.3). Single-process only — production stack runs one
 * Node container on server 224, so this is fine for the prototype. When we
 * scale out we swap the bus for Redis pub/sub without touching call sites.
 *
 * Heartbeats are NOT persisted to `LearningEvent` (would flood the append-only
 * log per §5.1). They live here only.
 */

export type LiveEvent =
  | { type: "snapshot"; attempts: AttemptLive[] }
  | { type: "attempt.started"; attempt: AttemptLive }
  | { type: "attempt.heartbeat"; attemptId: string; at: number }
  | {
      type: "attempt.answered";
      attemptId: string;
      questionId: string;
      at: number;
    }
  | {
      type: "attempt.incident";
      attemptId: string;
      incidentType: string;
      incidentCount: number;
      at: number;
    }
  | {
      type: "attempt.status";
      attemptId: string;
      status: AttemptLive["status"];
      at: number;
    }
  | { type: "attempt.claimed"; attemptId: string; at: number; resumeCount: number }
  | {
      type: "attempt.extended";
      attemptId: string;
      newDurationSec: number;
      newExpiresAt: number;
      at: number;
    }
  | {
      type: "message.sent";
      attemptId: string;
      messageId: string;
      body: string;
      at: number;
    }
  | {
      type: "message.broadcast";
      examId: string;
      messageId: string;
      body: string;
      at: number;
    }
  | {
      type: "attempt.heartbeat_lost";
      attemptId: string;
      lostForMs: number;
      at: number;
    };

export type AttemptLive = {
  attemptId: string;
  // A5.8 — null for candidate attempts (open_code / assigned_code mode).
  userId: string | null;
  userName: string | null;
  // A5.8.D5 — Distinguishes the entry path for the dashboard's Type filter.
  //   user     — authenticated User session
  //   open     — open_code candidate (anyone with shared mã)
  //   assigned — assigned_code candidate (pre-listed by instructor)
  subjectType: "user" | "open" | "assigned";
  status: "in_progress" | "submitted" | "auto_submitted" | "graded" | "flagged";
  startedAt: number;
  expiresAt: number;
  submittedAt: number | null;
  answeredQuestionIds: string[];
  totalQuestions: number;
  incidentCount: number;
  lastSeenAt: number;
  resumeCount: number;
};

type Subscriber = (e: LiveEvent) => void;

// examId -> Set<Subscriber>
const subscribers = new Map<string, Set<Subscriber>>();
// attemptId -> live snapshot
const attemptState = new Map<string, AttemptLive>();
// attemptId -> examId (reverse index for fast publish from attempt routes)
const attemptToExam = new Map<string, string>();
// attemptId -> last time we wrote lastHeartbeatAt to DB. Used to coalesce
// heartbeat writes (≤ 1 UPDATE / 30s / attempt) while bus pubs sub-second.
const lastDbWriteAt = new Map<string, number>();

// attemptId -> last device fingerprint seen. Used by A5.8.D4 cookie-share
// detector: if a fresh heartbeat arrives with a different (ip, ua) within
// COOKIE_SHARE_WINDOW_MS, the cookie is in use on 2 devices simultaneously.
const lastDeviceFingerprint = new Map<
  string,
  { ip: string; ua: string; at: number }
>();

const HEARTBEAT_DB_COALESCE_MS = 30_000;
const COOKIE_SHARE_WINDOW_MS = 60_000;

/**
 * Record the device fingerprint of the most recent heartbeat for an attempt.
 * Returns the *previous* fingerprint if it differs and was within the window
 * — caller emits an incident in that case.
 */
export function checkAndUpdateFingerprint(
  attemptId: string,
  ip: string,
  ua: string,
): { previousDifferent: { ip: string; ua: string; at: number } } | null {
  const now = Date.now();
  const prev = lastDeviceFingerprint.get(attemptId);
  lastDeviceFingerprint.set(attemptId, { ip, ua, at: now });
  if (!prev) return null;
  if (now - prev.at > COOKIE_SHARE_WINDOW_MS) return null;
  if (prev.ip === ip && prev.ua === ua) return null;
  return { previousDifferent: prev };
}

export function publish(examId: string, event: LiveEvent): void {
  const subs = subscribers.get(examId);
  if (!subs || subs.size === 0) return;
  for (const fn of subs) {
    try {
      fn(event);
    } catch {
      // a misbehaving subscriber must not break the rest
    }
  }
}

export function subscribe(examId: string, fn: Subscriber): () => void {
  let set = subscribers.get(examId);
  if (!set) {
    set = new Set();
    subscribers.set(examId, set);
  }
  set.add(fn);
  return () => {
    const s = subscribers.get(examId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subscribers.delete(examId);
  };
}

export function getExamSnapshot(examId: string): AttemptLive[] {
  const out: AttemptLive[] = [];
  for (const [attemptId, eid] of attemptToExam) {
    if (eid !== examId) continue;
    const s = attemptState.get(attemptId);
    if (s) out.push(s);
  }
  return out;
}

/** Seed the cache from DB rows when the dashboard first loads. */
export function seedAttempt(examId: string, a: AttemptLive): void {
  attemptState.set(a.attemptId, a);
  attemptToExam.set(a.attemptId, examId);
}

export function upsertOnStart(examId: string, a: AttemptLive): void {
  attemptState.set(a.attemptId, a);
  attemptToExam.set(a.attemptId, examId);
  publish(examId, { type: "attempt.started", attempt: a });
}

export function recordHeartbeat(attemptId: string): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const s = attemptState.get(attemptId);
  const now = Date.now();
  if (s) {
    s.lastSeenAt = now;
  }
  publish(examId, { type: "attempt.heartbeat", attemptId, at: now });
}

/**
 * Return true if we should flush lastHeartbeatAt to DB now. Coalesces writes so
 * that 500 students × heartbeat 10s ≈ 50 req/s does not create 50 row updates/s
 * on the same hot row. Caller is responsible for calling markDbWritten on success.
 */
export function shouldFlushHeartbeatToDb(attemptId: string): boolean {
  const last = lastDbWriteAt.get(attemptId) ?? 0;
  return Date.now() - last >= HEARTBEAT_DB_COALESCE_MS;
}

export function markHeartbeatDbWritten(attemptId: string): void {
  lastDbWriteAt.set(attemptId, Date.now());
}

export function recordAnswered(attemptId: string, questionId: string): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const now = Date.now();
  const s = attemptState.get(attemptId);
  if (s) {
    if (!s.answeredQuestionIds.includes(questionId)) {
      s.answeredQuestionIds = [...s.answeredQuestionIds, questionId];
    }
    s.lastSeenAt = now;
  }
  publish(examId, {
    type: "attempt.answered",
    attemptId,
    questionId,
    at: now,
  });
}

export function recordIncident(attemptId: string, incidentType: string): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const now = Date.now();
  const s = attemptState.get(attemptId);
  const count = (s?.incidentCount ?? 0) + 1;
  if (s) {
    s.incidentCount = count;
    s.lastSeenAt = now;
  }
  publish(examId, {
    type: "attempt.incident",
    attemptId,
    incidentType,
    incidentCount: count,
    at: now,
  });
}

export function recordStatus(
  attemptId: string,
  status: AttemptLive["status"],
): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const now = Date.now();
  const s = attemptState.get(attemptId);
  if (s) {
    s.status = status;
    if (status !== "in_progress") s.submittedAt = now;
  }
  publish(examId, { type: "attempt.status", attemptId, status, at: now });
}

export function recordClaim(attemptId: string, resumeCount: number): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const now = Date.now();
  const s = attemptState.get(attemptId);
  if (s) {
    s.resumeCount = resumeCount;
    s.lastSeenAt = now;
  }
  publish(examId, { type: "attempt.claimed", attemptId, at: now, resumeCount });
}

export function recordExtended(
  attemptId: string,
  newDurationSec: number,
  newExpiresAt: number,
): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const now = Date.now();
  const s = attemptState.get(attemptId);
  if (s) {
    s.expiresAt = newExpiresAt;
  }
  publish(examId, {
    type: "attempt.extended",
    attemptId,
    newDurationSec,
    newExpiresAt,
    at: now,
  });
}

export function recordMessageSent(
  attemptId: string,
  messageId: string,
  body: string,
): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  publish(examId, {
    type: "message.sent",
    attemptId,
    messageId,
    body,
    at: Date.now(),
  });
}

export function recordHeartbeatLost(
  attemptId: string,
  lostForMs: number,
): void {
  const examId = attemptToExam.get(attemptId);
  if (!examId) return;
  const now = Date.now();
  const s = attemptState.get(attemptId);
  if (s) {
    // Snap `lastSeenAt` backwards so the dashboard renders red immediately
    // without waiting for its own clock tick to cross the 60s threshold.
    s.lastSeenAt = now - lostForMs;
  }
  publish(examId, {
    type: "attempt.heartbeat_lost",
    attemptId,
    lostForMs,
    at: now,
  });
}

export function recordMessageBroadcast(
  examId: string,
  messageId: string,
  body: string,
): void {
  publish(examId, {
    type: "message.broadcast",
    examId,
    messageId,
    body,
    at: Date.now(),
  });
}

/** Resolve examId from attemptId without a DB roundtrip when possible. */
export function getExamIdForAttempt(attemptId: string): string | undefined {
  return attemptToExam.get(attemptId);
}

export function registerAttempt(attemptId: string, examId: string): void {
  attemptToExam.set(attemptId, examId);
}
