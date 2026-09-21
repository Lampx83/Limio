import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  addAdminToRound,
  addCandidatesToRoom,
  bulkCreateExamSessionsInRound,
  createExam,
  createExamQuestion,
  createExamRound,
  createExamRoom,
  createPassage,
  deleteExamRoom,
  deleteExamRound,
  deleteExamSession,
  moveCandidatesToRoom,
  publishExam,
  removeAdminFromRound,
  removeCandidateFromRoom,
  setManualSessionOpen,
  shareExamLink,
  updateExamRound,
  updateExamSession,
} from "../";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `oe-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `oe-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 86_400_000),
  });
  const { passageId } = await createPassage(owner.userId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({ data: { code: `oe.skill.${slug}`, name: "S" } });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
    },
    passageId,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);
  return { ownerId: owner.userId, courseId: course.courseId, examId };
}

const eventsOf = (userId: string, type: string) =>
  prisma.learningEvent.findMany({ where: { userId, eventType: type }, orderBy: { occurredAt: "asc" } });

describe("nhóm tổ chức thi — mọi thay đổi để lại LearningEvent", () => {
  it("đợt thi: tạo, sửa (kèm trạng thái cũ/mới), xoá", async () => {
    const { ownerId, courseId } = await setup("round");
    const { id: roundId } = await createExamRound(ownerId, { courseId, code: "OE-R1", title: "Đợt 1" });
    let ev = await eventsOf(ownerId, LearningEventType.ExamRoundCreated);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.courseId).toBe(courseId);
    expect(ev[0]!.payload).toMatchObject({ roundId, title: "Đợt 1" });

    await updateExamRound(ownerId, roundId, { status: "open", title: "Đợt 1 (sửa)" });
    ev = await eventsOf(ownerId, LearningEventType.ExamRoundUpdated);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({
      roundId,
      statusFrom: "draft",
      statusTo: "open",
      fields: expect.arrayContaining(["status", "title"]),
    });

    await deleteExamRound(ownerId, roundId);
    ev = await eventsOf(ownerId, LearningEventType.ExamRoundDeleted);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.courseId).toBe(courseId); // lấy trước khi xoá, dù đợt đã mất
    expect(ev[0]!.payload).toMatchObject({ roundId });
  });

  it("đổi quyền trưởng đợt được ghi lại (audit đổi vai trò)", async () => {
    const { ownerId, courseId } = await setup("admin");
    const { id: roundId } = await createExamRound(ownerId, { courseId, code: "OE-R2", title: "Đợt" });
    const other = await registerUser(
      { email: "oe-admin-2@e.com", password: "password1234", displayName: "B" },
      BASE,
    );
    await addAdminToRound(ownerId, roundId, other.userId);
    await removeAdminFromRound(ownerId, roundId, other.userId);
    const added = await eventsOf(ownerId, LearningEventType.ExamRoundAdminAdded);
    const removed = await eventsOf(ownerId, LearningEventType.ExamRoundAdminRemoved);
    expect(added[0]!.payload).toMatchObject({ roundId, targetUserId: other.userId });
    expect(removed[0]!.payload).toMatchObject({ roundId, targetUserId: other.userId });
  });

  it("ca thi: tạo hàng loạt, sửa, mở/đóng thủ công, xoá", async () => {
    const { ownerId, courseId, examId } = await setup("session");
    const { id: roundId } = await createExamRound(ownerId, { courseId, code: "OE-R3", title: "Đợt" });
    const { sessionIds } = await bulkCreateExamSessionsInRound(ownerId, roundId, { examId, count: 2 });
    let ev = await eventsOf(ownerId, LearningEventType.ExamSessionCreated);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ roundId, sessionIds, bulk: true });

    await updateExamSession(ownerId, sessionIds[0]!, { title: "Ca sáng" });
    ev = await eventsOf(ownerId, LearningEventType.ExamSessionUpdated);
    expect(ev[0]!.payload).toMatchObject({ sessionId: sessionIds[0], fields: ["title"] });

    // ca thủ công: mở rồi đóng
    const s = await prisma.examSession.findUniqueOrThrow({ where: { id: sessionIds[1]! } });
    await prisma.examSession.update({ where: { id: s.id }, data: { timingMode: "manual", closesAt: null } });
    await setManualSessionOpen(ownerId, s.id, true);
    await setManualSessionOpen(ownerId, s.id, false);
    expect(await eventsOf(ownerId, LearningEventType.ExamSessionOpened)).toHaveLength(1);
    expect(await eventsOf(ownerId, LearningEventType.ExamSessionClosed)).toHaveLength(1);

    await deleteExamSession(ownerId, sessionIds[0]!);
    ev = await eventsOf(ownerId, LearningEventType.ExamSessionDeleted);
    expect(ev[0]!.payload).toMatchObject({ sessionId: sessionIds[0] });
  });

  it("phòng và thí sinh: tạo phòng, thêm/chuyển/xoá thí sinh, xoá phòng — không lộ mã truy cập", async () => {
    const { ownerId, courseId, examId } = await setup("room");
    const { id: roundId } = await createExamRound(ownerId, { courseId, code: "OE-R4", title: "Đợt" });
    await bulkCreateExamSessionsInRound(ownerId, roundId, {
      examId,
      count: 1,
      accessMode: "assigned_code",
    });
    const room1 = await createExamRoom(ownerId, examId, { name: "P1", proctorUserId: ownerId });
    const room2 = await createExamRoom(ownerId, examId, { name: "P2", proctorUserId: ownerId });
    // Phòng tạo qua createExamRoom nằm ở ca/đợt mặc định của đề; thao tác thí sinh
    // cần quyền trưởng đợt của đợt đó.
    const home = await prisma.examRoom.findUniqueOrThrow({
      where: { id: room1.id },
      select: { session: { select: { roundId: true } } },
    });
    await prisma.examRoundAdmin.upsert({
      where: { roundId_userId: { roundId: home.session.roundId, userId: ownerId } },
      create: { roundId: home.session.roundId, userId: ownerId },
      update: {},
    });
    expect(await eventsOf(ownerId, LearningEventType.ExamRoomCreated)).toHaveLength(2);

    const added = await addCandidatesToRoom(ownerId, room1.id, {
      candidates: [
        { displayName: "SV A", mssv: "A1" },
        { displayName: "SV B", mssv: "B1" },
      ],
    });
    expect(added.added).toBe(2);
    const cands = await prisma.examCandidate.findMany({ where: { roomId: room1.id } });
    await moveCandidatesToRoom(ownerId, room2.id, [cands[0]!.id]);
    await removeCandidateFromRoom(ownerId, cands[1]!.id);

    const evAdded = await eventsOf(ownerId, LearningEventType.ExamCandidatesAdded);
    const evMoved = await eventsOf(ownerId, LearningEventType.ExamCandidatesMoved);
    const evRemoved = await eventsOf(ownerId, LearningEventType.ExamCandidateRemoved);
    expect(evAdded[0]!.payload).toMatchObject({ roomId: room1.id, added: 2 });
    expect(evMoved[0]!.payload).toMatchObject({ toRoomId: room2.id, moved: 1 });
    expect(evRemoved[0]!.payload).toMatchObject({ candidateId: cands[1]!.id, roomId: room1.id });

    // Mã dự thi là bí mật: không được xuất hiện trong bảng sự kiện.
    const all = await prisma.learningEvent.findMany({ where: { userId: ownerId } });
    const blob = JSON.stringify(all.map((e) => e.payload));
    for (const c of cands) expect(blob).not.toContain(c.accessCode ?? "__none__");

    await deleteExamRoom(ownerId, room2.id);
    const del = await eventsOf(ownerId, LearningEventType.ExamRoomDeleted);
    expect(del[0]!.payload).toMatchObject({ roomId: room2.id });
  });

  it("link thi nhanh: ghi lại lượt mở, không lộ mã mở", async () => {
    const { ownerId, examId } = await setup("share");
    const r = await shareExamLink(ownerId, examId, { timingMode: "manual", durationMin: 15 });
    const ev = await eventsOf(ownerId, LearningEventType.ExamShareLinkOpened);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ examId, sessionId: r.sessionId });
    expect(JSON.stringify(ev[0]!.payload)).not.toContain(r.code);
  });
});
