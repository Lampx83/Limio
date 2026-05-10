import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  createAssignment,
  deleteAssignment,
  gradeSubmission,
  listAssignmentsForLesson,
  listSubmissionsForInstructor,
  submitAssignment,
  updateAssignment,
} from "../assignments";
import { registerUser } from "../../auth/register";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { enrollInCourse } from "../../learning/enroll";

const BASE = "http://localhost:3000";

async function setup() {
  const inst = await registerUser(
    {
      email: `inst-${Date.now()}-${Math.random()}@e.com`,
      password: "password1234",
      displayName: "Inst",
    },
    BASE,
  );
  const lr = await registerUser(
    {
      email: `learner-${Date.now()}-${Math.random()}@e.com`,
      password: "password1234",
      displayName: "Lr",
    },
    BASE,
  );
  const c = await createCourse(inst.userId, { title: "AC", description: "x" });
  const m = await createModule(inst.userId, c.courseId, {
    title: "M",
    orderIndex: 0,
  });
  const l = await createLesson(inst.userId, m.moduleId, {
    title: "L",
    orderIndex: 0,
  });
  // Set course to published so the learner can enroll. Bypasses the
  // publishCourse skill-tag gate — irrelevant for assignment tests.
  await prisma.course.update({
    where: { id: c.courseId },
    data: { status: "published" },
  });
  await enrollInCourse(lr.userId, c.courseId);
  return {
    instId: inst.userId,
    learnerId: lr.userId,
    courseId: c.courseId,
    lessonId: l.lessonId,
  };
}

