import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { submitMission } from "../customMissionsRuntime";

/**
 * Regression: a platform-wide tournament (Tournament.courseId = null) used to
 * pass `courseId: ""` into awardXp. XpTransaction.courseId is a required FK, so
 * every award threw — 673 times a week on production — *after* the submission
 * was already marked passed and its event emitted. The mission looked complete
 * to the learner while no XP existed.
 */
async function platformWideMission(points: number) {
  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: { email: `pw-${uniq}@e.com`, passwordHash: "x", displayName: "PW" },
  });
  const tournament = await prisma.tournament.create({
    data: {
      courseId: null, // platform-wide — the case that used to break
      creatorId: user.id,
      title: `PW ${uniq}`,
      description: "x",
      status: "active",
      startsAt: new Date(Date.now() - 3600_000),
      endsAt: new Date(Date.now() + 3600_000),
    },
  });
  const mission = await prisma.tournamentMission.create({
    data: {
      tournamentId: tournament.id,
      title: "M",
      description: "x",
      orderIndex: 0,
      points,
      verifyMode: "AUTO_CHECK",
      autoCheckRule: { type: "url_pattern", config: { regex: ".*" } },
      submissionDeadline: new Date(Date.now() + 3600_000),
    },
  });
  await prisma.tournamentRegistration.create({
    data: { tournamentId: tournament.id, userId: user.id },
  });
  return { userId: user.id, missionId: mission.id, tournamentId: tournament.id };
}

describe("mission XP on platform-wide tournaments", () => {
  it("passes the mission without throwing, and awards no XP", async () => {
    const { userId, missionId } = await platformWideMission(50);

    const res = await submitMission({
      userId,
      missionId,
      payload: { url: "https://example.com/proof" },
    });

    // The submit path must complete cleanly — previously the FK error was
    // thrown here, after the submission row had already been written.
    expect(res.status).toBe("passed");

    const xp = await prisma.xpTransaction.count({
      where: { userId, reason: "tournament.mission.completed" },
    });
    expect(xp).toBe(0);

    // And the state left behind is consistent: passed, with no half-written XP.
    const sub = await prisma.missionSubmission.findUnique({
      where: { id: res.submissionId },
      select: { status: true },
    });
    expect(sub?.status).toBe("passed");
  });

  it("still awards XP when the tournament belongs to a course", async () => {
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const course = await prisma.course.create({
      data: { slug: `pw-c-${uniq}`, title: "C", description: "x" },
    });
    const user = await prisma.user.create({
      data: { email: `pwc-${uniq}@e.com`, passwordHash: "x", displayName: "PWC" },
    });
    const tournament = await prisma.tournament.create({
      data: {
        courseId: course.id,
        creatorId: user.id,
        title: `PWC ${uniq}`,
        description: "x",
        status: "active",
        startsAt: new Date(Date.now() - 3600_000),
        endsAt: new Date(Date.now() + 3600_000),
      },
    });
    const mission = await prisma.tournamentMission.create({
      data: {
        tournamentId: tournament.id,
        title: "M",
        description: "x",
        orderIndex: 0,
        points: 40,
        verifyMode: "AUTO_CHECK",
        autoCheckRule: { type: "url_pattern", config: { regex: ".*" } },
        submissionDeadline: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.tournamentRegistration.create({
      data: { tournamentId: tournament.id, userId: user.id },
    });

    const res = await submitMission({
      userId: user.id,
      missionId: mission.id,
      payload: { url: "https://example.com/proof" },
    });
    expect(res.status).toBe("passed");

    const tx = await prisma.xpTransaction.findFirst({
      where: { userId: user.id, reason: "tournament.mission.completed" },
    });
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(40);
    expect(tx!.courseId).toBe(course.id);
  });
});
