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
  getExamSession,
  resolveLobbyTarget,
  updateExamSession,
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

  it("ca đã đầy (maxCandidates): người mới bị chặn, người đã có trong danh sách và người vào lại thì không", async () => {
    const s = await setup("cap", { opensInMin: -5, closesInMin: 60 });
    const inRoster = await learner("cap-roster", "Có trong danh sách");
    const outsider = await learner("cap-out", "Người mới");
    // Danh sách có 1 thí sinh (email của inRoster) → đã dùng 1 chỗ; trần = 1.
    await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [{ examClassCode: "P1", displayName: "Có trong danh sách", email: inRoster.email }],
      BASE,
    );
    await prisma.examSession.update({ where: { id: s.sessionId }, data: { maxCandidates: 1 } });

    // Người ngoài danh sách: ca đã đủ số lượng → bị chặn, không tạo thí sinh.
    await expect(claimByAccount(s.code, outsider.userId)).rejects.toMatchObject({
      code: "open_max_attempts_reached",
    });
    expect(await prisma.examCandidate.count({ where: { sessionId: s.sessionId } })).toBe(1);

    // Người đã có trong danh sách vẫn vào được dù ca "đầy", và vào lại cũng được.
    const first = await claimByAccount(s.code, inRoster.userId);
    const again = await claimByAccount(s.code, inRoster.userId);
    expect(again.resumed).toBe(true);
    expect(again.attemptId).toBe(first.attemptId);
  });

  it("trần tính riêng từng ca: ca khác của cùng đề không bị ảnh hưởng", async () => {
    const a = await setup("cap-per-a", { opensInMin: -5, closesInMin: 60 });
    const first = await learner("cap-per-1", "Người một");
    const second = await learner("cap-per-2", "Người hai");
    // Ca B cùng đề với ca A.
    const now = Date.now();
    const { id: sessionB } = await createFormalSession(a.ownerId, {
      examId: a.examId,
      accessMode: "open_code",
      opensAt: new Date(now - 5 * MIN),
      closesAt: new Date(now + 60 * MIN),
    });
    const codeB = (
      await prisma.examSession.findUniqueOrThrow({
        where: { id: sessionB },
        select: { openCode: true },
      })
    ).openCode!;
    await prisma.examSession.update({ where: { id: a.sessionId }, data: { maxCandidates: 1 } });

    await claimByAccount(a.code, first.userId);
    // Ca A đầy → người hai bị chặn ở ca A, nhưng vào được ca B (không có trần).
    await expect(claimByAccount(a.code, second.userId)).rejects.toMatchObject({
      code: "open_max_attempts_reached",
    });
    const r = await claimByAccount(codeB, second.userId);
    expect(r.resumed).toBe(false);
  });

  it("giảng viên đặt và xoá trần của ca; trần sai bị từ chối", async () => {
    const s = await setup("cap-edit", { opensInMin: -5, closesInMin: 60 });
    await updateExamSession(s.ownerId, s.sessionId, { maxCandidates: 40 });
    expect((await getExamSession(s.ownerId, s.sessionId)).maxCandidates).toBe(40);
    await updateExamSession(s.ownerId, s.sessionId, { maxCandidates: null });
    expect((await getExamSession(s.ownerId, s.sessionId)).maxCandidates).toBeNull();
    await expect(
      updateExamSession(s.ownerId, s.sessionId, { maxCandidates: 0 }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("chưa tới trần thì người mới vào được", async () => {
    const s = await setup("cap-ok", { opensInMin: -5, closesInMin: 60 });
    const l = await learner("cap-ok");
    await prisma.examSession.update({ where: { id: s.sessionId }, data: { maxCandidates: 2 } });
    const r = await claimByAccount(s.code, l.userId);
    expect(r.resumed).toBe(false);
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

describe("resolveLobbyTarget — mã cá nhân (không cần tài khoản)", () => {
  it("trả thí sinh sở hữu mã và pha của ca; thí sinh bị vô hiệu hoá thì không", async () => {
    const owner = await registerUser(
      { email: `lobby-assigned-${Date.now()}@e.com`, password: "password1234", displayName: "GV" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C assigned",
      description: "x",
      slug: `lobby-course-assigned-${Date.now()}`,
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Đề assigned",
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
      accessMode: "assigned_code",
      opensAt: new Date(now + 5 * MIN),
      closesAt: new Date(now + 65 * MIN),
    });
    await importSessionRooms(
      owner.userId,
      sessionId,
      [{ examClassCode: "PA", displayName: "Thí sinh Một", mssv: "A001" }],
      BASE,
    );
    const cand = await prisma.examCandidate.findFirstOrThrow({
      where: { sessionId },
      select: { id: true, accessCode: true },
    });

    const t = await resolveLobbyTarget(cand.accessCode!);
    expect(t).not.toBeNull();
    expect(t!.mode).toBe("assigned");
    expect(t!.candidateId).toBe(cand.id);
    expect(t!.candidateName).toBe("Thí sinh Một");
    expect(t!.phase).toBe("lobby");

    await prisma.examCandidate.update({
      where: { id: cand.id },
      data: { disabledAt: new Date() },
    });
    expect(await resolveLobbyTarget(cand.accessCode!)).toBeNull();
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
