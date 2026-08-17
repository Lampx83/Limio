import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  assignPeerReviewers,
  closeReviewWindow,
  submitMission,
  submitPeerReview,
} from "../customMissionsRuntime";

/**
 * Regression: AUTO_GRADE / AUTO_CHECK / PEER_REVIEW / MANUAL_REVIEW-via-
 * Assignment all marked a MissionSubmission "passed" and paid XP, but never
 * recorded the tournament.mission.completed LearningEvent that
 * recomputeRanking() scans — so TournamentRanking (and therefore who is
 * gold/silver/bronze, and distributePrizes()) never reflected a pass unless
 * the mission was COURSE_LINKED or graded through the tournament-native
 * MANUAL_REVIEW flow (gradeMissionSubmission). This file covers the two
 * fixed paths that don't already have integration coverage elsewhere.
 */

function uniq() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function makeCourseAndTournament(teamSize = 1) {
  const id = uniq();
  const course = await prisma.course.create({
    data: { slug: `rk-${id}`, title: "C", description: "x" },
  });
  const creator = await prisma.user.create({
    data: { email: `creator-${id}@e.com`, passwordHash: "x", displayName: "Creator" },
  });
  const tournament = await prisma.tournament.create({
    data: {
      courseId: course.id,
      creatorId: creator.id,
      title: `T ${id}`,
      description: "x",
      status: "active",
      teamSize,
      startsAt: new Date(Date.now() - 3600_000),
      endsAt: new Date(Date.now() + 3600_000),
    },
  });
  return { course, tournament };
}

async function registerUser(tournamentId: string, label: string) {
  const id = uniq();
  const user = await prisma.user.create({
    data: { email: `${label}-${id}@e.com`, passwordHash: "x", displayName: label },
  });
  await prisma.tournamentRegistration.create({
    data: { tournamentId, userId: user.id },
  });
  return user;
}

describe("ranking is credited for every verify mode", () => {
  it("AUTO_CHECK: passing a submission updates TournamentRanking", async () => {
    const { tournament } = await makeCourseAndTournament();
    const user = await registerUser(tournament.id, "ac");
    const mission = await prisma.tournamentMission.create({
      data: {
        tournamentId: tournament.id,
        title: "M",
        description: "x",
        orderIndex: 0,
        points: 250,
        missionType: "CUSTOM",
        verifyMode: "AUTO_CHECK",
        autoCheckRule: { type: "url_pattern", config: { regex: ".*" } },
        submissionDeadline: new Date(Date.now() + 3600_000),
      },
    });

    const res = await submitMission({
      userId: user.id,
      missionId: mission.id,
      payload: { url: "https://example.com/proof" },
    });
    expect(res.status).toBe("passed");

    const event = await prisma.learningEvent.findUnique({
      where: { eventKey: `tournament.mission.completed:${user.id}:${mission.id}` },
    });
    expect(event).not.toBeNull();

    const ranking = await prisma.tournamentRanking.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    });
    expect(ranking?.totalPoints).toBe(250);
    expect(ranking?.rank).toBe(1);
  });

  it("PEER_REVIEW: closing the review window with a passing median updates TournamentRanking", async () => {
    const { tournament } = await makeCourseAndTournament();
    const author = await registerUser(tournament.id, "author");
    const reviewer = await registerUser(tournament.id, "reviewer");

    const mission = await prisma.tournamentMission.create({
      data: {
        tournamentId: tournament.id,
        title: "M",
        description: "x",
        orderIndex: 0,
        points: 400,
        missionType: "CUSTOM",
        verifyMode: "PEER_REVIEW",
        rubric: [{ id: "q", scale: "pass_fail", weight: 1 }],
        passThreshold: 0.5,
        peerReviewerCount: 1,
        reviewQuorum: 1,
        reviewWindowEndAt: new Date(Date.now() + 3600_000),
        submissionDeadline: new Date(Date.now() + 3600_000),
      },
    });

    // Two submitters are required for the solo reviewer pool to have anyone
    // other than the author to assign.
    await submitMission({
      userId: author.id,
      missionId: mission.id,
      payload: { artifactMarkdown: "my answer" },
    });
    await submitMission({
      userId: reviewer.id,
      missionId: mission.id,
      payload: { artifactMarkdown: "my answer" },
    });

    await assignPeerReviewers(mission.id);

    const authorSubmission = await prisma.missionSubmission.findUniqueOrThrow({
      where: { missionId_userId: { missionId: mission.id, userId: author.id } },
    });
    const assignment = await prisma.missionReviewAssignment.findFirstOrThrow({
      where: { submissionId: authorSubmission.id, reviewerId: reviewer.id },
    });

    await submitPeerReview({
      reviewAssignmentId: assignment.id,
      reviewerId: reviewer.id,
      scores: [{ criterionId: "q", score: 1 }],
    });

    const result = await closeReviewWindow(mission.id, prisma, { force: true });
    expect(result.closed).toBeGreaterThanOrEqual(1);

    const settledSubmission = await prisma.missionSubmission.findUnique({
      where: { id: authorSubmission.id },
    });
    expect(settledSubmission?.status).toBe("passed");

    const event = await prisma.learningEvent.findUnique({
      where: { eventKey: `tournament.mission.completed:${author.id}:${mission.id}` },
    });
    expect(event).not.toBeNull();

    const ranking = await prisma.tournamentRanking.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: author.id } },
    });
    expect(ranking?.totalPoints).toBe(400);
    expect(ranking?.rank).toBe(1);
  });
});