describe("Assignments — A5", () => {
  it("creates + lists assignment for lesson", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "Bài tập 1",
      description: "Viết đoạn văn 200 từ.",
      maxScore: 100,
    });
    const list = await listAssignmentsForLesson(s.lessonId);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(a.assignmentId);
  });

  it("only course editors can create", async () => {
    const s = await setup();
    await expect(
      createAssignment(s.learnerId, s.lessonId, {
        title: "X",
        description: "Y",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("validates required fields", async () => {
    const s = await setup();
    await expect(
      createAssignment(s.instId, s.lessonId, { title: "", description: "x" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      createAssignment(s.instId, s.lessonId, { title: "OK", description: "" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("submitAssignment is idempotent + emits assignment.submitted event", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "Mô tả",
    });
    const r1 = await submitAssignment(s.learnerId, a.assignmentId, {
      body: "v1",
    });
    const r2 = await submitAssignment(s.learnerId, a.assignmentId, {
      body: "v2",
    });
    expect(r1.submissionId).toBe(r2.submissionId);

    const subs = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: a.assignmentId, userId: s.learnerId },
    });
    expect(subs).toHaveLength(1);
    expect(subs[0]!.body).toBe("v2");

    const events = await prisma.learningEvent.findMany({
      where: {
        userId: s.learnerId,
        eventType: LearningEventType.AssignmentSubmitted,
      },
    });
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks submit when not enrolled", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "Mô tả",
    });
    await expect(
      submitAssignment(s.instId, a.assignmentId, { body: "x" }),
    ).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("gradeSubmission updates status + emits assignment.graded event", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "Mô tả",
      maxScore: 50,
    });
    const sub = await submitAssignment(s.learnerId, a.assignmentId, {
      body: "x",
    });
    await gradeSubmission(s.instId, sub.submissionId, {
      score: 40,
      feedback: "Tốt",
    });
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { id: sub.submissionId },
    });
    expect(row.status).toBe("graded");
    expect(row.score).toBe(40);
    expect(row.feedback).toBe("Tốt");
    expect(row.graderId).toBe(s.instId);

    const events = await prisma.learningEvent.findMany({
      where: { userId: s.learnerId, eventType: LearningEventType.AssignmentGraded },
    });
    expect(events).toHaveLength(1);
  });

  it("gradeSubmission rejects score > maxScore", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
      maxScore: 10,
    });
    const sub = await submitAssignment(s.learnerId, a.assignmentId, { body: "x" });
    await expect(
      gradeSubmission(s.instId, sub.submissionId, { score: 11 }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("re-submission resets status from graded back to submitted", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
    });
    const sub = await submitAssignment(s.learnerId, a.assignmentId, {
      body: "v1",
    });
    await gradeSubmission(s.instId, sub.submissionId, { score: 80 });
    await submitAssignment(s.learnerId, a.assignmentId, { body: "v2" });
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { id: sub.submissionId },
    });
    expect(row.status).toBe("submitted");
    expect(row.score).toBeNull();
  });

  it("listSubmissionsForInstructor authz: only editors", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
    });
    await expect(
      listSubmissionsForInstructor(s.learnerId, a.assignmentId),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("creates assignment with generative metadata (defaults preserved when omitted)", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "Tóm tắt bài",
      description: "Tóm tắt 200 từ",
      pedagogicalIntent: "summarizing",
      responseFormat: "text",
      assessmentModes: ["self_assessed"],
      requireSelfRating: true,
      requireReflection: true,
      countsTowardGrade: false,
    });
    const row = await prisma.assignment.findUniqueOrThrow({
      where: { id: a.assignmentId },
    });
    expect(row.pedagogicalIntent).toBe("summarizing");
    expect(row.requireSelfRating).toBe(true);
    expect(row.requireReflection).toBe(true);
    expect(row.countsTowardGrade).toBe(false);
    expect(row.assessmentModes).toEqual(["self_assessed"]);
  });

  it("creates plain assignment with default generative metadata when omitted", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "Bài tập thường",
      description: "x",
    });
    const row = await prisma.assignment.findUniqueOrThrow({
      where: { id: a.assignmentId },
    });
    expect(row.pedagogicalIntent).toBeNull();
    expect(row.requireSelfRating).toBe(false);
    expect(row.requireReflection).toBe(false);
    expect(row.countsTowardGrade).toBe(true);
    expect(row.responseFormat).toBe("text");
    expect(row.assessmentModes).toEqual(["instructor_graded"]);
  });

  it("submit blocked when requireSelfRating + selfRating missing", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
      requireSelfRating: true,
    });
    await expect(
      submitAssignment(s.learnerId, a.assignmentId, { body: "ok" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("submit blocked when requireReflection + reflection too short", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
      requireReflection: true,
    });
    await expect(
      submitAssignment(s.learnerId, a.assignmentId, {
        body: "ok",
        reflection: "ngắn",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("submit with selfRating + reflection emits all 3 events + persists fields", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
      requireSelfRating: true,
      requireReflection: true,
    });
    const r = await submitAssignment(s.learnerId, a.assignmentId, {
      body: "Bài làm chi tiết của tôi",
      selfRating: 4,
      reflection: "Tôi đã học được cách tóm tắt nội dung hiệu quả hơn",
    });
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { id: r.submissionId },
    });
    expect(row.selfRating).toBe(4);
    expect(row.reflection).toContain("tóm tắt");

    const submitted = await prisma.learningEvent.findMany({
      where: {
        userId: s.learnerId,
        eventType: LearningEventType.AssignmentSubmitted,
      },
    });
    const rated = await prisma.learningEvent.findMany({
      where: {
        userId: s.learnerId,
        eventType: LearningEventType.AssignmentSelfRated,
      },
    });
    const reflected = await prisma.learningEvent.findMany({
      where: {
        userId: s.learnerId,
        eventType: LearningEventType.AssignmentReflected,
      },
    });
    expect(submitted).toHaveLength(1);
    expect(rated).toHaveLength(1);
    expect(reflected).toHaveLength(1);
  });

  it("update + delete require editor authz; delete removes assignment", async () => {
    const s = await setup();
    const a = await createAssignment(s.instId, s.lessonId, {
      title: "T",
      description: "x",
    });
    await updateAssignment(s.instId, a.assignmentId, { title: "Updated" });
    const row = await prisma.assignment.findUniqueOrThrow({
      where: { id: a.assignmentId },
    });
    expect(row.title).toBe("Updated");
    await deleteAssignment(s.instId, a.assignmentId);
    expect(
      await prisma.assignment.findUnique({ where: { id: a.assignmentId } }),
    ).toBeNull();
  });
});
