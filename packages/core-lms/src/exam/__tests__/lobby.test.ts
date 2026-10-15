import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByAccount,
  createExam,
  createExamQuestion,
  createFormalSession,
  importSessionRooms,
  LOBBY_LEAD_MIN,
  lobbyPhase,
  publishExam,
  resolveLobbyTarget,
} from "../";

const BASE = "http://localhost:3000";
const MIN = 60_000;

async function setup(slug: string, window: { opensInMin: number; closesInMin: number }) {
  const owner = await registerUser(
    { email: `lobby-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `lobby-course-${slug}`,
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
  const now = Date.now();
  const { id: sessionId } = await createFormalSession(owner.userId, {
    examId,
    accessMode: "open_code",
    opensAt: new Date(now + window.opensInMin * MIN),
    closesAt: new Date(now + window.closesInMin * MIN),
  });
  const row = await prisma.examSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { openCode: true },
  });
  return { ownerId: owner.userId, examId, sessionId, code: row.openCode! };
}

async function learner(slug: string, displayName = "Học viên A") {
  const u = await registerUser(
    { email: `lobby-learner-${slug}@e.com`, password: "password1234", displayName },
    BASE,
  );
  return { userId: u.userId, email: `lobby-learner-${slug}@e.com`, displayName };
}

describe("lobbyPhase — pure", () => {
  const now = new Date("2026-10-14T08:00:00Z");
  const at = (min: number) => new Date(now.getTime() + min * MIN);
  const sched = { timingMode: "scheduled" as const, status: "draft" as const };

  it("trước giờ mở hơn LOBBY_LEAD_MIN phút: chưa cho vào lobby", () => {
    expect(
      lobbyPhase({ ...sched, opensAt: at(LOBBY_LEAD_MIN + 5), closesAt: at(120) }, now),
    ).toBe("before");
  });
  it("trong khoảng LOBBY_LEAD_MIN phút trước giờ mở: lobby", () => {
    expect(
      lobbyPhase({ ...sched, opensAt: at(LOBBY_LEAD_MIN - 1), closesAt: at(120) }, now),
    ).toBe("lobby");
  });
  it("đến giờ mở: open; qua giờ đóng: closed", () => {
    expect(lobbyPhase({ ...sched, opensAt: at(-1), closesAt: at(60) }, now)).toBe("open");
    expect(lobbyPhase({ ...sched, opensAt: at(-120), closesAt: at(-1) }, now)).toBe("closed");
  });
  it("ca thủ công: nháp là lobby, đã mở là open, đã đóng là closed", () => {
    const base = { opensAt: at(-60), closesAt: null, timingMode: "manual" as const };
    expect(lobbyPhase({ ...base, status: "draft" }, now)).toBe("lobby");
    expect(lobbyPhase({ ...base, status: "open" }, now)).toBe("open");
    expect(lobbyPhase({ ...base, status: "closed" }, now)).toBe("closed");
  });
});

describe("claimByAccount — vào thi bằng tài khoản, không hỏi tên/MSSV", () => {
  it("ca chưa tới giờ: vẫn ở lobby, KHÔNG tạo lượt làm (không trừ giờ khi chờ)", async () => {
    const s = await setup("early", { opensInMin: 5, closesInMin: 65 });
    const l = await learner("early");
    await expect(claimByAccount(s.code, l.userId)).rejects.toMatchObject({ code: "exam_not_open" });
    expect(await prisma.examAttempt.count({ where: { sessionId: s.sessionId } })).toBe(0);
  });

  it("ca đã mở: tạo thí sinh từ tài khoản, vào phòng mặc định, tạo lượt làm đang làm", async () => {
    const s = await setup("open", { opensInMin: -5, closesInMin: 60 });
    const l = await learner("open");
    const r = await claimByAccount(s.code, l.userId);

    expect(r.resumed).toBe(false);
    expect(r.displayName).toBe("Học viên A");
    const cand = await prisma.examCandidate.findUniqueOrThrow({
      where: { id: r.candidateId },
      select: { userId: true, displayName: true, roomId: true, sessionId: true },
    });
    expect(cand.userId).toBe(l.userId);
    expect(cand.displayName).toBe("Học viên A");
    expect(cand.sessionId).toBe(s.sessionId);
    expect(cand.roomId).not.toBeNull();
    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: r.attemptId },
      select: { status: true, candidateDisplayName: true },
    });
    expect(attempt.status).toBe("in_progress");
    expect(attempt.candidateDisplayName).toBe("Học viên A");
  });

  it("bấm lại thì tiếp tục đúng lượt đang làm, không tạo lượt thứ hai", async () => {
    const s = await setup("again", { opensInMin: -5, closesInMin: 60 });
    const l = await learner("again");
    const first = await claimByAccount(s.code, l.userId);
    const second = await claimByAccount(s.code, l.userId);
    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.candidateId).toBe(first.candidateId);
    expect(await prisma.examAttempt.count({ where: { sessionId: s.sessionId } })).toBe(1);
  });

  it("thí sinh đã có trong danh sách nhập (theo email) giữ đúng phòng đã xếp", async () => {
    const s = await setup("roster", { opensInMin: -5, closesInMin: 60 });
    const l = await learner("roster");
    // Nhập danh sách: phòng P9 kèm thí sinh có email của tài khoản này.
    const imp = await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [{ examClassCode: "P9", displayName: "Tên trong danh sách", email: l.email }],
      BASE,
    );
    expect(imp.candidatesAdded).toBe(1);
    const p9 = await prisma.examRoom.findFirstOrThrow({
      where: { sessionId: s.sessionId, name: "P9" },
      select: { id: true },
    });

    const r = await claimByAccount(s.code, l.userId);
    const cand = await prisma.examCandidate.findUniqueOrThrow({
      where: { id: r.candidateId },
      select: { roomId: true, userId: true },
    });
    expect(cand.roomId).toBe(p9.id);
    expect(cand.userId).toBe(l.userId);
    expect(await prisma.examCandidate.count({ where: { sessionId: s.sessionId } })).toBe(1);
  });

  it("ca đã đóng: báo đã đóng", async () => {
    const s = await setup("closed", { opensInMin: -120, closesInMin: -1 });
    const l = await learner("closed");
    await expect(claimByAccount(s.code, l.userId)).rejects.toMatchObject({
      code: "exam_window_closed",
    });
  });

  it("mã không hợp lệ hoặc không phải mã chung: từ chối", async () => {
    const l = await learner("badcode");
    await expect(claimByAccount("XX", l.userId)).rejects.toMatchObject({ code: "invalid_code" });
    await expect(claimByAccount("ZZZZZZZZ", l.userId)).rejects.toMatchObject({
      code: "invalid_code",
    });
  });
});

describe("resolveLobbyTarget", () => {
  it("trả đúng ca, mã và pha theo cửa sổ thời gian", async () => {
    const s = await setup("resolve", { opensInMin: 5, closesInMin: 65 });
    const t = await resolveLobbyTarget(s.code);
    expect(t).not.toBeNull();
    expect(t!.sessionId).toBe(s.sessionId);
    expect(t!.mode).toBe("open");
    expect(t!.phase).toBe("lobby");
    expect(t!.ready).toBe(true);
  });
});
