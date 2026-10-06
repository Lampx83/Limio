import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { CustomMissionError, submitMission } from "../customMissionsRuntime";

/** Cho nộp muộn: quá hạn bị chặn mặc định; bật cờ thì nhận và đánh dấu isLate; giải đóng thì vẫn chặn. */

function uniq() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function setup(opts: { allowLate: boolean; tournamentEndsInMs?: number; deadlineAgoMs?: number }) {
  const id = uniq();
  const course = await prisma.course.create({ data: { slug: `late-${id}`, title: "C", description: "x" } });
  const creator = await prisma.user.create({ data: { email: `cr-${id}@e.com`, passwordHash: "x", displayName: "Cr" } });
  const user = await prisma.user.create({ data: { email: `u-${id}@e.com`, passwordHash: "x", displayName: "U" } });
  const tournament = await prisma.tournament.create({
    data: {
      courseId: course.id,
      creatorId: creator.id,
      title: `T ${id}`,
      description: "x",
      status: "active",
      startsAt: new Date(Date.now() - 7200_000),
      endsAt: new Date(Date.now() + (opts.tournamentEndsInMs ?? 3600_000)),
    },
  });
  await prisma.tournamentRegistration.create({ data: { tournamentId: tournament.id, userId: user.id } });
  const mission = await prisma.tournamentMission.create({
    data: {
      tournamentId: tournament.id,
      title: "M",
      description: "x",
      orderIndex: 0,
      points: 10,
      missionType: "CUSTOM",
      verifyMode: "PEER_REVIEW",
      allowLateSubmission: opts.allowLate,
      submissionDeadline: new Date(Date.now() - (opts.deadlineAgoMs ?? 600_000)),
    },
  });
  return { user, mission, tournament };
}

describe("nộp muộn", () => {
  it("mặc định: quá hạn bị chặn như cũ", async () => {
    const { user, mission } = await setup({ allowLate: false });
    await expect(
      submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "x" } }),
    ).rejects.toMatchObject({ code: "past_deadline" });
    expect(await prisma.missionSubmission.count({ where: { missionId: mission.id } })).toBe(0);
  });

  it("cho nộp muộn: nhận bài, đánh dấu isLate, ghi vào event", async () => {
    const { user, mission } = await setup({ allowLate: true });
    const r = await submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "x" } });
    const sub = await prisma.missionSubmission.findUniqueOrThrow({ where: { id: r.submissionId } });
    expect(sub.isLate).toBe(true);
    const ev = await prisma.learningEvent.findFirst({
      where: { userId: user.id, eventType: "tournament.mission.submitted" },
    });
    expect((ev?.payload as { isLate?: boolean }).isLate).toBe(true);
  });

  it("cho nộp muộn: nộp lại sau hạn vẫn được, vẫn muộn", async () => {
    const { user, mission } = await setup({ allowLate: true });
    await submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "v1" } });
    const r2 = await submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "v2" } });
    const sub = await prisma.missionSubmission.findUniqueOrThrow({ where: { id: r2.submissionId } });
    expect(sub.isLate).toBe(true);
    expect((sub.payload as { artifactMarkdown: string }).artifactMarkdown).toBe("v2");
  });

  it("bài nộp đúng hạn không bị đánh dấu muộn dù mission cho nộp muộn", async () => {
    const { user, mission } = await setup({ allowLate: true, deadlineAgoMs: -3600_000 });
    const r = await submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "x" } });
    const sub = await prisma.missionSubmission.findUniqueOrThrow({ where: { id: r.submissionId } });
    expect(sub.isLate).toBe(false);
  });

  it("nộp muộn rồi sửa hạn ra sau và nộp lại đúng hạn → xoá dấu muộn", async () => {
    const { user, mission } = await setup({ allowLate: true });
    await submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "v1" } });
    await prisma.tournamentMission.update({
      where: { id: mission.id },
      data: { submissionDeadline: new Date(Date.now() + 3600_000) },
    });
    const r = await submitMission({ missionId: mission.id, userId: user.id, payload: { artifactMarkdown: "v2" } });
    const sub = await prisma.missionSubmission.findUniqueOrThrow({ where: { id: r.submissionId } });
    expect(sub.isLate).toBe(false);
  });

  it("giải đã kết thúc: vẫn chặn dù mission cho nộp muộn", async () => {
    const { user, mission } = await setup({ allowLate: true, tournamentEndsInMs: -60_000 });
    const err = await submitMission({
      missionId: mission.id,
      userId: user.id,
      payload: { artifactMarkdown: "x" },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CustomMissionError);
    expect(err.code).toBe("tournament_not_open");
  });
});
