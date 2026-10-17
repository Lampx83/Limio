import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createCourseSection } from "../../courses/sections";
import { enrollInCourse } from "../../learning/enroll";
import {
  addSessionCandidatesFromSection,
  attachStudentCodes,
  candidateIssueMessage,
  createExam,
  createExamQuestion,
  createFormalSession,
  importSessionCandidates,
  listSessionCandidates,
  listSessionSections,
  listSectionStudents,
  publishExam,
  removeSessionCandidate,
  updateExamAccess,
  updateSessionCandidate,
} from "../";

const BASE = "http://localhost:3000";

async function user(tag: string, name = tag) {
  return registerUser(
    { email: `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
}

async function setup(slug: string, opts: { mssvCode?: boolean; mode?: "assigned_code" | "open_code" } = {}) {
  const owner = await user(`scand-${slug}`, "Owner");
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `scand-course-${slug}-${Date.now()}`,
  });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published" } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: `Đề ${slug}`, durationMin: 20 });
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
  if (opts.mssvCode) await updateExamAccess(owner.userId, examId, { assignedCodeSource: "student_code" });
  const { id: sessionId } = await createFormalSession(owner.userId, {
    examId,
    accessMode: opts.mode ?? "assigned_code",
  });
  return { ownerId: owner.userId, courseId: course.courseId, examId, sessionId };
}

describe("importSessionCandidates — dán danh sách thí sinh cho cả ca", () => {
  it("kiểm tra thử: báo đúng lỗi từng dòng và không lưu gì", async () => {
    const s = await setup("dry");
    const r = await importSessionCandidates(
      s.ownerId,
      s.sessionId,
      [
        { line: 2, displayName: "An", mssv: "1001", email: "an@sv.edu.vn" },
        { line: 3, displayName: "", mssv: "1002" },
        { line: 4, displayName: "Bình", mssv: "1001" },
        { line: 5, displayName: "Chi", email: "khong-phai-email" },
        { line: 6, displayName: "Dũng" }, // thiếu MSSV vẫn hợp lệ khi mã thi ngẫu nhiên
      ],
      { dryRun: true },
    );
    expect(r.saved).toBe(false);
    expect(r.valid).toBe(2);
    expect(r.invalid).toBe(3);
    const byLine = Object.fromEntries(r.rows.map((x) => [x.line, x.issue ? candidateIssueMessage(x.issue) : "ok"]));
    expect(byLine[2]).toBe("ok");
    expect(byLine[3]).toBe("Thiếu họ tên");
    expect(byLine[4]).toBe("Trùng MSSV với dòng 2");
    expect(byLine[5]).toBe("Email không đúng định dạng");
    expect(byLine[6]).toBe("ok");
    expect(await prisma.examCandidate.count({ where: { sessionId: s.sessionId } })).toBe(0);
  });

  it("lưu: chỉ dòng hợp lệ, chưa có phòng, có mã ngẫu nhiên, liên kết tài khoản theo email, ghi sự kiện", async () => {
    const s = await setup("save");
    const existing = await user("linked", "Có tài khoản");
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: existing.userId } })).email;
    const r = await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "An", mssv: "1001", email: email.toUpperCase() },
      { line: 3, displayName: "Bình", mssv: "1002" },
      { line: 4, displayName: "" },
    ]);
    expect(r.saved).toBe(true);
    expect(r.valid).toBe(2);
    const rows = await prisma.examCandidate.findMany({ where: { sessionId: s.sessionId }, orderBy: { displayName: "asc" } });
    expect(rows.map((c) => c.displayName)).toEqual(["An", "Bình"]);
    for (const c of rows) {
      expect(c.roomId).toBeNull();
      expect(c.accessCode).toMatch(/^[A-Z0-9]{8}$/);
    }
    expect(rows[0]!.userId).toBe(existing.userId);
    expect(rows[0]!.metadata).toMatchObject({ studentCode: "1001", email: email.toLowerCase() });

    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { eventType: LearningEventType.ExamCandidatesAdded, userId: s.ownerId },
      orderBy: { occurredAt: "desc" },
    });
    expect(ev.payload).toMatchObject({ sessionId: s.sessionId, added: 2, source: "paste" });
    expect(JSON.stringify(ev.payload)).not.toContain(rows[0]!.accessCode!);
  });

  it("dòng trùng với thí sinh đã có trong ca bị bỏ qua, kèm tên người đã có", async () => {
    const s = await setup("dup");
    await importSessionCandidates(s.ownerId, s.sessionId, [{ line: 2, displayName: "Nguyễn Văn An", mssv: "1001" }]);
    const r = await importSessionCandidates(
      s.ownerId,
      s.sessionId,
      [{ line: 2, displayName: "An khác", mssv: "1001" }],
      { dryRun: true },
    );
    expect(candidateIssueMessage(r.rows[0]!.issue!)).toBe("Đã có trong ca: Nguyễn Văn An");
  });

  it("mã thi là MSSV: thiếu MSSV là lỗi, mã thi = MSSV viết hoa, MSSV đã là mã ở ca khác bị chặn", async () => {
    const s = await setup("mssv", { mssvCode: true });
    const r = await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "An", mssv: "sv1001" },
      { line: 3, displayName: "Bình" },
    ]);
    expect(r.valid).toBe(1);
    expect(candidateIssueMessage(r.rows.find((x) => x.line === 3)!.issue!)).toBe(
      "Thiếu MSSV (bắt buộc vì mã thi là MSSV)",
    );
    const an = await prisma.examCandidate.findFirstOrThrow({ where: { sessionId: s.sessionId } });
    expect(an.accessCode).toBe("SV1001");

    const { id: other } = await createFormalSession(s.ownerId, { examId: s.examId, accessMode: "assigned_code" });
    const r2 = await importSessionCandidates(s.ownerId, other, [{ line: 2, displayName: "Trùng", mssv: "SV1001" }], {
      dryRun: true,
    });
    expect(r2.rows[0]!.issue?.kind).toBe("code_taken");
  });

  it("ca ở chế độ Tự do hoặc người không có quyền: bị từ chối", async () => {
    const s = await setup("open", { mode: "open_code" });
    await expect(
      importSessionCandidates(s.ownerId, s.sessionId, [{ line: 2, displayName: "An" }]),
    ).rejects.toMatchObject({ code: "validation_failed" });

    const s2 = await setup("forbid");
    const stranger = await user("stranger");
    await expect(
      importSessionCandidates(stranger.userId, s2.sessionId, [{ line: 2, displayName: "An" }]),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("mã lớp học và mã lớp thi khi dán Excel / gõ tay", () => {
  it("khớp lớp học theo mã hoặc tên (không phân biệt hoa thường), lưu lớp thi; lớp không có trong khoá là lỗi dòng", async () => {
    const s = await setup("cls");
    const k65a = await createCourseSection(s.ownerId, s.courseId, { name: "Lớp K65A" });
    await prisma.courseSection.update({ where: { id: k65a.id }, data: { code: "K65A" } });
    const k65b = await createCourseSection(s.ownerId, s.courseId, { name: "K65B" });
    const r = await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "An", mssv: "1", cohortCode: "k65a", examClassCode: "p101" },
      { line: 3, displayName: "Bình", mssv: "2", cohortCode: "K65B" },
      { line: 4, displayName: "Chi", mssv: "3", cohortCode: "K99" },
      { line: 5, displayName: "Dũng", mssv: "4", examClassCode: "P102" },
    ]);
    expect(r.valid).toBe(3);
    expect(candidateIssueMessage(r.rows.find((x) => x.line === 4)!.issue!)).toBe("Không có lớp K99 trong khoá học");

    const list = await listSessionCandidates(s.ownerId, s.sessionId);
    const by = Object.fromEntries(list.rows.map((x) => [x.displayName, x]));
    expect(by["An"]).toMatchObject({ cohortCode: "K65A", examClassCode: "P101" });
    expect(by["Bình"]).toMatchObject({ cohortCode: "K65B", examClassCode: null });
    expect(by["Dũng"]).toMatchObject({ cohortCode: null, examClassCode: "P102" });
    const an = await prisma.examCandidate.findFirstOrThrow({ where: { sessionId: s.sessionId, displayName: "An" } });
    expect(an.cohortId).toBe(k65a.id);
    expect(k65b.id).toBeTruthy();
  });

  it("lớp thi đã có trong khoá: tự suy ra lớp học; khai lớp học khác thì báo lỗi", async () => {
    const s = await setup("cls2");
    const k65a = await createCourseSection(s.ownerId, s.courseId, { name: "K65A" });
    await createCourseSection(s.ownerId, s.courseId, { name: "K65B" });
    await prisma.cohortExamClass.create({ data: { cohortId: k65a.id, courseId: s.courseId, code: "P101" } });
    const r = await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "An", examClassCode: "P101" },
      { line: 3, displayName: "Bình", examClassCode: "P101", cohortCode: "K65B" },
    ]);
    expect(r.valid).toBe(1);
    expect(candidateIssueMessage(r.rows.find((x) => x.line === 3)!.issue!)).toBe("Lớp thi P101 thuộc lớp K65A, không phải K65B");
    const an = await prisma.examCandidate.findFirstOrThrow({ where: { sessionId: s.sessionId } });
    expect(an.cohortId).toBe(k65a.id);
  });

  it("sửa lớp học và lớp thi của một thí sinh; bỏ trống là gỡ", async () => {
    const s = await setup("cls3");
    await createCourseSection(s.ownerId, s.courseId, { name: "K65A" });
    await importSessionCandidates(s.ownerId, s.sessionId, [{ line: 2, displayName: "An" }]);
    const id = (await listSessionCandidates(s.ownerId, s.sessionId)).rows[0]!.id;
    await updateSessionCandidate(s.ownerId, id, { cohortCode: "K65A", examClassCode: "p201" });
    let row = (await listSessionCandidates(s.ownerId, s.sessionId)).rows[0]!;
    expect(row).toMatchObject({ cohortCode: "K65A", examClassCode: "P201" });
    await expect(updateSessionCandidate(s.ownerId, id, { cohortCode: "K00" })).rejects.toMatchObject({
      code: "validation_failed",
      details: { reason: "cohort_not_found" },
    });
    await updateSessionCandidate(s.ownerId, id, { cohortCode: null, examClassCode: "" });
    row = (await listSessionCandidates(s.ownerId, s.sessionId)).rows[0]!;
    expect(row).toMatchObject({ cohortCode: null, examClassCode: null });
  });
});

describe("danh sách, sửa, xoá thí sinh của ca", () => {
  it("liệt kê thí sinh chưa có phòng, sửa tên và MSSV, xoá em chưa làm bài", async () => {
    const s = await setup("crud", { mssvCode: true });
    await importSessionCandidates(s.ownerId, s.sessionId, [
      { line: 2, displayName: "An", mssv: "1001" },
      { line: 3, displayName: "Bình", mssv: "1002" },
    ]);
    const list = await listSessionCandidates(s.ownerId, s.sessionId);
    expect(list.codeSource).toBe("student_code");
    expect(list.rows).toHaveLength(2);
    expect(list.rows[0]).toMatchObject({ roomName: null, mssv: "1001", accessCode: "1001", hasAttempt: false });

    const an = list.rows.find((x) => x.displayName === "An")!;
    await updateSessionCandidate(s.ownerId, an.id, { displayName: "Nguyễn Văn An", mssv: "1009" });
    const after = await prisma.examCandidate.findUniqueOrThrow({ where: { id: an.id } });
    expect(after.displayName).toBe("Nguyễn Văn An");
    expect(after.accessCode).toBe("1009");

    const binh = list.rows.find((x) => x.displayName === "Bình")!;
    await expect(updateSessionCandidate(s.ownerId, binh.id, { mssv: "1009" })).rejects.toMatchObject({
      code: "validation_failed",
      details: { reason: "mssv_used", name: "Nguyễn Văn An" },
    });

    await removeSessionCandidate(s.ownerId, binh.id);
    expect(await prisma.examCandidate.count({ where: { sessionId: s.sessionId } })).toBe(1);
    const removed = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamCandidateRemoved, userId: s.ownerId },
    });
    expect(removed).not.toBeNull();
  });
});

describe("lấy từ lớp học và ghép MSSV theo email", () => {
  async function withClass(slug: string, mssvCode = false) {
    const s = await setup(slug, { mssvCode });
    const section = await createCourseSection(s.ownerId, s.courseId, { name: "K65A" });
    const a = await user(`hv-a-${slug}`, "Học viên A");
    const b = await user(`hv-b-${slug}`, "Học viên B");
    const c = await user(`hv-c-${slug}`, "Học viên C"); // lớp mặc định
    await enrollInCourse(a.userId, s.courseId, prisma, { sectionId: section.id });
    await enrollInCourse(b.userId, s.courseId, prisma, { sectionId: section.id });
    await enrollInCourse(c.userId, s.courseId);
    return { ...s, sectionId: section.id, a, b, c };
  }

  it("liệt kê lớp kèm sĩ số, kể cả học viên chưa xếp lớp; đánh dấu em đã có trong ca", async () => {
    const s = await withClass("list");
    const sections = await listSessionSections(s.ownerId, s.sessionId);
    expect(sections.find((x) => x.id === s.sectionId)).toMatchObject({ name: "K65A", studentCount: 2, isDefault: false });
    expect(sections.find((x) => x.isDefault)).toMatchObject({ studentCount: 1 });

    await addSessionCandidatesFromSection(s.ownerId, s.sessionId, s.sectionId, [s.a.userId]);
    const students = await listSectionStudents(s.ownerId, s.sessionId, s.sectionId);
    expect(students.find((x) => x.userId === s.a.userId)?.alreadyInSession).toBe(true);
    expect(students.find((x) => x.userId === s.b.userId)?.alreadyInSession).toBe(false);
  });

  it("thêm từ lớp: liên kết tài khoản, lấy tên + email; bỏ qua em đã có hoặc không thuộc lớp", async () => {
    const s = await withClass("add");
    const r = await addSessionCandidatesFromSection(s.ownerId, s.sessionId, s.sectionId, [
      s.a.userId,
      s.b.userId,
      s.c.userId, // không thuộc K65A
    ]);
    expect(r).toEqual({ added: 2, skipped: 1 });
    const again = await addSessionCandidatesFromSection(s.ownerId, s.sessionId, s.sectionId, [s.a.userId]);
    expect(again).toEqual({ added: 0, skipped: 1 });
    const rows = await prisma.examCandidate.findMany({ where: { sessionId: s.sessionId } });
    expect(rows.map((x) => x.userId).sort()).toEqual([s.a.userId, s.b.userId].sort());
    expect(rows.every((x) => /^[A-Z0-9]{8}$/.test(x.accessCode ?? ""))).toBe(true);
    // Lấy từ lớp nào thì ghi lớp đó vào thí sinh — file xuất đọc được mã lớp học.
    expect(rows.every((x) => x.cohortId === s.sectionId)).toBe(true);
  });

  it("mã thi là MSSV: thêm từ lớp thì chưa có mã; dán cột MSSV ghép theo email thì có mã", async () => {
    const s = await withClass("attach", true);
    await addSessionCandidatesFromSection(s.ownerId, s.sessionId, s.sectionId, [s.a.userId, s.b.userId]);
    let list = await listSessionCandidates(s.ownerId, s.sessionId);
    expect(list.rows.every((x) => x.accessCode === null && x.needsMssv)).toBe(true);

    const emailA = (await prisma.user.findUniqueOrThrow({ where: { id: s.a.userId } })).email;
    const dry = await attachStudentCodes(
      s.ownerId,
      s.sessionId,
      [
        { line: 2, email: emailA, mssv: "2001" },
        { line: 3, email: "nobody@e.com", mssv: "2002" },
      ],
      { dryRun: true },
    );
    expect(dry.matched).toBe(1);
    expect(candidateIssueMessage(dry.rows.find((x) => x.line === 3)!.issue!)).toBe(
      "Không có thí sinh nào trong ca dùng email này",
    );
    list = await listSessionCandidates(s.ownerId, s.sessionId);
    expect(list.rows.every((x) => x.accessCode === null)).toBe(true);

    await attachStudentCodes(s.ownerId, s.sessionId, [{ line: 2, email: emailA, mssv: "2001" }]);
    list = await listSessionCandidates(s.ownerId, s.sessionId);
    const a = list.rows.find((x) => x.email === emailA.toLowerCase())!;
    expect(a).toMatchObject({ mssv: "2001", accessCode: "2001", needsMssv: false });
  });
});
