/**
 * Redis-backed pub/sub + live roster/score cache cho Gameshow — mô phỏng
 * apps/web/src/lib/exam-live-bus.ts (dashboard giám sát thi) nhưng đơn giản
 * hơn: 1 Hash/participant lưu điểm sống, 1 Set làm roster, publish qua
 * Stream `game:{sessionId}` dùng chung cho cả host lẫn participant.
 *
 * QUAN TRỌNG — không bao giờ publish đáp án đúng trong "question.started"
 * (mọi client cùng nghe 1 channel). Đáp án đúng chỉ lộ ra ở "question.ended".
 */

import { prisma } from "@feedbackme/db";
import { getRedis } from "../redis";
import { publish as streamPublish } from "../realtime/publisher";
import type { LiveParticipant, TeamStanding } from "./types";

export type { LiveParticipant, TeamStanding };

export type LiveEvent =
  | { type: "snapshot"; participants: LiveParticipant[] }
  | { type: "participant.joined"; participant: LiveParticipant }
  | { type: "participant.avatar_changed"; participantId: string; avatarKey: string }
  | { type: "participant.kicked"; participantId: string }
  | {
      type: "question.started";
      questionIndex: number;
      questionId: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
      timeLimitMs: number;
      startedAt: number;
    }
  | { type: "answer.received"; questionIndex: number; answeredCount: number; participantId: string }
  | {
      type: "question.ended";
      questionIndex: number;
      correctOptionId: string | null;
      leaderboard: LiveParticipant[];
      teamStandings?: TeamStanding[];
    }
  | { type: "leaderboard.updated"; leaderboard: LiveParticipant[]; teamStandings?: TeamStanding[] }
  | { type: "game.ended"; leaderboard: LiveParticipant[]; teamStandings?: TeamStanding[] };

const TTL_SEC = 24 * 60 * 60;

export const gameChannel = (sessionId: string) => `game:${sessionId}`;
const kParticipantIds = (sessionId: string) => `game:${sessionId}:participantIds`;
const kParticipant = (sessionId: string, participantId: string) =>
  `game:${sessionId}:participant:${participantId}`;

function serialize(p: LiveParticipant): Record<string, string> {
  return {
    displayName: p.displayName,
    avatarKey: p.avatarKey,
    teamId: p.teamId ?? "",
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
    teamId: h.teamId ? h.teamId : null,
    totalScore: Number(h.totalScore ?? 0),
    streak: Number(h.streak ?? 0),
  };
}

/** Gom điểm theo đội — trung bình cộng, sắp giảm dần. [] nếu không có đội nào. */
export async function getTeamStandings(
  sessionId: string,
  participants: LiveParticipant[],
): Promise<TeamStanding[]> {
  const grouped = new Map<string, LiveParticipant[]>();
  for (const p of participants) {
    if (!p.teamId) continue;
    const list = grouped.get(p.teamId) ?? [];
    list.push(p);
    grouped.set(p.teamId, list);
  }
  if (grouped.size === 0) return [];

  const teams = await prisma.gameTeam.findMany({
    where: { sessionId, id: { in: [...grouped.keys()] } },
    select: { id: true, name: true, colorKey: true },
  });

  return teams
    .map((t) => {
      const members = (grouped.get(t.id) ?? []).sort((a, b) => b.totalScore - a.totalScore);
      const totalScore = members.reduce((sum, m) => sum + m.totalScore, 0);
      return {
        teamId: t.id,
        name: t.name,
        colorKey: t.colorKey,
        avgScore: members.length > 0 ? Math.round(totalScore / members.length) : 0,
        memberCount: members.length,
        members,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
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

// Chỉ dùng khi phòng còn ở "lobby" — kick giữa game sẽ để lại GameAnswer mồ
// côi (participant vẫn cần tồn tại để tính điểm những câu đã trả lời).
export async function removeParticipant(sessionId: string, participantId: string): Promise<void> {
  const r = getRedis();
  const pipe = r.pipeline();
  pipe.del(kParticipant(sessionId, participantId));
  pipe.srem(kParticipantIds(sessionId), participantId);
  await pipe.exec();
  await publishToGame(sessionId, { type: "participant.kicked", participantId });
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
  participantId: string,
): Promise<void> {
  await publishToGame(sessionId, {
    type: "answer.received",
    questionIndex,
    answeredCount,
    participantId,
  });
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
  const teamStandings = await getTeamStandings(sessionId, leaderboard);
  await publishToGame(sessionId, {
    type: "leaderboard.updated",
    leaderboard,
    ...(teamStandings.length ? { teamStandings } : {}),
  });
}

export async function publishQuestionEnded(
  sessionId: string,
  questionIndex: number,
  correctOptionId: string | null,
): Promise<void> {
  const leaderboard = await getSessionSnapshot(sessionId);
  const teamStandings = await getTeamStandings(sessionId, leaderboard);
  await publishToGame(sessionId, {
    type: "question.ended",
    questionIndex,
    correctOptionId,
    leaderboard,
    ...(teamStandings.length ? { teamStandings } : {}),
  });
}

export async function publishGameEnded(sessionId: string): Promise<void> {
  const leaderboard = await getSessionSnapshot(sessionId);
  const teamStandings = await getTeamStandings(sessionId, leaderboard);
  await publishToGame(sessionId, {
    type: "game.ended",
    leaderboard,
    ...(teamStandings.length ? { teamStandings } : {}),
  });
}
