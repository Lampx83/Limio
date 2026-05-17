/**
 * Redis-backed pub/sub + per-attempt live state cache for the realtime exam
 * dashboard (A5.3 → Tintin scale-out).
 *
 * State backends:
 *   - Stream (channel "exam:{examId}") via realtime/stream.ts — instructor SSE
 *     consumers subscribe with XREAD BLOCK + Last-Event-ID resume.
 *   - Hash "exam:attempt:{attemptId}:state" — live snapshot fields.
 *   - Set  "exam:{examId}:attemptIds"      — index of active attempts per exam.
 *   - Set  "exam:attempt:{attemptId}:answered" — answered question ids.
 *   - String "exam:attempt:{attemptId}:exam"  — reverse pointer attempt→exam.
 *   - String "exam:hb:db:{attemptId}"  EX 30 — heartbeat→DB coalesce token.
 *   - String "exam:hb:fp:{attemptId}"  EX 60 — last device fingerprint.
 *   - String "exam:hb:stream:{attemptId}" EX 15 — throttle stream heartbeat events.
 *
 * Heartbeats update `lastSeenAt` on every call but only publish to Stream at
 * most once per 15s/attempt (avoid Stream flooding with 5K SV × hb 10s). All
 * other state-change events publish unthrottled.
 *
 * Heartbeats are NOT written to `LearningEvent` (would flood the append-only
 * log per §5.1) — DB write of `ExamAttempt.lastHeartbeatAt` is coalesced to
 * ≤ 1 / 30s / attempt via `shouldFlushHeartbeatToDb`.
 */

import { getRedis } from "./redis";
import { publish as streamPublish } from "./realtime/publisher";

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
  userId: string | null;
  userName: string | null;
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

const TTL_SEC = 24 * 60 * 60;
const HB_DB_COALESCE_SEC = 30;
const HB_FP_WINDOW_SEC = 60;
const HB_STREAM_THROTTLE_SEC = 15;

export const examChannel = (examId: string) => `exam:${examId}`;
const kAttemptIds = (examId: string) => `exam:${examId}:attemptIds`;
const kState = (attemptId: string) => `exam:attempt:${attemptId}:state`;
const kAnswered = (attemptId: string) => `exam:attempt:${attemptId}:answered`;
const kAttemptExam = (attemptId: string) => `exam:attempt:${attemptId}:exam`;
const kHbDb = (attemptId: string) => `exam:hb:db:${attemptId}`;
const kHbFp = (attemptId: string) => `exam:hb:fp:${attemptId}`;
const kHbStream = (attemptId: string) => `exam:hb:stream:${attemptId}`;

function serializeState(a: AttemptLive): Record<string, string> {
  return {
    userId: a.userId ?? "",
    userName: a.userName ?? "",
    subjectType: a.subjectType,
    status: a.status,
    startedAt: String(a.startedAt),
    expiresAt: String(a.expiresAt),
    submittedAt: a.submittedAt == null ? "" : String(a.submittedAt),
    totalQuestions: String(a.totalQuestions),
    incidentCount: String(a.incidentCount),
    lastSeenAt: String(a.lastSeenAt),
    resumeCount: String(a.resumeCount),
  };
}

function parseState(
  attemptId: string,
  h: Record<string, string>,
  answered: string[],
): AttemptLive | null {
  if (!h.status) return null;
  return {
    attemptId,
    userId: h.userId ? h.userId : null,
    userName: h.userName ? h.userName : null,
    subjectType: h.subjectType as AttemptLive["subjectType"],
    status: h.status as AttemptLive["status"],
    startedAt: Number(h.startedAt),
    expiresAt: Number(h.expiresAt),
    submittedAt: h.submittedAt ? Number(h.submittedAt) : null,
    answeredQuestionIds: answered,
    totalQuestions: Number(h.totalQuestions),
    incidentCount: Number(h.incidentCount),
    lastSeenAt: Number(h.lastSeenAt),
    resumeCount: Number(h.resumeCount),
  };
}

async function publishToExam(examId: string, event: LiveEvent): Promise<void> {
  // streamPublish → XADD into `rt:exam:{examId}` with MAXLEN ~ 10K.
  await streamPublish(examChannel(examId), event);
}

export async function publish(examId: string, event: LiveEvent): Promise<void> {
  await publishToExam(examId, event);
}

export async function getExamIdForAttempt(
  attemptId: string,
): Promise<string | undefined> {
  const v = await getRedis().get(kAttemptExam(attemptId));
  return v ?? undefined;
}

