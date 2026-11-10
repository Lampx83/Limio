import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType, RoleName } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  closeOralExamSession,
  createExam,
  createOralMaterialTopicList,
  createOralTopic,
  ExamError,
  getLegacyOralReadiness,
  getOralSessionInfo,
  isLegacyOralDisabled,
  joinOralSessionByCode,
  openOralExamSession,
  publishExam,
  resolveOralJoinCode,
  setLegacyOralDisabled,
  startOralExamAttempt,
} from "../";
import { openForEnrolled } from "../../test/openForEnrolled";

const BASE = "http://localhost:3000";

async function makeAdmin() {
  const admin = await prisma.user.create({
    data: { email: "lo-admin@example.com", displayName: "Admin", passwordHash: "x" },
  });
  const role = await prisma.role.upsert({
    where: { name: RoleName.Admin },
    update: {},
    create: { name: RoleName.Admin },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  return admin.id;
}

async function oralSetup(slug: string) {
  const owner = await registerUser(
    { email: `lo-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `lo-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 20,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, { title: "Chủ đề", text: "Vòng lặp, đệ quy." });
  await publishExam(owner.userId, examId);
  await openForEnrolled(owner.userId, examId);
  const learner = await registerUser(
    { email: `lo-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return { ownerId: owner.userId, courseId: course.courseId, examId, learnerId: learner.userId };
}

async function expectDisabled(p: Promise<unknown>) {
  await expect(p).rejects.toMatchObject({ code: "legacy_oral_disabled" });
}

describe("công tắc tắt vấn đáp AI bản cũ", () => {
  it("mặc định bật; chỉ admin mới tắt được và việc tắt được ghi sự kiện", async () => {
    expect(await isLegacyOralDisabled()).toBe(false);
    const s = await oralSetup("auth");
    await expect(setLegacyOralDisabled(s.ownerId, true)).rejects.toBeInstanceOf(ExamError);
    expect(await isLegacyOralDisabled()).toBe(false);

    const admin = await makeAdmin();
    await setLegacyOralDisabled(admin, true);
    expect(await isLegacyOralDisabled()).toBe(true);
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralLegacySwitched, userId: admin },
    });
    expect(ev?.payload).toEqual({ disabled: true });

    await setLegacyOralDisabled(admin, false);
    expect(await isLegacyOralDisabled()).toBe(false);
  });

  it("khi tắt: không tạo đề vấn đáp mới, nhưng đề thi viết vẫn tạo được", async () => {
    const s = await oralSetup("create");
    await setLegacyOralDisabled(await makeAdmin(), true);
    const now = Date.now();
    const base = {
      title: "Đề",
      durationMin: 20,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 60 * 60_000),
    };
    await expectDisabled(createExam(s.ownerId, s.courseId, { ...base, kind: "oral" }));
    const written = await createExam(s.ownerId, s.courseId, { ...base, kind: "written" });
    expect(written.examId).toBeTruthy();
  });

  it("khi tắt: không sửa tài liệu/chủ đề của đề nháp và không mở buổi", async () => {
    const s = await oralSetup("edit");
    const now = Date.now();
    const draft = await createExam(s.ownerId, s.courseId, {
      title: "Nháp",
      durationMin: 20,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 60 * 60_000),
      kind: "oral",
    });
    await setLegacyOralDisabled(await makeAdmin(), true);
    await expectDisabled(
      createOralMaterialTopicList(s.ownerId, draft.examId, { title: "T", text: "Nội dung" }),
    );
    await expectDisabled(createOralTopic(s.ownerId, draft.examId, { title: "A", brief: "B" }));
    await expectDisabled(openOralExamSession(s.ownerId, draft.examId));
  });

  it("khi tắt: học viên mới không vào được bằng khoá học hay bằng mã", async () => {
    const s = await oralSetup("learner");
    const info = await getOralSessionInfo(s.examId);
    expect(info.joinCode).toBeTruthy();
    const second = await registerUser(
      { email: "lo-l2-learner@e.com", password: "password1234", displayName: "L2" },
      BASE,
    );
    await enrollInCourse(second.userId, s.courseId);

    await setLegacyOralDisabled(await makeAdmin(), true);
    await expectDisabled(startOralExamAttempt(second.userId, s.examId));
    await expectDisabled(joinOralSessionByCode(second.userId, info.joinCode!));
    expect((await resolveOralJoinCode(info.joinCode!))?.isOpen).toBe(false);
    expect(await prisma.examAttempt.count({ where: { examId: s.examId, userId: second.userId } })).toBe(0);
  });

  it("khi tắt: lượt đang làm dở vẫn được tiếp tục, đóng buổi vẫn được", async () => {
    const s = await oralSetup("resume");
    const started = await startOralExamAttempt(s.learnerId, s.examId);
    const info = await getOralSessionInfo(s.examId);

    await setLegacyOralDisabled(await makeAdmin(), true);
    const again = await startOralExamAttempt(s.learnerId, s.examId);
    expect(again).toMatchObject({ attemptId: started.attemptId, resumed: true });
    const viaCode = await joinOralSessionByCode(s.learnerId, info.joinCode!);
    expect(viaCode).toMatchObject({ attemptId: started.attemptId, resumed: true });

    await closeOralExamSession(s.ownerId, s.examId);
    expect((await getOralSessionInfo(s.examId)).open).toBe(false);
  });

  it("bật lại thì mọi thứ chạy lại như cũ", async () => {
    const s = await oralSetup("reenable");
    const admin = await makeAdmin();
    await setLegacyOralDisabled(admin, true);
    await setLegacyOralDisabled(admin, false);
    const r = await startOralExamAttempt(s.learnerId, s.examId);
    expect(r.resumed).toBe(false);
  });

  it("số liệu trước khi tắt: đề, buổi mở, lượt đang làm, bài chờ chấm", async () => {
    const empty = await getLegacyOralReadiness();
    expect(empty).toMatchObject({ disabled: false, openSessions: 0, inProgressAttempts: 0, awaitingGrading: 0 });
    expect(empty.exams.total).toBe(0);

    const s = await oralSetup("ready");
    await startOralExamAttempt(s.learnerId, s.examId);
    const mid = await getLegacyOralReadiness();
    expect(mid.exams).toEqual({ total: 1, draft: 0, published: 1 });
    expect(mid.openSessions).toBe(1);
    expect(mid.inProgressAttempts).toBe(1);
    expect(mid.awaitingGrading).toBe(0);

    await prisma.examAttempt.updateMany({
      where: { examId: s.examId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await closeOralExamSession(s.ownerId, s.examId);
    const after = await getLegacyOralReadiness();
    expect(after.openSessions).toBe(0);
    expect(after.inProgressAttempts).toBe(0);
    expect(after.awaitingGrading).toBe(1);
  });
});
