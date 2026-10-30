import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createCourseSection } from "../../courses/sections";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  createFormalSession,
  importSessionCandidates,
  importSessionRooms,
  listSessionRosterResults,
  publishExam,
} from "../";

const BASE = "http://localhost:3000";

async function user(tag: string, name = tag) {
  return registerUser(
    { email: `rr-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
}

async function setup(slug: string) {
  const owner = await user(`own-${slug}`, "Owner");
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `rr-${slug}-${Date.now()}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published" } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: `Đề ${slug}`, durationMin: 20 });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
    points: 10,
  });
  await publishExam(owner.userId, examId);
  const { id: sessionId } = await createFormalSession(owner.userId, { examId, accessMode: "assigned_code" });
  return { ownerId: owner.userId, courseId: course.courseId, examId, sessionId };
}

async function attempt(
  s: { examId: string; sessionId: string },
  who: { candidateId?: string; userId?: string },
  data: { status: "in_progress" | "submitted" | "graded"; score?: number; submittedAt?: Date; startedAt?: Date },
) {
  return prisma.examAttempt.create({
    data: {
      examId: s.examId,
      sessionId: s.sessionId,
      candidateId: who.candidateId,
      userId: who.userId,
      durationSec: 1200,
      status: data.status,
      score: data.score ?? null,
      scorePct: data.score != null ? data.score * 10 : null,
      submittedAt: data.submittedAt ?? null,
      startedAt: data.startedAt ?? new Date(),
    },
  });
}

describe("listSessionRosterResults — kết quả theo ca, mỗi dòng một thí sinh", () => {
  it("có cả em chưa vào thi; thí sinh vào bằng mã có đúng một lượt (DB chỉ cho một bài mỗi đề)", async () => {
    const s = await setup("roster");
    await createCourseSection(s.ownerId, s.courseId, { name: "K65A" });
    await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "Nguyễn Văn An", mssv: "1001", cohortCode: "K65A", examClassCode: "P101" },
      { line: 3, displayName: "Trần Thị Bình", mssv: "1002" },
    ]);
    const an = await prisma.examCandidate.findFirstOrThrow({ where: { sessionId: s.sessionId, displayName: "Nguyễn Văn An" } });
    await attempt(s, { candidateId: an.id }, { status: "submitted", score: 7, submittedAt: new Date("2026-10-01T08:40:00Z") });

    const r = await listSessionRosterResults(s.ownerId, s.sessionId);
    expect(r.totalPoints).toBe(10);
    expect(r.rows).toHaveLength(2);
    const rowAn = r.rows.find((x) => x.displayName === "Nguyễn Văn An")!;
    expect(rowAn).toMatchObject({
      mssv: "1001",
      cohortCode: "K65A",
      examClassCode: "P101",
      status: "submitted",
      score: 7,
      attemptCount: 1,
    });
    expect(r.rows.find((x) => x.displayName === "Trần Thị Bình")).toMatchObject({
      status: "not_started",
      score: null,
      attemptCount: 0,
      cohortCode: null,
      examClassCode: null,
    });
  });

  it("học viên đăng nhập thi nhiều lượt: lấy lượt nộp gần nhất và đếm số lượt", async () => {
    const s = await setup("multi");
    const hv = await user("hv-multi", "Học viên Em");
    await enrollInCourse(hv.userId, s.courseId, prisma);
    await attempt(s, { userId: hv.userId }, { status: "submitted", score: 4, submittedAt: new Date("2026-10-01T08:10:00Z") });
    await attempt(s, { userId: hv.userId }, { status: "submitted", score: 7, submittedAt: new Date("2026-10-01T08:40:00Z") });
    await attempt(s, { userId: hv.userId }, { status: "in_progress" });

    const r = await listSessionRosterResults(s.ownerId, s.sessionId);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ displayName: "Học viên Em", status: "submitted", score: 7, attemptCount: 3 });
  });

  it("đếm số lần chuyển tab của lượt được tính điểm (chỉ tab_blur); MSSV tài khoản lấy từ hồ sơ", async () => {
    const s = await setup("tabs");
    const hv = await user("hv-tabs", "Học viên Tab");
    await prisma.user.update({ where: { id: hv.userId }, data: { studentCode: "20201234" } });
    const att = await attempt(s, { userId: hv.userId }, { status: "submitted", score: 5, submittedAt: new Date("2026-10-01T08:40:00Z") });
    await prisma.examIncident.createMany({
      data: [
        { attemptId: att.id, type: "tab_blur", occurredAt: new Date("2026-10-01T08:10:00Z") },
        { attemptId: att.id, type: "tab_blur", occurredAt: new Date("2026-10-01T08:20:00Z") },
        { attemptId: att.id, type: "paste" },
      ],
    });

    const r = await listSessionRosterResults(s.ownerId, s.sessionId);
    expect(r.rows[0]).toMatchObject({ displayName: "Học viên Tab", mssv: "20201234", tabSwitchCount: 2 });
  });

  it("phòng nhập từ Excel: mã lớp thi = tên phòng, mã lớp học = lớp sở hữu lớp thi", async () => {
    const s = await setup("rooms");
    await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [{ examClassCode: "P201", cohortCode: "K66", displayName: "Chi", mssv: "2001" }],
      BASE,
    );
    const r = await listSessionRosterResults(s.ownerId, s.sessionId);
    expect(r.rows[0]).toMatchObject({ displayName: "Chi", roomName: "P201", examClassCode: "P201", cohortCode: "K66" });
  });

  it("học viên vào bằng tài khoản không có thí sinh: một dòng, lớp học theo lớp ghi danh", async () => {
    const s = await setup("acct");
    const sec = await createCourseSection(s.ownerId, s.courseId, { name: "K67" });
    const hv = await user("hv", "Học viên Dũng");
    await enrollInCourse(hv.userId, s.courseId, prisma, { sectionId: sec.id });
    await attempt(s, { userId: hv.userId }, { status: "graded", score: 9, submittedAt: new Date() });
    const r = await listSessionRosterResults(s.ownerId, s.sessionId);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ displayName: "Học viên Dũng", cohortCode: "K67", status: "graded", score: 9, attemptCount: 1 });
  });

  it("xếp theo mã lớp thi rồi theo tên riêng; người không có quyền bị từ chối", async () => {
    const s = await setup("sort");
    await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "Lê Văn Bình", examClassCode: "P2" },
      { line: 3, displayName: "Trần Văn An", examClassCode: "P2" },
      { line: 4, displayName: "Phạm Thị Chi", examClassCode: "P1" },
      { line: 5, displayName: "Vũ Hà" },
    ]);
    const r = await listSessionRosterResults(s.ownerId, s.sessionId);
    expect(r.rows.map((x) => x.displayName)).toEqual(["Phạm Thị Chi", "Trần Văn An", "Lê Văn Bình", "Vũ Hà"]);

    const stranger = await user("stranger");
    await expect(listSessionRosterResults(stranger.userId, s.sessionId)).rejects.toMatchObject({ code: "forbidden" });
  });
});
