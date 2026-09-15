import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  createCourse,
  createExam,
  createOralMaterialTopicList,
  enrollInCourse,
  publishExam,
  registerUser,
  startOralExamAttempt,
} from "@feedbackme/core-lms";
import {
  DEFAULT_MONTHLY_TOKENS_LEARNER,
  chargeTokens,
} from "../aiTutor/tokenWallet";
import { assertWithinCaps } from "../aiTutor/aiTutor";
import { AiTutorError } from "../aiTutor/errors";
import { embedMaterial } from "../oralExam/materialEmbeddings";
import { MAX_ORAL_QUESTIONS, runOralExamTurn } from "../oralExam/examinerChat";
import type { ChatComputeFn } from "../oralExam/chat";
import type { EmbedComputeFn } from "../oralExam/embeddings";

const BASE = "http://localhost:3000";
const DIM = 1536;

function fakeVector(x: number): number[] {
  const v = new Array(DIM).fill(0);
  v[0] = x;
  return v;
}

function fakeEmbed(vector = fakeVector(1)): EmbedComputeFn {
  return async (texts) => ({ embeddings: texts.map(() => vector), tokensUsed: 5 });
}

function scriptedChat(replies: string[]): { compute: ChatComputeFn; calls: number } {
  const state = { calls: 0 };
  const compute: ChatComputeFn = async () => {
    const content = replies[state.calls] ?? replies[replies.length - 1]!;
    state.calls++;
    return { content, inputTokens: 10, outputTokens: 20 };
  };
  return { compute, calls: state.calls };
}

