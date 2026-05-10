import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { onAssignmentDeepReflection } from "../handlers";

async function makeUserCourse() {
  const user = await prisma.user.create({
    data: {
      email: `adr-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: "U",
    },
  });
  const course = await prisma.course.create({
    data: {
      slug: `adr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return { userId: user.id, courseId: course.id };
}

describe("onAssignmentDeepReflection — gamification gate", () => {
  it("grants 15 XP when both selfRating + reflection ≥ 20 chars", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onAssignmentDeepReflection({
      userId,
      courseId,
      assignmentId: "A1",
      selfRating: 4,
      reflectionLength: 50,
    });
    expect(r.xp?.awarded).toBe(true);
    expect(r.xp?.amountGranted).toBe(15);
    expect(r.xp?.storedReason).toBe("assignment.deep_reflection");
  });

  it("returns null xp when selfRating missing", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onAssignmentDeepReflection({
      userId,
      courseId,
      assignmentId: "A1",
      selfRating: null,
      reflectionLength: 100,
    });
    expect(r.xp).toBeNull();
  });

  it("returns null xp when reflection too short", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onAssignmentDeepReflection({
      userId,
      courseId,
      assignmentId: "A1",
      selfRating: 5,
      reflectionLength: 10,
    });
    expect(r.xp).toBeNull();
  });

  it("idempotent on assignmentId — re-submission doesn't re-award", async () => {
    const { userId, courseId } = await makeUserCourse();
    await onAssignmentDeepReflection({
      userId,
      courseId,
      assignmentId: "A1",
      selfRating: 3,
      reflectionLength: 30,
    });
    const second = await onAssignmentDeepReflection({
      userId,
      courseId,
      assignmentId: "A1",
      selfRating: 5,
      reflectionLength: 60,
    });
    expect(second.xp?.awarded).toBe(false);
    const progress = await prisma.userCourseProgress.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    expect(progress.xp).toBe(15);
  });

  it("daily cap of 5 per course — 6th distinct assignment is capped", async () => {
    const { userId, courseId } = await makeUserCourse();
    for (let i = 0; i < 5; i++) {
      const r = await onAssignmentDeepReflection({
        userId,
        courseId,
        assignmentId: `A-${i}`,
        selfRating: 4,
        reflectionLength: 30,
      });
      expect(r.xp?.amountGranted).toBe(15);
    }
    const sixth = await onAssignmentDeepReflection({
      userId,
      courseId,
      assignmentId: "A-cap",
      selfRating: 4,
      reflectionLength: 30,
    });
    expect(sixth.xp?.storedReason).toBe("xp.capped.daily");
    expect(sixth.xp?.amountGranted).toBe(0);
  });
});
