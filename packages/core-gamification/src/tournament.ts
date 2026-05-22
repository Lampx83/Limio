import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { awardXp } from "./xp";
import { checkMissionCondition } from "./missionCondition";

/**
 * Tournament runtime — Phase 3.
 * - registerForTournament: idempotent learner self-registration
 * - completeMission: marks a mission completed for a user, increments points,
 *   triggers prereq unlock check, recomputes ranking
 * - recomputeRanking: rebuilds TournamentRanking rows for a tournament
 * - distributePrizes: when ended → award XP per prizeDistribution percentages
 */

export class TournamentError extends Error {
  constructor(
    public readonly code:
      | "tournament_not_found"
      | "not_published"
      | "ended"
      | "already_registered"
      | "not_registered"
      | "mission_not_found"
      | "prereq_not_completed"
      | "condition_not_met"
      | "validation_failed"
      | "team_not_found"
      | "team_full"
      | "team_solo_only"
      | "team_join_code_invalid"
      | "team_name_taken"
      | "team_not_captain"
      | "team_locked_after_start",
    /** Optional progress detail returned to the caller for UI display. */
    public readonly detail?: { current: number; required: number },
  ) {
    super(code);
  }
}

export async function registerForTournament(
  userId: string,
  tournamentId: string,
  db: PrismaClient = prisma,
) {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("tournament_not_found");
  if (t.status === "draft") throw new TournamentError("not_published");
  if (t.status === "ended") throw new TournamentError("ended");
  // Solo path only valid for solo tournaments — team-based must go through
  // createTeam/joinTeamByCode so registration is tied to a TournamentTeam.
  if (t.teamSize > 1) throw new TournamentError("team_solo_only");

  const existing = await db.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  if (existing) throw new TournamentError("already_registered");

  await db.tournamentRegistration.create({
    data: { tournamentId, userId },
  });
  await db.learningEvent.create({
    data: {
      userId,
      eventType: LearningEventType.TournamentRegistered,
      payload: { tournamentId } as Prisma.InputJsonValue,
      courseId: t.courseId ?? null,
    },
  });
}

// ─── Team registration ───────────────────────────────────────────────────

/**
 * Generate a 6-char alphanumeric code (uppercase, no ambiguous chars).
 * Collision-safe via retry inside createTeam.
 */
function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

function assertTournamentJoinable(t: { status: string; teamSize: number }) {
  if (t.status === "draft") throw new TournamentError("not_published");
  if (t.status === "ended") throw new TournamentError("ended");
  // Lock team changes once tournament goes live (status === "active").
  if (t.status === "active") throw new TournamentError("team_locked_after_start");
}

export async function createTeam(
  userId: string,
  tournamentId: string,
  name: string,
  db: PrismaClient = prisma,
): Promise<{ teamId: string; joinCode: string }> {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("tournament_not_found");
  if (t.teamSize <= 1) throw new TournamentError("team_solo_only");
  assertTournamentJoinable(t);

  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    throw new TournamentError("validation_failed");
  }

  const existingReg = await db.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  if (existingReg) throw new TournamentError("already_registered");

  const nameTaken = await db.tournamentTeam.findUnique({
    where: { tournamentId_name: { tournamentId, name: trimmed } },
  });
  if (nameTaken) throw new TournamentError("team_name_taken");

  // Retry on rare joinCode collision (unique index).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeJoinCode();
    try {
      const team = await db.$transaction(async (tx) => {
        const created = await tx.tournamentTeam.create({
          data: {
            tournamentId,
            name: trimmed,
            captainId: userId,
            joinCode: code,
          },
        });
        await tx.tournamentRegistration.create({
          data: { tournamentId, userId, teamId: created.id },
        });
        await tx.learningEvent.create({
          data: {
            userId,
            eventType: LearningEventType.TournamentRegistered,
            payload: { tournamentId, teamId: created.id, role: "captain" } as Prisma.InputJsonValue,
            courseId: t.courseId ?? null,
          },
        });
        return created;
      });
      return { teamId: team.id, joinCode: team.joinCode };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2002") continue; // joinCode dup, retry
      throw e;
    }
  }
  throw new TournamentError("validation_failed");
}

