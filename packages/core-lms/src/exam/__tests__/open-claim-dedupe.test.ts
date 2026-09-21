import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByOpenCode,
  createExam,
  createExamQuestion,
  createPassage,
  ensureDefaultSession,
  grantAttemptReentry,
  publishExam,
} from "../";
import { capDurationToWindow, EXAM_CLOSE_GRACE_SEC } from "../session-window";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

/** Ca open_code đang mở, đóng sau `closesInMin` phút; đề dài 60 phút. */
async function setup(slug: string, closesInMin = 120) {
  const owner = await registerUser(
    { email: `oc-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `oc-course-${slug}`,
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
  const skill = await prisma.skill.create({ data: { code: `oc.skill.${slug}`, name: "S" } });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q1",
    config: mcq(),
    passageId,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);
  const sessionId = await ensureDefaultSession(examId);
  const code = `OC${slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)}`.padEnd(6, "X");
  await prisma.exam.update({ where: { id: examId }, data: { accessMode: "open_code" } });
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      accessMode: "open_code",
      openCode: code,
      opensAt: new Date(now - 60 * 60_000),
      closesAt: new Date(now + closesInMin * 60_000),
    },
  });
  return { examId, sessionId, code, ownerId: owner.userId };
}

const student = (over: Record<string, string> = {}) => ({
  displayName: "Nguyễn Văn A",
  studentCode: "SV-001",
  ...over,
});

describe("mã thi mở — một MSSV một bài trong một ca", () => {
  it("nhập lại cùng MSSV + họ tên khi bài đang làm: tiếp tục bài cũ, không tạo bài mới", async () => {
    const { code, sessionId } = await setup("resume");
    const first = await claimByOpenCode(code, student());
    const second = await claimByOpenCode(code, student());

    expect(second.attemptId).toBe(first.attemptId);
    expect(second.resumed).toBe(true);
    expect(second.sessionToken).not.toBe(first.sessionToken); // máy mới nhận khoá
    expect(await prisma.examAttempt.count({ where: { sessionId } })).toBe(1);
    expect(await prisma.examCandidate.count({ where: { sessionId } })).toBe(1);
  });

  it("họ tên khác dấu/hoa thường/khoảng trắng vẫn coi là cùng người", async () => {
    const { code } = await setup("norm");
    const first = await claimByOpenCode(code, student());
    const again = await claimByOpenCode(code, student({ displayName: "  nguyễn  văn a " }));
    expect(again.attemptId).toBe(first.attemptId);
  });

  it("MSSV trùng nhưng họ tên khác: từ chối (không cho chiếm phiên của người khác)", async () => {
    const { code, sessionId } = await setup("hijack");
    const first = await claimByOpenCode(code, student());
    await expect(
      claimByOpenCode(code, student({ displayName: "Trần Thị B" })),
    ).rejects.toMatchObject({ code: "student_code_in_use" });
    // Phiên của người thật không bị xoay khoá.
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
    expect(a.sessionToken).toBe(first.sessionToken);
    expect(await prisma.examAttempt.count({ where: { sessionId } })).toBe(1);
  });

  it("đã nộp rồi thì không thi lại", async () => {
    const { code } = await setup("done");
    const first = await claimByOpenCode(code, student());
    await prisma.examAttempt.update({
      where: { id: first.attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await expect(claimByOpenCode(code, student())).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });

  it("MSSV khác thì vào bình thường", async () => {
    const { code, sessionId } = await setup("other");
    await claimByOpenCode(code, student());
    await claimByOpenCode(code, student({ studentCode: "SV-002", displayName: "Lê C" }));
    expect(await prisma.examAttempt.count({ where: { sessionId } })).toBe(2);
  });

  it("hai lượt vào đồng thời (bấm đúp): chỉ có một bài", async () => {
    const { code, sessionId } = await setup("race");
    const [a, b] = await Promise.all([
      claimByOpenCode(code, student()),
      claimByOpenCode(code, student()),
    ]);
    expect(a.attemptId).toBe(b.attemptId);
    expect(await prisma.examAttempt.count({ where: { sessionId } })).toBe(1);
  });
});

describe("vào lại bài — yếu tố xác thực là email/SĐT đã nhập lần đầu", () => {
  it("lần đầu có email: nhập lại đúng email thì vào lại được, dù gõ sai họ tên", async () => {
    const { code, sessionId } = await setup("mail-ok");
    const first = await claimByOpenCode(code, student({ email: "sv001@example.com" }));
    const again = await claimByOpenCode(
      code,
      student({ displayName: "Gõ sai tên", email: "SV001@Example.com" }), // khác hoa/thường
    );
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.resumed).toBe(true);
    expect(await prisma.examAttempt.count({ where: { sessionId } })).toBe(1);
  });

  it("lần đầu có email: đúng họ tên nhưng thiếu email thì bị từ chối", async () => {
    const { code } = await setup("mail-missing");
    const first = await claimByOpenCode(code, student({ email: "sv001@example.com" }));
    await expect(claimByOpenCode(code, student())).rejects.toMatchObject({
      code: "student_code_in_use",
    });
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
    expect(a.sessionToken).toBe(first.sessionToken); // phiên người thật không bị xoay
  });

  it("lần đầu có email: email khác bị từ chối dù đúng họ tên", async () => {
    const { code } = await setup("mail-wrong");
    await claimByOpenCode(code, student({ email: "sv001@example.com" }));
    await expect(
      claimByOpenCode(code, student({ email: "nguoi.khac@example.com" })),
    ).rejects.toMatchObject({ code: "student_code_in_use" });
  });

  it("lần đầu có SĐT: nhập lại khác định dạng vẫn khớp", async () => {
    const { code } = await setup("phone");
    const first = await claimByOpenCode(code, student({ phone: "0900000000" }));
    const again = await claimByOpenCode(code, student({ phone: "0900 000 000" }));
    expect(again.attemptId).toBe(first.attemptId);
  });

  it("lần đầu có cả hai: khớp một trong hai là đủ", async () => {
    const { code } = await setup("both");
    const first = await claimByOpenCode(
      code,
      student({ email: "sv001@example.com", phone: "0900000000" }),
    );
    const again = await claimByOpenCode(code, student({ phone: "0900000000" }));
    expect(again.attemptId).toBe(first.attemptId);
  });

  it("lần đầu KHÔNG có email/SĐT: quay về dùng họ tên (không khoá người ta ra ngoài)", async () => {
    const { code } = await setup("fallback");
    const first = await claimByOpenCode(code, student());
    const again = await claimByOpenCode(code, student({ displayName: "nguyễn văn a" }));
    expect(again.attemptId).toBe(first.attemptId);
    // và cũng không nhận email/SĐT mới thay cho họ tên sai
    await expect(
      claimByOpenCode(code, student({ displayName: "Người khác", email: "x@example.com" })),
    ).rejects.toMatchObject({ code: "student_code_in_use" });
  });
});

describe("giảng viên cho vào lại (gỡ kẹt khi sinh viên quên email/SĐT)", () => {
  it("sau khi cho vào lại: nhập MSSV với thông tin khác vẫn vào được bài cũ, và chỉ MỘT lần", async () => {
    const { code, ownerId } = await setup("grant", 120);
    const first = await claimByOpenCode(code, student({ email: "goc@example.com" }));
    await grantAttemptReentry(ownerId, first.attemptId);

    const again = await claimByOpenCode(code, student({ email: "moi@example.com" }));
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.resumed).toBe(true);

    // Quyền đã dùng hết: người khác nhập email lạ không vào được nữa...
    await expect(
      claimByOpenCode(code, student({ email: "ke.gian@example.com" })),
    ).rejects.toMatchObject({ code: "student_code_in_use" });
    // ...còn email vừa nhập sau khi được cho vào lại trở thành yếu tố mới.
    const third = await claimByOpenCode(code, student({ email: "moi@example.com" }));
    expect(third.attemptId).toBe(first.attemptId);
    // Email cũ không còn giá trị.
    await expect(
      claimByOpenCode(code, student({ email: "goc@example.com" })),
    ).rejects.toMatchObject({ code: "student_code_in_use" });
  });

  it("quyền vào lại hết hạn thì không còn tác dụng", async () => {
    const { code, ownerId } = await setup("grant-exp", 120);
    const first = await claimByOpenCode(code, student({ email: "goc@example.com" }));
    await grantAttemptReentry(ownerId, first.attemptId);
    const a = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: first.attemptId },
      select: { candidateId: true },
    });
    const c = await prisma.examCandidate.findUniqueOrThrow({ where: { id: a.candidateId! } });
    await prisma.examCandidate.update({
      where: { id: c.id },
      data: {
        metadata: {
          ...(c.metadata as object),
          reentryGrantedUntil: new Date(Date.now() - 1000).toISOString(),
        },
      },
    });
    await expect(
      claimByOpenCode(code, student({ email: "moi@example.com" })),
    ).rejects.toMatchObject({ code: "student_code_in_use" });
  });

  it("người không có quyền thì không cho vào lại được", async () => {
    const { code } = await setup("grant-authz", 120);
    const first = await claimByOpenCode(code, student());
    const stranger = await registerUser(
      { email: "oc-stranger@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(grantAttemptReentry(stranger.userId, first.attemptId)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("bài đã nộp thì không cho vào lại", async () => {
    const { code, ownerId } = await setup("grant-done", 120);
    const first = await claimByOpenCode(code, student());
    await prisma.examAttempt.update({
      where: { id: first.attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await expect(grantAttemptReentry(ownerId, first.attemptId)).rejects.toMatchObject({
      code: "attempt_not_in_progress",
    });
  });

  it("bài của học viên đăng nhập (không có MSSV) không dùng được thao tác này", async () => {
    const { examId, ownerId } = await setup("grant-user", 120);
    const u = await registerUser(
      { email: "oc-user@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    const a = await prisma.examAttempt.create({
      data: { examId, userId: u.userId, durationSec: 3600 },
    });
    await expect(grantAttemptReentry(ownerId, a.id)).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("thời hạn làm bài không vượt quá giờ đóng ca", () => {
  it("capDurationToWindow: cắt theo closesAt + grace, không cắt khi ca thủ công", () => {
    const now = new Date("2026-09-22T09:00:00Z");
    const closes = new Date("2026-09-22T09:10:00Z"); // còn 10 phút
    expect(capDurationToWindow(3600, closes, now)).toBe(600 + EXAM_CLOSE_GRACE_SEC);
    expect(capDurationToWindow(300, closes, now)).toBe(300); // đề ngắn hơn thì giữ
    expect(capDurationToWindow(3600, null, now)).toBe(3600); // manual: không hạn
  });

  it("capDurationToWindow: vào sát/quá giờ đóng vẫn còn tối thiểu là grace", () => {
    const now = new Date("2026-09-22T09:00:00Z");
    expect(capDurationToWindow(3600, new Date("2026-09-22T08:59:59Z"), now)).toBe(
      EXAM_CLOSE_GRACE_SEC,
    );
  });

  it("vào lúc còn 10 phút, đề dài 60 phút: bài chỉ còn ~10 phút + grace", async () => {
    const { code } = await setup("cap", 10);
    const r = await claimByOpenCode(code, student());
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(a.durationSec).toBeLessThanOrEqual(10 * 60 + EXAM_CLOSE_GRACE_SEC);
    expect(a.durationSec).toBeGreaterThan(9 * 60);
  });

  it("vào sớm (còn 2 giờ): giữ nguyên 60 phút", async () => {
    const { code } = await setup("nocap", 120);
    const r = await claimByOpenCode(code, student());
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(a.durationSec).toBe(3600);
  });
});