async function setup(slug: string, durationMin = 60) {
  const owner = await registerUser(
    { email: `ot-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `ot-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  const { materialId } = await createOralMaterialTopicList(owner.userId, examId, {
    title: "Chủ đề",
    text: "Vòng lặp for và while.",
  });
  await embedMaterial(owner.userId, materialId, fakeEmbed());
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `ot-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const { attemptId } = await startOralExamAttempt(learner.userId, examId);
  return { ownerId: owner.userId, examId, learnerId: learner.userId, attemptId, materialId };
}

describe("runOralExamTurn (A6.3)", () => {
  it("asks an opening question on the first call", async () => {
    const s = await setup("t1");
    const { compute } = scriptedChat(["Vòng lặp for hoạt động thế nào?"]);
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r).toEqual({
      assistantContent: "Vòng lặp for hoạt động thế nào?",
      ended: false,
      questionsAsked: 1,
    });

    const turns = await prisma.oralExamTurn.findMany({ where: { attemptId: s.attemptId } });
    expect(turns).toHaveLength(1);
    expect(turns[0]!.role).toBe("examiner");

    const usage = await prisma.aiUsageLog.findFirst({
      where: { userId: s.learnerId, model: "gpt-4o-mini" },
    });
    expect(usage?.tokensInput).toBe(10);
    expect(usage?.tokensOutput).toBe(20);

    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralAttemptTurnRecorded, userId: s.learnerId },
    });
    expect((ev!.payload as Record<string, unknown>).questionsAsked).toBe(1);
    expect((ev!.payload as Record<string, unknown>).ended).toBe(false);
  });

  it("uses the exam's configured language directive on the opening question, not inference", async () => {
    const s = await setup("t1c");
    await prisma.exam.update({ where: { id: s.examId }, data: { language: "en" } });
    let seenPrompt = "";
    const capture: ChatComputeFn = async (messages) => {
      seenPrompt = messages[0]!.content;
      return { content: "How does a for loop work?", inputTokens: 1, outputTokens: 1 };
    };
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: capture,
      computeEmbed: fakeEmbed(),
    });
    expect(seenPrompt).toContain("Ask and respond ENTIRELY in English");
    expect(seenPrompt).not.toContain("tiếng Việt");
  });

  it("chèn examinerInstructions của GV vào system prompt, không thay thế nguyên tắc cứng", async () => {
    const s = await setup("t1d");
    await prisma.exam.update({
      where: { id: s.examId },
      data: { examinerInstructions: "Không để sinh viên dẫn dắt cuộc hội thoại." },
    });
    let seenPrompt = "";
    const capture: ChatComputeFn = async (messages) => {
      seenPrompt = messages[0]!.content;
      return { content: "Vòng lặp for hoạt động thế nào?", inputTokens: 1, outputTokens: 1 };
    };
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: capture,
      computeEmbed: fakeEmbed(),
    });
    expect(seenPrompt).toContain("Không để sinh viên dẫn dắt cuộc hội thoại.");
    expect(seenPrompt).toContain("Nguyên tắc:"); // 4 nguyên tắc cứng vẫn còn nguyên
  });

  it("rejects a non-null studentMessage on the very first call", async () => {
    const s = await setup("t2");
    await expect(
      runOralExamTurn({
        attemptId: s.attemptId,
        studentUserId: s.learnerId,
        studentMessage: "câu trả lời sớm",
        computeChat: scriptedChat(["x"]).compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toMatchObject({ code: "validation_failed", details: "first_turn_must_be_empty" });
  });

  it("records the student answer, then asks a follow-up grounded in a search result", async () => {
    const s = await setup("t3");
    const { compute } = scriptedChat(["Câu hỏi 1?", "Câu hỏi 2 dựa trên trả lời trước?"]);

    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    const r2 = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: "For lặp qua từng phần tử.",
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r2.questionsAsked).toBe(2);
    expect(r2.ended).toBe(false);

    const turns = await prisma.oralExamTurn.findMany({
      where: { attemptId: s.attemptId },
      orderBy: { createdAt: "asc" },
    });
    expect(turns.map((t) => t.role)).toEqual(["examiner", "student", "examiner"]);
    expect(turns[1]!.content).toBe("For lặp qua từng phần tử.");
  });

  it("rejects wrong_turn_order when the last stored turn is not from the examiner", async () => {
    const s = await setup("t4");
    // Trạng thái hỏng có chủ đích: 2 lượt student liên tiếp, không do luồng
    // bình thường tạo ra — kiểm tra hàm tự vệ đúng khi dữ liệu bất thường.
    await prisma.oralExamTurn.create({
      data: { attemptId: s.attemptId, role: "student", content: "lỡ tay" },
    });
    await expect(
      runOralExamTurn({
        attemptId: s.attemptId,
        studentUserId: s.learnerId,
        studentMessage: "câu tiếp",
        computeChat: scriptedChat(["x"]).compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toMatchObject({ code: "validation_failed", details: "wrong_turn_order" });
  });

  it("ends the exam once the hard question cap is reached", async () => {
    const s = await setup("t5");
    // Seed thẳng đủ MAX_ORAL_QUESTIONS câu hỏi qua DB cho nhanh, CHƯA trả lời
    // câu cuối — test tự trả lời câu cuối đó để kích hoạt việc kết thúc.
    for (let i = 0; i < MAX_ORAL_QUESTIONS; i++) {
      await prisma.oralExamTurn.create({
        data: { attemptId: s.attemptId, role: "examiner", content: `Q${i}` },
      });
      if (i < MAX_ORAL_QUESTIONS - 1) {
        await prisma.oralExamTurn.create({
          data: { attemptId: s.attemptId, role: "student", content: `A${i}` },
        });
      }
    }
    const { compute } = scriptedChat(["Lời kết buổi vấn đáp."]);
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: `A${MAX_ORAL_QUESTIONS - 1}`,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r.ended).toBe(true);
    expect(r.questionsAsked).toBe(MAX_ORAL_QUESTIONS);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(attempt.status).toBe("submitted");
  });

  it("ends the exam once time is up, even on the opening turn", async () => {
    const s = await setup("t6", 1); // 1 phút — sẽ ép hết giờ ngay bên dưới
    await prisma.examAttempt.update({
      where: { id: s.attemptId },
      data: { startedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const { compute } = scriptedChat(["Hết giờ, xin cảm ơn."]);
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r.ended).toBe(true);
    expect(r.questionsAsked).toBe(0);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(attempt.status).toBe("submitted");
  });

  it("rejects once the attempt is no longer in_progress", async () => {
    const s = await setup("t7");
    await prisma.examAttempt.update({
      where: { id: s.attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await expect(
      runOralExamTurn({
        attemptId: s.attemptId,
        studentUserId: s.learnerId,
        studentMessage: null,
        computeChat: scriptedChat(["x"]).compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toMatchObject({ code: "validation_failed", details: "attempt_ended" });
  });

  it("rejects a different user answering someone else's attempt", async () => {
    const s = await setup("t8");
    const other = await registerUser(
      { email: "ot-other-t8@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      runOralExamTurn({
        attemptId: s.attemptId,
        studentUserId: other.userId,
        studentMessage: null,
        computeChat: scriptedChat(["x"]).compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toMatchObject({ code: "validation_failed", details: "wrong_user" });
  });

  it("rejects an ExamAttempt that belongs to a written exam", async () => {
    const owner = await registerUser(
      { email: "ot-owner-t9@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "Written course t9",
      description: "x",
      slug: "ot-written-t9",
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Written",
      durationMin: 20,
    });
    // Tạo ExamAttempt tay cho đề thi VIẾT — mô phỏng dữ liệu sai loại, kiểm
    // tra guard defensive chứ luồng bình thường không tạo ra được trạng thái này.
    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        userId: owner.userId,
        durationSec: 1200,
        sessionToken: "tok-t9",
      },
    });
    await expect(
      runOralExamTurn({
        attemptId: attempt.id,
        studentUserId: owner.userId,
        studentMessage: null,
        computeChat: scriptedChat(["x"]).compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toMatchObject({ code: "validation_failed", details: "not_oral_exam" });
  });

  it("forceEnd closes the attempt immediately without a student answer", async () => {
    const s = await setup("t11");
    const { compute } = scriptedChat(["Câu hỏi 1?", "Cảm ơn bạn đã tham gia."]);
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });

    // Bug thật (production): SV gõ "tôi muốn kết thúc" như một câu TRẢ LỜI —
    // shouldClose (thuần theo thời gian/số câu) không biết gì về việc đó,
    // buổi thi kẹt in_progress mãi. forceEnd là lối thoát thật, không dựa vào
    // suy đoán ý định từ nội dung câu trả lời.
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      forceEnd: true,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r.ended).toBe(true);
    expect(r.assistantContent).toBe("Cảm ơn bạn đã tham gia.");
    // questionsAsked không tăng thêm — lời kết không tính là một câu hỏi mới.
    expect(r.questionsAsked).toBe(1);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(attempt.status).toBe("submitted");

    const turns = await prisma.oralExamTurn.findMany({
      where: { attemptId: s.attemptId },
      orderBy: { createdAt: "asc" },
    });
    // Không có turn "student" nào được ghi thêm — SV không gửi câu trả lời.
    expect(turns.map((t) => t.role)).toEqual(["examiner", "examiner"]);
  });

  it("forceEnd bypasses the empty-message check even on the opening turn", async () => {
    const s = await setup("t12");
    const { compute } = scriptedChat(["Buổi vấn đáp kết thúc ngay từ đầu."]);
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      forceEnd: true,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r.ended).toBe(true);
    expect(r.questionsAsked).toBe(0);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(attempt.status).toBe("submitted");
  });

  it("does not block on the student's personal token wallet (scope oral_exam)", async () => {
    const s = await setup("t10");
    // Rút cạn ví cá nhân — scope mặc định ("tutor") sẽ chặn ngay tại đây.
    await chargeTokens(s.learnerId, DEFAULT_MONTHLY_TOKENS_LEARNER, null);
    await expect(assertWithinCaps(s.learnerId)).rejects.toBeInstanceOf(AiTutorError);

    // scope "oral_exam" phải KHÔNG bị chặn dù ví đã cạn.
    await expect(assertWithinCaps(s.learnerId, prisma, "oral_exam")).resolves.toBeUndefined();

    const { compute } = scriptedChat(["Câu hỏi mở đầu."]);
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r.questionsAsked).toBe(1);
  });
});