export async function joinTeamByCode(
  userId: string,
  tournamentId: string,
  joinCode: string,
  db: PrismaClient = prisma,
): Promise<{ teamId: string }> {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("tournament_not_found");
  if (t.teamSize <= 1) throw new TournamentError("team_solo_only");
  assertTournamentJoinable(t);

  const team = await db.tournamentTeam.findUnique({
    where: { joinCode: joinCode.trim().toUpperCase() },
    include: { _count: { select: { registrations: true } } },
  });
  if (!team || team.tournamentId !== tournamentId) {
    throw new TournamentError("team_join_code_invalid");
  }
  if (team._count.registrations >= t.teamSize) {
    throw new TournamentError("team_full");
  }

  const existingReg = await db.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  if (existingReg) throw new TournamentError("already_registered");

  await db.$transaction(async (tx) => {
    await tx.tournamentRegistration.create({
      data: { tournamentId, userId, teamId: team.id },
    });
    await tx.learningEvent.create({
      data: {
        userId,
        eventType: LearningEventType.TournamentRegistered,
        payload: { tournamentId, teamId: team.id, role: "member" } as Prisma.InputJsonValue,
        courseId: t.courseId ?? null,
      },
    });
  });
  return { teamId: team.id };
}

/**
 * Leave the team (or solo registration). If captain leaves a team with other
 * members, captaincy transfers to the earliest remaining member. If the team
 * empties, it is deleted.
 */
export async function leaveTournament(
  userId: string,
  tournamentId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("tournament_not_found");
  assertTournamentJoinable(t);

  const reg = await db.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    include: { team: true },
  });
  if (!reg) throw new TournamentError("not_registered");

  await db.$transaction(async (tx) => {
    await tx.tournamentRegistration.delete({ where: { id: reg.id } });

    if (reg.teamId && reg.team) {
      const remaining = await tx.tournamentRegistration.findMany({
        where: { teamId: reg.teamId },
        orderBy: { registeredAt: "asc" },
        select: { id: true, userId: true },
      });
      if (remaining.length === 0) {
        await tx.tournamentTeam.delete({ where: { id: reg.teamId } });
      } else if (reg.team.captainId === userId) {
        await tx.tournamentTeam.update({
          where: { id: reg.teamId },
          data: { captainId: remaining[0]!.userId },
        });
      }
    }
  });
}

export async function kickFromTeam(
  captainUserId: string,
  tournamentId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  if (captainUserId === targetUserId) {
    // Captain "kicking" themselves is just leaving — different semantic.
    throw new TournamentError("validation_failed");
  }
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("tournament_not_found");
  assertTournamentJoinable(t);

  const targetReg = await db.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: targetUserId } },
    include: { team: true },
  });
  if (!targetReg || !targetReg.team) throw new TournamentError("team_not_found");
  if (targetReg.team.captainId !== captainUserId) {
    throw new TournamentError("team_not_captain");
  }

  await db.tournamentRegistration.delete({ where: { id: targetReg.id } });
}