export async function registerAttempt(
  attemptId: string,
  examId: string,
): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.set(kAttemptExam(attemptId), examId, "EX", TTL_SEC),
    r.sadd(kAttemptIds(examId), attemptId).then(() => r.expire(kAttemptIds(examId), TTL_SEC)),
  ]);
}

/** Seed a single attempt snapshot from DB (called on dashboard initial load). */
export async function seedAttempt(examId: string, a: AttemptLive): Promise<void> {
  const r = getRedis();
  const pipe = r.pipeline();
  pipe.hset(kState(a.attemptId), serializeState(a));
  pipe.expire(kState(a.attemptId), TTL_SEC);
  if (a.answeredQuestionIds.length > 0) {
    pipe.sadd(kAnswered(a.attemptId), ...a.answeredQuestionIds);
    pipe.expire(kAnswered(a.attemptId), TTL_SEC);
  }
  pipe.set(kAttemptExam(a.attemptId), examId, "EX", TTL_SEC);
  pipe.sadd(kAttemptIds(examId), a.attemptId);
  pipe.expire(kAttemptIds(examId), TTL_SEC);
  await pipe.exec();
}

/**
 * Bulk seed — used by SSE dashboard initial load (up to 5K attempts).
 * SKIPS attempts whose state already exists in Redis (so a 2nd instructor
 * opening the dashboard doesn't clobber live state that has been updated
 * by heartbeat/answer/incident events since the first seed).
 */
export async function seedAttemptsBulk(
  examId: string,
  attempts: AttemptLive[],
): Promise<void> {
  if (attempts.length === 0) return;
  const r = getRedis();
  const existing = new Set(await r.smembers(kAttemptIds(examId)));
  const toSeed = attempts.filter((a) => !existing.has(a.attemptId));
  if (toSeed.length === 0) return;
  const pipe = r.pipeline();
  for (const a of toSeed) {
    pipe.hset(kState(a.attemptId), serializeState(a));
    pipe.expire(kState(a.attemptId), TTL_SEC);
    if (a.answeredQuestionIds.length > 0) {
      pipe.sadd(kAnswered(a.attemptId), ...a.answeredQuestionIds);
      pipe.expire(kAnswered(a.attemptId), TTL_SEC);
    }
    pipe.set(kAttemptExam(a.attemptId), examId, "EX", TTL_SEC);
    pipe.sadd(kAttemptIds(examId), a.attemptId);
  }
  pipe.expire(kAttemptIds(examId), TTL_SEC);
  await pipe.exec();
}

export async function upsertOnStart(
  examId: string,
  a: AttemptLive,
): Promise<void> {
  await seedAttempt(examId, a);
  await publishToExam(examId, { type: "attempt.started", attempt: a });
}

export async function getExamSnapshot(examId: string): Promise<AttemptLive[]> {
  const r = getRedis();
  const ids = await r.smembers(kAttemptIds(examId));
  if (ids.length === 0) return [];
  const pipe = r.pipeline();
  for (const id of ids) {
    pipe.hgetall(kState(id));
    pipe.smembers(kAnswered(id));
  }
  const res = await pipe.exec();
  if (!res) return [];
  const out: AttemptLive[] = [];
  for (let i = 0; i < ids.length; i++) {
    const stateRes = res[i * 2];
    const answeredRes = res[i * 2 + 1];
    if (!stateRes || !answeredRes) continue;
    const [, hraw] = stateRes;
    const [, ansraw] = answeredRes;
    const h = (hraw ?? {}) as Record<string, string>;
    const ans = (ansraw ?? []) as string[];
    const id = ids[i];
    if (!id) continue;
    const live = parseState(id, h, ans);
    if (live) out.push(live);
  }
  return out;
}

export async function recordHeartbeat(attemptId: string): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  const r = getRedis();
  // Always refresh lastSeenAt in Redis Hash (cheap, 1 cmd).
  await r.hset(kState(attemptId), "lastSeenAt", String(now));
  // Throttle stream publish to ≤ 1/15s/attempt — dashboard still sees a tick
  // every ~15s for liveness, but Stream isn't flooded with 5K × 10s heartbeats.
  const ok = await r.set(kHbStream(attemptId), "1", "EX", HB_STREAM_THROTTLE_SEC, "NX");
  if (ok === "OK") {
    await publishToExam(examId, { type: "attempt.heartbeat", attemptId, at: now });
  }
}

