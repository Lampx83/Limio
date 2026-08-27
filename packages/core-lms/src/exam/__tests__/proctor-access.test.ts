import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimProctorCode,
  createExam,
  createExamQuestion,
  ensureProctorCode,
  ensureDefaultRoomForSession,
  ensureDefaultSession,
  getProctorRoomView,
  publishExam,
  rotateProctorCode,
  setAttendanceByProctorCode,
} from "../";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `pa-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `pa-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 20,
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
    },
    points: 10,
  });
  await publishExam(owner.userId, examId);
  const sessionId = await ensureDefaultSession(examId);
  const { roomId } = await ensureDefaultRoomForSession(owner.userId, sessionId);
  return { ownerId: owner.userId, examId, sessionId, roomId };
}

async function addCandidate(examId: string, sessionId: string, roomId: string, name: string) {
  return prisma.examCandidate.create({
    data: {
      examId,
      sessionId,
      roomId,
      displayName: name,
      accessCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    select: { id: true },
  });
}

describe("mã giám thị", () => {
  it("sinh mã 8 ký tự, gọi lại trả đúng mã cũ", async () => {
    const s = await setup("gen");
    const a = await ensureProctorCode(s.roomId);
    expect(a).toHaveLength(8);
    const b = await ensureProctorCode(s.roomId);
    expect(b).toBe(a);
  });

  it("KHÔNG trùng mã phát cho thí sinh — đó là lý do cột này tồn tại", async () => {
    const s = await setup("distinct");
    const code = await ensureProctorCode(s.roomId);
    const room = await prisma.examRoom.findUniqueOrThrow({
      where: { id: s.roomId },
      select: { accessCode: true },
    });
    expect(code).not.toBe(room.accessCode);
    // Mã thí sinh 4 ký tự, mã giám thị 8 — không thể gõ nhầm mã này thành mã kia.
    expect(room.accessCode?.length).toBe(4);
  });

  it("đổi mã thì mã cũ chết ngay", async () => {
    const s = await setup("rotate");
    const old = await ensureProctorCode(s.roomId);
    const fresh = await rotateProctorCode(s.roomId);
    expect(fresh).not.toBe(old);
    await expect(claimProctorCode(old)).rejects.toBeTruthy();
    await expect(claimProctorCode(fresh)).resolves.toBeTruthy();
  });
});

describe("đổi mã lấy phòng", () => {
  it("mã đúng thì ra đúng phòng của mã đó", async () => {
    const s = await setup("claim");
    const code = await ensureProctorCode(s.roomId);
    const claim = await claimProctorCode(code);
    expect(claim.roomId).toBe(s.roomId);
    expect(claim.sessionId).toBe(s.sessionId);
  });

  it("mã sai, mã rỗng, mã sai độ dài đều bị từ chối", async () => {
    for (const bad of ["", "ABC", "K7M2QP4R", "k7m2qp4rx", null, 123]) {
      await expect(claimProctorCode(bad)).rejects.toBeTruthy();
    }
  });

  it("ca hẹn giờ đã hết giờ thì mã hết tác dụng", async () => {
    const s = await setup("closed-sched");
    const code = await ensureProctorCode(s.roomId);
    const now = Date.now();
    await prisma.examSession.update({
      where: { id: s.sessionId },
      data: {
        timingMode: "scheduled",
        opensAt: new Date(now - 3 * 60 * 60_000),
        closesAt: new Date(now - 60 * 60_000),
      },
    });
    await expect(claimProctorCode(code)).rejects.toBeTruthy();
  });

  it("ca thủ công GV đã bấm đóng thì mã hết tác dụng", async () => {
    const s = await setup("closed-man");
    const code = await ensureProctorCode(s.roomId);
    await prisma.examSession.update({
      where: { id: s.sessionId },
      data: { timingMode: "manual", status: "closed" },
    });
    await expect(claimProctorCode(code)).rejects.toBeTruthy();
  });
});

describe("màn phòng thi", () => {
  it("liệt kê thí sinh của ĐÚNG phòng đó", async () => {
    const s = await setup("view");
    await addCandidate(s.examId, s.sessionId, s.roomId, "An");
    await addCandidate(s.examId, s.sessionId, s.roomId, "Bình");

    const v = await getProctorRoomView(s.roomId);
    expect(v.candidates.map((c) => c.displayName)).toEqual(["An", "Bình"]);
    expect(v.totalQuestions).toBe(1);
    expect(v.candidates.every((c) => c.attemptStatus === null)).toBe(true);
  });

  it("điểm danh bật rồi tắt được", async () => {
    const s = await setup("att");
    const c = await addCandidate(s.examId, s.sessionId, s.roomId, "An");

    const on = await setAttendanceByProctorCode(s.roomId, c.id, true);
    expect(on.arrivedAt).not.toBeNull();
    const off = await setAttendanceByProctorCode(s.roomId, c.id, false);
    expect(off.arrivedAt).toBeNull();
  });

  it("cầm mã phòng A KHÔNG điểm danh được người phòng B", async () => {
    const a = await setup("room-a");
    const b = await setup("room-b");
    const victim = await addCandidate(b.examId, b.sessionId, b.roomId, "Người phòng B");

    await expect(
      setAttendanceByProctorCode(a.roomId, victim.id, true),
    ).rejects.toBeTruthy();
  });
});