export async function regenerateJoinCode(
  captainUserId: string,
  tournamentId: string,
  teamId: string,
  db: PrismaClient = prisma,
): Promise<{ joinCode: string }> {
  const team = await db.tournamentTeam.findUnique({ where: { id: teamId } });
  if (!team || team.tournamentId !== tournamentId) {
    throw new TournamentError("team_not_found");
  }
  if (team.captainId !== captainUserId) {
    throw new TournamentError("team_not_captain");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeJoinCode();
    try {
      const updated = await db.tournamentTeam.update({
        where: { id: teamId },
        data: { joinCode: code },
      });
      return { joinCode: updated.joinCode };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  throw new TournamentError("validation_failed");
}

/**
 * Mark a mission completed for a user. Idempotent on the user-mission pair
 * via eventKey. Awards mission `points` and emits ranking-updated event.
 * Caller is responsible for checking the user actually did the underlying
 * thing (e.g. passed a quiz) — this is just the bookkeeping layer.
 */
export async function completeMission(
  userId: string,
  missionId: string,
  db: PrismaClient = prisma,
): Promise<{ alreadyCompleted: boolean; points: number }> {
  const mission = await db.tournamentMission.findUnique({
    where: { id: missionId },
    include: {
      tournament: true,
      // conditionSkillCode and other condition fields are on the mission itself;
      // Prisma includes all scalar fields by default in findUnique.
    },
  });
  if (!mission) throw new TournamentError("mission_not_found");

  const t = mission.tournament;
  if (t.status === "ended") throw new TournamentError("ended");

  // Verify user is registered.
  const reg = await db.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: t.id, userId } },
  });
  if (!reg) throw new TournamentError("not_registered");

  // Verify prereq is completed (if any).
  if (mission.prerequisiteId) {
    const prereqEventKey = `tournament.mission.completed:${userId}:${mission.prerequisiteId}`;
    const prereqEvent = await db.learningEvent.findUnique({
      where: { eventKey: prereqEventKey },
    });
    if (!prereqEvent) {
      throw new TournamentError("prereq_not_completed");
    }
  }

  // C5 — Verify condition (if configured). "manual" and null conditionType
  // are skipped here — the route that calls completeMission() is then
  // responsible for verifying the underlying activity before calling us.
  if (mission.conditionType && mission.conditionType !== "manual") {
    const check = await checkMissionCondition(
      userId,
      {
        conditionType: mission.conditionType,
        conditionValue: mission.conditionValue,
        conditionScope: mission.conditionScope,
        conditionMinScore: mission.conditionMinScore,
        conditionSkillCode: mission.conditionSkillCode,
      },
      t.courseId,
      db,
    );
    if (!check.met) {
      throw new TournamentError("condition_not_met", {
        current: check.current,
        required: check.required,
      });
    }
  }

  const eventKey = `tournament.mission.completed:${userId}:${missionId}`;
  const existing = await db.learningEvent.findUnique({ where: { eventKey } });
  if (existing) {
    return { alreadyCompleted: true, points: mission.points };
  }

  await db.learningEvent.create({
    data: {
      userId,
      eventType: LearningEventType.TournamentMissionCompleted,
      eventKey,
      payload: {
        tournamentId: t.id,
        missionId,
        points: mission.points,
      } as Prisma.InputJsonValue,
      courseId: t.courseId ?? null,
    },
  });

  await recomputeRanking(t.id, db);

  return { alreadyCompleted: false, points: mission.points };
}

/**
 * Rebuild TournamentRanking rows. Solo mode (teamSize=1): one ranking per
 * registered user. Team mode: aggregate by teamId. We compute totalPoints
 * from MissionCompleted events (idempotent with eventKey).
 */