/**
 * Atomic "claim" pattern — SET NX EX. If the key didn't exist we won the
 * coalesce window and the caller should perform the DB UPDATE. The key
 * auto-expires after 30s, so no separate `markHeartbeatDbWritten` needed.
 */
export async function shouldFlushHeartbeatToDb(
  attemptId: string,
): Promise<boolean> {
  const ok = await getRedis().set(
    kHbDb(attemptId),
    "1",
    "EX",
    HB_DB_COALESCE_SEC,
    "NX",
  );
  return ok === "OK";
}

export async function checkAndUpdateFingerprint(
  attemptId: string,
  ip: string,
  ua: string,
): Promise<{ previousDifferent: { ip: string; ua: string; at: number } } | null> {
  const r = getRedis();
  const key = kHbFp(attemptId);
  const now = Date.now();
  const prevRaw = await r.get(key);
  await r.set(key, JSON.stringify({ ip, ua, at: now }), "EX", HB_FP_WINDOW_SEC);
  if (!prevRaw) return null;
  let prev: { ip: string; ua: string; at: number };
  try {
    prev = JSON.parse(prevRaw);
  } catch {
    return null;
  }
  if (now - prev.at > HB_FP_WINDOW_SEC * 1000) return null;
  if (prev.ip === ip && prev.ua === ua) return null;
  return { previousDifferent: prev };
}

export async function recordAnswered(
  attemptId: string,
  questionId: string,
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  const r = getRedis();
  const pipe = r.pipeline();
  pipe.sadd(kAnswered(attemptId), questionId);
  pipe.expire(kAnswered(attemptId), TTL_SEC);
  pipe.hset(kState(attemptId), "lastSeenAt", String(now));
  await pipe.exec();
  await publishToExam(examId, {
    type: "attempt.answered",
    attemptId,
    questionId,
    at: now,
  });
}

export async function recordIncident(
  attemptId: string,
  incidentType: string,
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  const r = getRedis();
  const count = await r.hincrby(kState(attemptId), "incidentCount", 1);
  await r.hset(kState(attemptId), "lastSeenAt", String(now));
  await publishToExam(examId, {
    type: "attempt.incident",
    attemptId,
    incidentType,
    incidentCount: count,
    at: now,
  });
}

export async function recordStatus(
  attemptId: string,
  status: AttemptLive["status"],
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  const r = getRedis();
  const update: Record<string, string> = { status };
  if (status !== "in_progress") update.submittedAt = String(now);
  await r.hset(kState(attemptId), update);
  await publishToExam(examId, { type: "attempt.status", attemptId, status, at: now });
}

export async function recordClaim(
  attemptId: string,
  resumeCount: number,
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  const r = getRedis();
  await r.hset(kState(attemptId), {
    resumeCount: String(resumeCount),
    lastSeenAt: String(now),
  });
  await publishToExam(examId, {
    type: "attempt.claimed",
    attemptId,
    at: now,
    resumeCount,
  });
}

export async function recordExtended(
  attemptId: string,
  newDurationSec: number,
  newExpiresAt: number,
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  const r = getRedis();
  await r.hset(kState(attemptId), "expiresAt", String(newExpiresAt));
  await publishToExam(examId, {
    type: "attempt.extended",
    attemptId,
    newDurationSec,
    newExpiresAt,
    at: now,
  });
}

export async function recordMessageSent(
  attemptId: string,
  messageId: string,
  body: string,
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  await publishToExam(examId, {
    type: "message.sent",
    attemptId,
    messageId,
    body,
    at: Date.now(),
  });
}

export async function recordHeartbeatLost(
  attemptId: string,
  lostForMs: number,
): Promise<void> {
  const examId = await getExamIdForAttempt(attemptId);
  if (!examId) return;
  const now = Date.now();
  // Snap lastSeenAt backwards so the dashboard renders red immediately.
  await getRedis().hset(
    kState(attemptId),
    "lastSeenAt",
    String(now - lostForMs),
  );
  await publishToExam(examId, {
    type: "attempt.heartbeat_lost",
    attemptId,
    lostForMs,
    at: now,
  });
}

export async function recordMessageBroadcast(
  examId: string,
  messageId: string,
  body: string,
): Promise<void> {
  await publishToExam(examId, {
    type: "message.broadcast",
    examId,
    messageId,
    body,
    at: Date.now(),
  });
}
