import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { applyAutoRoundSplit, planAutoRoundSplit } from "../auto-round-split";

const BASE = "http://localhost:3000";

async function fixture(slug: string) {
  const owner = await registerUser(
    { email: `ars-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `ARS ${slug}`,
    description: "x",
    slug: `ars-course-${slug}`,
  });
  const exam = await prisma.exam.create({
    data: {
      courseId: course.courseId,
      title: `Đề ${slug}`,
      durationMin: 30,
      openAt: new Date(Date.now() - 60_000),
      closeAt: new Date(Date.now() + 86_400_000),
      createdById: owner.userId,
    },
  });
  const round = await prisma.examRound.create({
    data: {
      code: `AUTO-EXAM-${slug.toUpperCase()}-${randomUUID().slice(0, 6)}`,
      title: `Đợt thi tự động — Đề ${slug}`,
      opensAt: new Date(),
      closesAt: new Date(Date.now() + 86_400_000),
      status: "draft",
      courseId: course.courseId,
    },
  });
  const past = { opensAt: new Date(Date.now() - 3_600_000), closesAt: new Date(Date.now() - 60_000) };
  const mkSession = (scale: "simple" | "formal", extra: object = {}) =>
    prisma.examSession.create({
      data: { examId: exam.id, roundId: round.id, scale, timingMode: "scheduled", ...past, ...extra },
    });
  return { owner, course, exam, round, mkSession };
}

async function attemptOn(examId: string, sessionId: string, userId: string) {
  return prisma.examAttempt.create({
    data: {
      examId,
      sessionId,
      userId,
      durationSec: 600,
      sessionToken: randomUUID(),
    },
  });
}

describe("tách đợt tự động (AUTO-EXAM-…)", () => {
  it("buổi đơn được gỡ khỏi đợt; kỳ thi có lượt làm được giữ và đợt đổi thành đợt chính thức", async () => {
    const f = await fixture("keep");
    const simple = await f.mkSession("simple");
    const formal = await f.mkSession("formal");
    await attemptOn(f.exam.id, formal.id, f.owner.userId);

    const plan = await planAutoRoundSplit(prisma);
    expect(plan.detachSessionIds).toContain(simple.id);
    expect(plan.deleteSessionIds).not.toContain(formal.id);
    const rename = plan.renameRounds.find((r) => r.roundId === f.round.id);
    expect(rename).toBeTruthy();
    expect(rename!.code.startsWith("EXAM-")).toBe(true);
    expect(rename!.title).toBe(f.exam.title);

    await applyAutoRoundSplit(plan, prisma);
    expect((await prisma.examSession.findUniqueOrThrow({ where: { id: simple.id } })).roundId).toBeNull();
    const kept = await prisma.examSession.findUniqueOrThrow({ where: { id: formal.id } });
    expect(kept.roundId).toBe(f.round.id);
    const round = await prisma.examRound.findUniqueOrThrow({ where: { id: f.round.id } });
    expect(round.code.startsWith("EXAM-")).toBe(true);
    expect(round.title).toBe(f.exam.title);
  });

  it("kỳ thi chưa ai làm, không thí sinh, không mở → xoá; đợt rỗng → xoá", async () => {
    const f = await fixture("drop");
    const empty = await f.mkSession("formal");

    const plan = await planAutoRoundSplit(prisma);
    expect(plan.deleteSessionIds).toContain(empty.id);
    expect(plan.deleteRoundIds).toContain(f.round.id);

    await applyAutoRoundSplit(plan, prisma);
    expect(await prisma.examSession.count({ where: { id: empty.id } })).toBe(0);
    expect(await prisma.examRound.count({ where: { id: f.round.id } })).toBe(0);
  });

  it("kỳ thi có thí sinh nhưng chưa ai làm → bỏ qua, không xoá ca lẫn đợt", async () => {
    const f = await fixture("roster");
    const s = await f.mkSession("formal");
    await prisma.examCandidate.create({
      data: { examId: f.exam.id, sessionId: s.id, displayName: "Nguyễn A" },
    });

    const plan = await planAutoRoundSplit(prisma);
    expect(plan.deleteSessionIds).not.toContain(s.id);
    expect(plan.skipped).toContainEqual({ sessionId: s.id, roundId: f.round.id, reason: "has_candidates" });
    expect(plan.deleteRoundIds).not.toContain(f.round.id);

    await applyAutoRoundSplit(plan, prisma);
    expect(await prisma.examSession.count({ where: { id: s.id } })).toBe(1);
    expect(await prisma.examRound.count({ where: { id: f.round.id } })).toBe(1);
  });

  it("ca đang mở theo lịch, chưa ai làm → đóng (giữ ca và đợt), không xoá", async () => {
    const f = await fixture("live");
    const s = await f.mkSession("formal", {
      opensAt: new Date(Date.now() - 60_000),
      closesAt: new Date(Date.now() + 3_600_000),
    });

    const plan = await planAutoRoundSplit(prisma);
    expect(plan.deleteSessionIds).not.toContain(s.id);
    expect(plan.closeScheduledIds).toContain(s.id);
    expect(plan.deleteRoundIds).not.toContain(f.round.id);

    await applyAutoRoundSplit(plan, prisma);
    const after = await prisma.examSession.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.closesAt!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(await prisma.examRound.count({ where: { id: f.round.id } })).toBe(1);
  });
});
