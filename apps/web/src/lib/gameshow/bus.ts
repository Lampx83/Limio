/**
 * Redis-backed pub/sub + live roster/score cache cho Gameshow — mô phỏng
 * apps/web/src/lib/exam-live-bus.ts (dashboard giám sát thi) nhưng đơn giản
 * hơn: 1 Hash/participant lưu điểm sống, 1 Set làm roster, publish qua
 * Stream `game:{sessionId}` dùng chung cho cả host lẫn participant.
 *
 * QUAN TRỌNG — không bao giờ publish đáp án đúng trong "question.started"
 * (mọi client cùng nghe 1 channel). Đáp án đúng chỉ lộ ra ở "question.ended".
 */

import { getRedis } from "../redis";
import { publish as streamPublish } from "../realtime/publisher";

export type LiveParticipant = {
  participantId: string;
  displayName: string;
  avatarKey: string;
  totalScore: number;
  streak: number;
};

export type LiveEvent =
  | { type: "snapshot"; participants: LiveParticipant[] }
  | { type: "participant.joined"; participant: LiveParticipant }
  | { type: "participant.avatar_changed"; participantId: string; avatarKey: string }
  | {
      type: "question.started";
      questionIndex: number;
      questionId: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
      timeLimitMs: number;
      startedAt: number;
    }
  | { type: "answer.received"; questionIndex: number; answeredCount: number }
  | {
      type: "question.ended";
      questionIndex: number;
      correctOptionId: string | null;
      leaderboard: LiveParticipant[];
    }
  | { type: "leaderboard.updated"; leaderboard: LiveParticipant[] }
  | { type: "game.ended"; leaderboard: LiveParticipant[] };

const TTL_SEC = 24 * 60 * 60;

export const gameChannel = (sessionId: string) => `game:${sessionId}`;
const kParticipantIds = (sessionId: string) => `game:${sessionId}:participantIds`;
const kParticipant = (sessionId: string, participantId: string) =>
  `game:${sessionId}:participant:${participantId}`;

function serialize(p: LiveParticipant): Record<string, string> {
  return {
    displayName: p.displayName,
    avatarKey: p.avatarKey,
    totalScore: String(p.totalScore),
    streak: String(p.streak),
  };
}

function parse(participantId: string, h: Record<string, string>): LiveParticipant | null {
  if (!h.displayName) return null;
  return {
    participantId,
    displayName: h.displayName,
    avatarKey: h.avatarKey ?? "fox",
    totalScore: Number(h.totalScore ?? 0),
    streak: Number(h.streak ?? 0),
  };
}

async function publishToGame(sessionId: string, event: LiveEvent): Promise<void> {
  await streamPublish(gameChannel(sessionId), event);
}

export async function seedParticipant(
  sessionId: string,
  p: LiveParticipant,
): Promise<void> {
  const r = getRedis();
  const pipe = r.pipeline();
  pipe.hset(kParticipant(sessionId, p.participantId), serialize(p));
  pipe.expire(kParticipant(sessionId, p.participantId), TTL_SEC);
  pipe.sadd(kParticipantIds(sessionId), p.participantId);
  pipe.expire(kParticipantIds(sessionId), TTL_SEC);
  await pipe.exec();
  await publishToGame(sessionId, { type: "participant.joined", participant: p });
}

export async function updateAvatar(
  sessionId: string,
  participantId: string,
  avatarKey: string,
): Promise<void> {
  await getRedis().hset(kParticipant(sessionId, participantId), "avatarKey", avatarKey);
  await publishToGame(sessionId, {
    type: "participant.avatar_changed",
    participantId,
    avatarKey,
  });
}

export async function getSessionSnapshot(sessionId: string): Promise<LiveParticipant[]> {
  const r = getRedis();
  const ids = await r.smembers(kParticipantIds(sessionId));
  if (ids.length === 0) return [];
  const pipe = r.pipeline();
  for (const id of ids) pipe.hgetall(kParticipant(sessionId, id));
  const res = await pipe.exec();
  if (!res) return [];
  const out: LiveParticipant[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const row = res[i];
    if (!id || !row) continue;
    const [, hraw] = row;
    const h = (hraw ?? {}) as Record<string, string>;
    const p = parse(id, h);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.totalScore - a.totalScore);
}

export async function publishQuestionStarted(
  sessionId: string,
  payload: Extract<LiveEvent, { type: "question.started" }>,
): Promise<void> {
  await publishToGame(sessionId, payload);
}

export async function publishAnswerReceived(
  sessionId: string,
  questionIndex: number,
  answeredCount: number,
): Promise<void> {
  await publishToGame(sessionId, { type: "answer.received", questionIndex, answeredCount });
}

/** Cộng điểm + streak vào Hash sống, publish leaderboard mới nhất. */
export async function applyScore(
  sessionId: string,
  participantId: string,
  pointsAwarded: number,
  isCorrect: boolean,
): Promise<void> {
  const r = getRedis();
  const key = kParticipant(sessionId, participantId);
  const pipe = r.pipeline();
  pipe.hincrby(key, "totalScore", pointsAwarded);
  if (isCorrect) pipe.hincrby(key, "streak", 1);
  else pipe.hset(key, "streak", "0");
  await pipe.exec();

  const leaderboard = await getSessionSnapshot(sessionId);
  await publishToGame(sessionId, { type: "leaderboard.updated", leaderboard });
}

export async function publishQuestionEnded(
  sessionId: string,
  questionIndex: number,
  correctOptionId: string | null,
): Promise<void> {
  const leaderboard = await getSessionSnapshot(sessionId);
  await publishToGame(sessionId, {
    type: "question.ended",
    questionIndex,
    correctOptionId,
    leaderboard,
  });
}

export async function publishGameEnded(sessionId: string): Promise<void> {
  const leaderboard = await getSessionSnapshot(sessionId);
  await publishToGame(sessionId, { type: "game.ended", leaderboard });
}
