import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { completeLesson, LearningError, trackLessonView } from "../lessons";
import { enrollInCourse } from "../enroll";
import {
  createCourse,
  publishCourse,
} from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

interface Setup {
  ownerId: string;
  learnerId: string;
  courseId: string;
  lessonIds: string[];
  outsiderId: string;
}

async function setup(slug: string, lessonCount = 2): Promise<Setup> {
  const owner = await registerUser(
    { email: `o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const learner = await registerUser(
    { email: `l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `x-${slug}@e.com`, password: "password1234", displayName: "X" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const lessonIds: string[] = [];
  const skill = await createSkill({ code: `skill.lt.${slug}`, name: "s" });
  for (let i = 0; i < lessonCount; i++) {
    const l = await createLesson(owner.userId, m.moduleId, {
      title: `L${i}`,
      orderIndex: i,
    });
    await tagLessonSkill(owner.userId, l.lessonId, { skillId: skill.skillId });
    lessonIds.push(l.lessonId);
  }
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);
  return {
    ownerId: owner.userId,
    learnerId: learner.userId,
    outsiderId: outsider.userId,
    courseId: c.courseId,
    lessonIds,
  };
}

describe("trackLessonView", () => {
  it("AC-A3.4: emits lesson.viewed + updates Enrollment.lastLessonId/lastPositionSec", async () => {
    const { learnerId, courseId, lessonIds } = await setup("v1");
    await trackLessonView(learnerId, lessonIds[0]!, { positionSec: 42, durationSec: 600 });

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    expect(enrollment.lastLessonId).toBe(lessonIds[0]);
    expect(enrollment.lastPositionSec).toBe(42);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.LessonViewed },
    });
    expect(events).toHaveLength(1);
    expect((events[0]?.payload as { positionSec: number }).positionSec).toBe(42);
  });

  it("AC-A3.5: not_enrolled for outsider", async () => {
    const { outsiderId, lessonIds } = await setup("v2");
    await expect(
      trackLessonView(outsiderId, lessonIds[0]!, { positionSec: 0 }),
    ).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("lesson_not_found for bogus lessonId", async () => {
    const { learnerId } = await setup("v3");
    await expect(
      trackLessonView(learnerId, "00000000-0000-0000-0000-000000000000", { positionSec: 0 }),
    ).rejects.toBeInstanceOf(LearningError);
  });

  it("rejects negative positionSec", async () => {
    const { learnerId, lessonIds } = await setup("v4");
    await expect(
      trackLessonView(learnerId, lessonIds[0]!, { positionSec: -1 }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("completeLesson", () => {
  it("AC-A3.6: marks one lesson complete; not yet course-complete", async () => {
    const { learnerId, courseId, lessonIds } = await setup("c1");
    const r = await completeLesson(learnerId, lessonIds[0]!);
    expect(r.newlyCompleted).toBe(true);
    expect(r.courseCompleted).toBe(false);

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    expect(enrollment.completedAt).toBeNull();
    expect(enrollment.status).toBe("active");
  });

  it("idempotent: calling complete twice does not double-emit", async () => {
    const { learnerId, lessonIds } = await setup("c2");
    const r1 = await completeLesson(learnerId, lessonIds[0]!);
    const r2 = await completeLesson(learnerId, lessonIds[0]!);
    expect(r1.newlyCompleted).toBe(true);
    expect(r2.newlyCompleted).toBe(false);
    const events = await prisma.learningEvent.findMany({
      where: {
        userId: learnerId,
        eventType: LearningEventType.LessonCompleted,
      },
    });
    expect(events).toHaveLength(1);
  });

  it("course.completed event fires when last lesson done; enrollment.completedAt set", async () => {
    const { learnerId, courseId, lessonIds } = await setup("c3", 2);
    await completeLesson(learnerId, lessonIds[0]!);
    const final = await completeLesson(learnerId, lessonIds[1]!);
    expect(final.courseCompleted).toBe(true);

    const courseCompletedEvents = await prisma.learningEvent.findMany({
      where: {
        userId: learnerId,
        eventType: LearningEventType.CourseCompleted,
      },
    });
    expect(courseCompletedEvents).toHaveLength(1);

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    expect(enrollment.completedAt).toBeInstanceOf(Date);
    expect(enrollment.status).toBe("completed");
  });

  it("course.completed not re-emitted on idempotent recomplete", async () => {
    const { learnerId, lessonIds } = await setup("c4", 1);
    await completeLesson(learnerId, lessonIds[0]!); // course done
    await completeLesson(learnerId, lessonIds[0]!); // idempotent
    const events = await prisma.learningEvent.findMany({
      where: {
        userId: learnerId,
        eventType: LearningEventType.CourseCompleted,
      },
    });
    expect(events).toHaveLength(1);
  });

  it("not_enrolled blocks complete for outsider", async () => {
    const { outsiderId, lessonIds } = await setup("c5");
    await expect(completeLesson(outsiderId, lessonIds[0]!)).rejects.toMatchObject({
      code: "not_enrolled",
    });
  });
});