export async function recomputeRanking(
  tournamentId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const t = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: { select: { userId: true, teamId: true } },
      missions: { select: { id: true, points: true } },
    },
  });
  if (!t) throw new TournamentError("tournament_not_found");

  const missionIds = t.missions.map((m) => m.id);
  if (missionIds.length === 0 || t.registrations.length === 0) {
    return;
  }

  // Pull all completion events for this tournament's missions.
  const events = await db.learningEvent.findMany({
    where: {
      eventType: LearningEventType.TournamentMissionCompleted,
      eventKey: { startsWith: "tournament.mission.completed:" },
    },
    select: { userId: true, payload: true },
  });

  const pointsByUser = new Map<string, number>();
  for (const e of events) {
    const p = e.payload as { tournamentId?: string; missionId?: string; points?: number } | null;
    if (!p?.missionId || !missionIds.includes(p.missionId)) continue;
    // A5.8: skip candidate-emitted events — tournaments are User-only.
    if (!e.userId) continue;
    const inc = typeof p.points === "number" ? p.points : 0;
    pointsByUser.set(e.userId, (pointsByUser.get(e.userId) ?? 0) + inc);
  }

  // Solo: one row per user. Team: aggregate per teamId.
  const teamSize = t.teamSize;
  if (teamSize === 1) {
    const sorted = [...t.registrations].map((r) => ({
      userId: r.userId,
      points: pointsByUser.get(r.userId) ?? 0,
    }));
    sorted.sort((a, b) => b.points - a.points);
    await db.$transaction(async (tx) => {
      // Wipe + reinsert. Tournament rankings are small.
      await tx.tournamentRanking.deleteMany({ where: { tournamentId } });
      for (let i = 0; i < sorted.length; i++) {
        await tx.tournamentRanking.create({
          data: {
            tournamentId,
            userId: sorted[i]!.userId,
            rank: i + 1,
            totalPoints: sorted[i]!.points,
          },
        });
      }
    });
  } else {
    const byTeam = new Map<string, number>();
    for (const r of t.registrations) {
      if (!r.teamId) continue;
      byTeam.set(r.teamId, (byTeam.get(r.teamId) ?? 0) + (pointsByUser.get(r.userId) ?? 0));
    }
    const sorted = Array.from(byTeam.entries())
      .map(([teamId, points]) => ({ teamId, points }))
      .sort((a, b) => b.points - a.points);
    await db.$transaction(async (tx) => {
      await tx.tournamentRanking.deleteMany({ where: { tournamentId } });
      for (let i = 0; i < sorted.length; i++) {
        await tx.tournamentRanking.create({
          data: {
            tournamentId,
            teamId: sorted[i]!.teamId,
            rank: i + 1,
            totalPoints: sorted[i]!.points,
          },
        });
      }
    });
  }

  await db.learningEvent.create({
    data: {
      userId: t.creatorId,
      eventType: LearningEventType.TournamentRankingUpdated,
      payload: { tournamentId } as Prisma.InputJsonValue,
      courseId: t.courseId ?? null,
    },
  });
}

/**
 * Distribute prizes when tournament ends. `prizeDistribution` is a JSON map
 * { "1": 50, "2": 30, "3": 20 } (rank → percent of prizeXp). Awards XP to
 * top-ranked users, idempotent via sourceId.
 */
export async function distributePrizes(
  tournamentId: string,
  db: PrismaClient = prisma,
): Promise<{ awarded: number }> {
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("tournament_not_found");
  if (t.status !== "ended") {
    // Only run on ended tournaments.
    throw new TournamentError("validation_failed");
  }
  if (t.prizeXp <= 0 || !t.prizeDistribution) return { awarded: 0 };
  if (!t.courseId) {
    // Platform-wide tournaments need a default course context for XP, skip.
    return { awarded: 0 };
  }

  const dist = t.prizeDistribution as Record<string, number>;
  const rankings = await db.tournamentRanking.findMany({
    where: { tournamentId },
    orderBy: { rank: "asc" },
  });

  let awarded = 0;
  for (const r of rankings) {
    const pct = dist[String(r.rank)];
    if (typeof pct !== "number" || pct <= 0) continue;
    const xp = Math.floor((t.prizeXp * pct) / 100);
    if (xp <= 0) continue;
    if (r.userId) {
      await awardXp(
        {
          userId: r.userId,
          courseId: t.courseId,
          amount: xp,
          reason: "tournament.prize",
          sourceId: `tournament:${tournamentId}:rank-${r.rank}`,
          extraEventPayload: { tournamentId, rank: r.rank },
        },
        db,
      );
      awarded += xp;
    } else if (r.teamId) {
      // Team rank → award full prize XP to each active member. Solidarity
      // model: cả đội cùng chia sẻ chiến thắng nguyên giá (đỡ tranh cãi
      // hơn chia đôi/chia 3). sourceId chứa userId để idempotent per-user.
      const members = await db.tournamentRegistration.findMany({
        where: { teamId: r.teamId, disqualifiedAt: null },
        select: { userId: true },
      });
      for (const m of members) {
        await awardXp(
          {
            userId: m.userId,
            courseId: t.courseId,
            amount: xp,
            reason: "tournament.prize",
            sourceId: `tournament:${tournamentId}:rank-${r.rank}:team-${r.teamId}:user-${m.userId}`,
            extraEventPayload: { tournamentId, rank: r.rank, teamId: r.teamId },
          },
          db,
        );
        awarded += xp;
      }
    }
  }

  await db.learningEvent.create({
    data: {
      userId: t.creatorId,
      eventType: LearningEventType.TournamentPrizeDistributed,
      payload: { tournamentId, totalAwarded: awarded } as Prisma.InputJsonValue,
      courseId: t.courseId,
    },
  });

  return { awarded };
}

