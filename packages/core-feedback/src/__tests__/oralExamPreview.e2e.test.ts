import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  createCourse,
  createExam,
  createOralMaterialTopicList,
  registerUser,
} from "@feedbackme/core-lms";
import { AiTutorError } from "../aiTutor/errors";
import { embedMaterial } from "../oralExam/materialEmbeddings";
import { runOralExamPreviewTurn } from "../oralExam/examinerChat";
import type { ChatComputeFn, ChatMessage } from "../oralExam/chat";
import type { EmbedComputeFn } from "../oralExam/embeddings";

const BASE = "http://localhost:3000";
const DIM = 1536;

function fakeEmbed(): EmbedComputeFn {
  const v = new Array(DIM).fill(0);
  v[0] = 1;
  return async (texts) => ({ embeddings: texts.map(() => v), tokensUsed: 5 });
}

/** Chat giả ghi lại prompt đã gửi để kiểm tra bản thử dùng đúng cấu hình đề. */
function spyChat(reply = "Câu hỏi thử?") {
  const calls: ChatMessage[][] = [];
  const compute: ChatComputeFn = async (messages) => {
    calls.push(messages);
    return { content: reply, inputTokens: 10, outputTokens: 20 };
  };
  return { compute, calls };
}

// Đề còn NHÁP, chưa mở phiên, chưa có ai thi — đúng tình huống giáo viên thử trước khi tạo phiên.
async function draftOralSetup(slug: string, opts: { kind?: "oral" | "written" } = {}) {
  const owner = await registerUser(
    { email: `pv-o-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `pv-course-${slug}`,
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp thử",
    durationMin: 20,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: opts.kind ?? "oral",
    examinerInstructions: "Hỏi thật ngắn gọn.",
  });
  let materialId: string | null = null;
  if ((opts.kind ?? "oral") === "oral") {
    const m = await createOralMaterialTopicList(owner.userId, examId, {
      title: "Chủ đề",
      text: "Vòng lặp for và while.",
    });
    materialId = m.materialId;
    await embedMaterial(owner.userId, m.materialId, fakeEmbed());
  }
  return { ownerId: owner.userId, courseId: course.courseId, examId, materialId };
}

async function counts(examId: string, userId: string) {
  return {
    attempts: await prisma.examAttempt.count({ where: { examId } }),
    turns: await prisma.oralExamTurn.count({ where: { attempt: { examId } } }),
    events: await prisma.learningEvent.count({
      where: { userId, eventType: LearningEventType.ExamOralAttemptTurnRecorded },
    }),
  };
}

describe("runOralExamPreviewTurn — GV thử vấn đáp không ghi DB", () => {
  it("lượt mở màn: trả câu hỏi, dùng đúng cấu hình đề, KHÔNG tạo lượt thi/lượt hỏi/sự kiện", async () => {
    const s = await draftOralSetup("p1");
    const before = await counts(s.examId, s.ownerId);
    const { compute, calls } = spyChat("Vòng lặp for hoạt động thế nào?");
    const r = await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [],
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r).toEqual({
      assistantContent: "Vòng lặp for hoạt động thế nào?",
      ended: false,
      questionsAsked: 1,
    });
    // Cùng prompt như buổi thật: có tài liệu, có hướng dẫn của GV, có ngôn ngữ.
    const system = calls[0]![0]!.content;
    expect(system).toContain("Vòng lặp for và while.");
    expect(system).toContain("Hỏi thật ngắn gọn.");
    expect(system).toContain("tiếng Việt");
    // Không ghi gì vào bảng lượt thi/hội thoại/sự kiện.
    expect(await counts(s.examId, s.ownerId)).toEqual(before);
    // Đề vẫn nháp — không bị xuất bản/khoá.
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } })).status).toBe("draft");
  });

  it("vẫn TÍNH token AI của giáo viên", async () => {
    const s = await draftOralSetup("p2");
    const { compute } = spyChat();
    await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [],
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    const usage = await prisma.aiUsageLog.findFirst({
      where: { userId: s.ownerId, model: "gpt-4o-mini" },
    });
    expect(usage?.tokensInput).toBe(10);
    expect(usage?.tokensOutput).toBe(20);
  });

  it("lượt tiếp theo: lịch sử do client gửi, hỏi tiếp và đếm số câu theo lịch sử", async () => {
    const s = await draftOralSetup("p3");
    const { compute, calls } = spyChat("Vậy while khác for ở đâu?");
    const r = await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [{ role: "examiner", content: "Vòng lặp for hoạt động thế nào?" }],
      studentMessage: "Lặp qua từng phần tử.",
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(r.questionsAsked).toBe(2);
    expect(r.ended).toBe(false);
    const roles = calls[0]!.map((m) => m.role);
    expect(roles).toEqual(["system", "assistant", "user"]);
    expect(await counts(s.examId, s.ownerId)).toEqual({ attempts: 0, turns: 0, events: 0 });
  });

  it("forceEnd kết thúc bằng lời kết; không có trần số câu nên nhiều câu vẫn hỏi tiếp", async () => {
    const s = await draftOralSetup("p4");
    const { compute, calls } = spyChat("Cảm ơn bạn, buổi vấn đáp đã hoàn tất.");
    const forced = await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [{ role: "examiner", content: "Câu 1?" }],
      studentMessage: null,
      forceEnd: true,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(forced.ended).toBe(true);
    expect(calls[0]![0]!.content).toContain("đến lúc kết thúc");

    // 15 câu đã hỏi (nhiều hơn trần 8 cũ) — vẫn hỏi tiếp, không tự đóng.
    const long: { role: "examiner" | "student"; content: string }[] = [];
    for (let i = 0; i < 15; i++) {
      long.push({ role: "examiner", content: `Q${i}` });
      if (i < 14) long.push({ role: "student", content: `A${i}` });
    }
    const more = await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: long,
      studentMessage: "trả lời",
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    expect(more.ended).toBe(false);
    expect(more.questionsAsked).toBe(16);
  });

  it("từ chối đề viết và thứ tự lượt sai", async () => {
    const written = await draftOralSetup("p5", { kind: "written" });
    const { compute } = spyChat();
    await expect(
      runOralExamPreviewTurn({
        examId: written.examId,
        teacherUserId: written.ownerId,
        history: [],
        studentMessage: null,
        computeChat: compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toBeInstanceOf(AiTutorError);

    const s = await draftOralSetup("p6");
    await expect(
      runOralExamPreviewTurn({
        examId: s.examId,
        teacherUserId: s.ownerId,
        history: [{ role: "student", content: "x" }],
        studentMessage: "y",
        computeChat: compute,
        computeEmbed: fakeEmbed(),
      }),
    ).rejects.toMatchObject({ details: "wrong_turn_order" });
  });

  it("sau khi thử vẫn sửa được tài liệu (đề không bị khoá)", async () => {
    const s = await draftOralSetup("p7");
    const { compute } = spyChat();
    await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [],
      studentMessage: null,
      computeChat: compute,
      computeEmbed: fakeEmbed(),
    });
    const added = await createOralMaterialTopicList(s.ownerId, s.examId, {
      title: "Chủ đề thêm sau khi thử",
      text: "Đệ quy.",
    });
    expect(added.materialId).toBeTruthy();
    expect(await prisma.oralExamMaterial.count({ where: { examId: s.examId } })).toBe(2);
  });
});
