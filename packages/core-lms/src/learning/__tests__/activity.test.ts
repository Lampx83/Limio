import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isLearnerActivityType, learnerActivityWhere } from "../activity";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";

const BASE = "http://localhost:3000";

describe("isLearnerActivityType — điểm danh không phải hoạt động học", () => {
  it("điểm danh, lịch lớp và giáo trình dựng sẵn không tính; việc học thì tính", () => {
    expect(isLearnerActivityType(LearningEventType.AttendanceStudentMarked)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.ClassMeetingCancelled)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.CoursePackUsed)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.MeetingNoteSent)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.ClassMeetingClosed)).toBe(false);
    expect(isLearnerActivityType(LearningEventType.LessonViewed)).toBe(true);
    expect(isLearnerActivityType(LearningEventType.QuizQuestionAnswered)).toBe(true);
  });
});

describe("learnerActivityWhere — dùng cho truy vấn 'lần hoạt động gần nhất'", () => {
  it("giáo viên điểm danh học viên không làm học viên đó 'mới hoạt động'", async () => {
    const owner = (await registerUser({ email: "act-o@e.com", password: "password1234", displayName: "O" }, BASE)).userId;
    const learner = (await registerUser({ email: "act-l@e.com", password: "password1234", displayName: "L" }, BASE)).userId;
    const { courseId } = await createCourse(owner, { title: "Khoá act", description: "d", slug: "act-1" });

    const old = new Date("2026-09-01T03:00:00.000Z");
    const recent = new Date("2026-10-23T03:00:00.000Z");
    const mk = (eventType: string, occurredAt: Date) =>
      prisma.learningEvent.create({ data: { userId: learner, courseId, eventType, payload: {}, occurredAt } });
    await mk(LearningEventType.LessonViewed, old);
    await mk(LearningEventType.AttendanceStudentMarked, recent);

    const last = await prisma.learningEvent.groupBy({
      by: ["userId"],
      where: { userId: learner, courseId, ...learnerActivityWhere() },
      _max: { occurredAt: true },
    });
    expect(last[0]._max.occurredAt).toEqual(old);

    // không có bộ lọc thì đúng là bị tính (chứng minh lỗi cũ)
    const raw = await prisma.learningEvent.groupBy({
      by: ["userId"],
      where: { userId: learner, courseId },
      _max: { occurredAt: true },
    });
    expect(raw[0]._max.occurredAt).toEqual(recent);
  });

  it("học viên chỉ có dòng điểm danh → không có lần hoạt động nào", async () => {
    const owner = (await registerUser({ email: "act-o2@e.com", password: "password1234", displayName: "O" }, BASE)).userId;
    const learner = (await registerUser({ email: "act-l2@e.com", password: "password1234", displayName: "L" }, BASE)).userId;
    const { courseId } = await createCourse(owner, { title: "Khoá act2", description: "d", slug: "act-2" });
    await prisma.learningEvent.create({
      data: { userId: learner, courseId, eventType: LearningEventType.AttendanceStudentMarked, payload: {} },
    });
    expect(await prisma.learningEvent.count({ where: { userId: learner, courseId, ...learnerActivityWhere() } })).toBe(0);
  });
});