/**
 * Cron tick — run every 5 min via Vercel cron.
 *  - Auto-flip status from `published` → `active` when startsAt has passed
 *  - Auto-flip `active` → `ended` when endsAt has passed; runs distributePrizes
 */
import { assignPeerReviewers, closeReviewWindow } from "./customMissionsRuntime";

export async function tournamentTick(
  db: PrismaClient = prisma,
): Promise<{ activated: number; ended: number; prizesAwarded: number; peerReviewsAssigned: number; reviewWindowsClosed: number }> {
  const now = new Date();
  const activated = await db.tournament.updateMany({
    where: { status: "published", startsAt: { lte: now } },
    data: { status: "active" },
  });
  const toEnd = await db.tournament.findMany({
    where: { status: "active", endsAt: { lte: now } },
    select: { id: true },
  });
  let prizesAwarded = 0;
  let endedCount = 0;
  for (const t of toEnd) {
    await db.tournament.update({
      where: { id: t.id },
      data: { status: "ended" },
    });
    endedCount += 1;
    try {
      const r = await distributePrizes(t.id, db);
      prizesAwarded += r.awarded;
    } catch {
      // best-effort
    }
    await db.learningEvent.create({
      data: {
        userId: (await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).creatorId,
        eventType: LearningEventType.TournamentEnded,
        payload: { tournamentId: t.id } as Prisma.InputJsonValue,
      },
    });
  }
  // C5.x — process peer-review missions:
  //   1) Submission deadline reached → randomly assign reviewers.
  //   2) Review window end reached → compute median + award XP + finalize.
  let peerReviewsAssigned = 0;
  let reviewWindowsClosed = 0;

  const missionsDueForAssignment = await db.tournamentMission.findMany({
    where: {
      verifyMode: "PEER_REVIEW",
      submissionDeadline: { lte: now },
      reviewWindowEndAt: { gt: now },
    },
    select: { id: true },
  });
  for (const m of missionsDueForAssignment) {
    try {
      const r = await assignPeerReviewers(m.id, db);
      peerReviewsAssigned += r.assignedCount;
    } catch {
      // best-effort — bad config on one mission shouldn't break the tick
    }
  }

  const missionsDueForClose = await db.tournamentMission.findMany({
    where: {
      verifyMode: "PEER_REVIEW",
      reviewWindowEndAt: { lte: now },
    },
    select: { id: true },
  });
  for (const m of missionsDueForClose) {
    try {
      const r = await closeReviewWindow(m.id, db);
      reviewWindowsClosed += r.closed;
    } catch {
      // best-effort
    }
  }

  return {
    activated: activated.count,
    ended: endedCount,
    prizesAwarded,
    peerReviewsAssigned,
    reviewWindowsClosed,
  };
}
