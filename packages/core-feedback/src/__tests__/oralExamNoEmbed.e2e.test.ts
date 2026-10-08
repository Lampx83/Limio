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
import { embedMaterial, searchMaterialChunks } from "../oralExam/materialEmbeddings";
import { DEFAULT_EMBEDDING_MODEL, type EmbedComputeFn } from "../oralExam/embeddings";
import { runOralExamPreviewTurn, runOralExamTurn } from "../oralExam/examinerChat";
import type { ChatComputeFn, ChatMessage } from "../oralExam/chat";

/**
 * Vấn đáp bằng chữ phải chạy được khi KHÔNG có OpenAI key (chat đã chuyển sang LLM tự host):
 * không embeddings ⇒ tài liệu vẫn được cắt đoạn và lưu (embedding NULL), còn việc chọn đoạn cho mỗi
 * lượt dùng so khớp từ khoá thay cho vector.
 */

const BASE = "http://localhost:3000";
const DIM = 1536;

function fakeEmbed(x = 1): EmbedComputeFn {
  const v = new Array(DIM).fill(0);
  v[0] = x;
  return async (texts) => ({ embeddings: texts.map(() => v), tokensUsed: 5 });
}

function spyChat(reply = "Em hãy giải thích thêm?") {
  const calls: ChatMessage[][] = [];
  const compute: ChatComputeFn = async (messages) => {
    calls.push(messages);
    return { content: reply, inputTokens: 10, outputTokens: 20 };
  };
  return { compute, calls };
}

// Mỗi đoạn đủ dài (> nửa trần 1000 ký tự) để chunkText không gộp hai đoạn vào một chunk.
const pad = (s: string) => `${s} ${"Nội dung bổ sung cho đủ dài. ".repeat(20)}`;
const P_LOOP = pad("Vòng lặp for duyệt qua từng phần tử của mảng, còn while lặp cho tới khi điều kiện sai.");
const P_RECURSION = pad("Đệ quy là kỹ thuật hàm tự gọi lại chính nó, cần có điều kiện dừng để tránh tràn ngăn xếp.");
const P_POINTER = pad("Con trỏ lưu địa chỉ của một biến trong bộ nhớ và có thể được cấp phát động.");
const P_SORT = pad("Sắp xếp nổi bọt so sánh từng cặp phần tử liền kề rồi đổi chỗ nếu sai thứ tự.");
const MATERIAL_TEXT = [P_LOOP, P_RECURSION, P_POINTER, P_SORT].join("\n\n");

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `ne-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `ne-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  const { materialId } = await createOralMaterialTopicList(owner.userId, examId, {
    title: "Tài liệu",
    text: MATERIAL_TEXT,
  });
  const embedResult = await embedMaterial(
    owner.userId,
    materialId,
    null,
  );
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `ne-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const { attemptId } = await startOralExamAttempt(learner.userId, examId);
  return { ownerId: owner.userId, examId, learnerId: learner.userId, attemptId, materialId, embedResult };
}

describe("embedMaterial không có compute (không OpenAI)", () => {
  it("vẫn cắt đoạn và lưu chunk với embedding NULL, không tốn token, không ghi usage", async () => {
    const s = await setup("m1");
    expect(s.embedResult).toEqual({ chunkCount: 4, skipped: false, embedded: false });

    const rows = await prisma.$queryRaw<{ n: bigint; nulls: bigint }[]>`
      SELECT count(*) AS n, count(*) FILTER (WHERE embedding IS NULL) AS nulls
      FROM "OralExamMaterialChunk" WHERE "materialId" = ${s.materialId}`;
    expect(Number(rows[0]!.n)).toBe(4);
    expect(Number(rows[0]!.nulls)).toBe(4);

    const usage = await prisma.aiUsageLog.count({
      where: { userId: s.ownerId, model: DEFAULT_EMBEDDING_MODEL },
    });
    expect(usage).toBe(0);
  });

  it("vẫn phát sự kiện embedded (tokensUsed = 0) để dòng thời gian không mất dấu", async () => {
    const s = await setup("m2");
    const ev = await prisma.learningEvent.findFirst({
      where: { userId: s.ownerId, eventType: LearningEventType.ExamOralMaterialEmbedded },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as Record<string, unknown>).tokensUsed).toBe(0);
    expect((ev!.payload as Record<string, unknown>).chunkCount).toBe(4);
  });

  it("embed lại bằng vector sau đó thì điền đè embedding, embedded = true", async () => {
    const s = await setup("m3");
    const r = await embedMaterial(s.ownerId, s.materialId, fakeEmbed());
    expect(r).toEqual({ chunkCount: 4, skipped: false, embedded: true });
    const rows = await prisma.$queryRaw<{ nulls: bigint }[]>`
      SELECT count(*) FILTER (WHERE embedding IS NULL) AS nulls
      FROM "OralExamMaterialChunk" WHERE "materialId" = ${s.materialId}`;
    expect(Number(rows[0]!.nulls)).toBe(0);
  });
});

describe("searchMaterialChunks", () => {
  it("bỏ qua chunk chưa có embedding thay vì xếp chúng lẫn vào kết quả", async () => {
    const s = await setup("s1"); // 4 chunk NULL
    const found = await searchMaterialChunks(s.examId, new Array(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)), 3);
    expect(found).toEqual([]);
  });
});

describe("runOralExamTurn với computeEmbed = null", () => {
  it("lượt mở màn: không ném lỗi và vẫn đưa đoạn đầu của tài liệu cho AI", async () => {
    const s = await setup("t1");
    const { compute, calls } = spyChat("Vòng lặp for hoạt động thế nào?");
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: null,
    });
    expect(r.assistantContent).toBe("Vòng lặp for hoạt động thế nào?");
    expect(calls[0]![0]!.content).toContain("Vòng lặp for duyệt qua");
  });

  it("lượt sau: chọn đoạn theo từ khoá trong câu trả lời, không lấy đoạn không liên quan", async () => {
    const s = await setup("t2");
    const first = spyChat("Câu một?");
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: first.compute,
      computeEmbed: null,
    });
    const second = spyChat("Câu hai?");
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: "Em nghĩ đệ quy là hàm tự gọi lại chính nó ạ",
      computeChat: second.compute,
      computeEmbed: null,
    });
    const system = second.calls[0]![0]!.content;
    expect(system).toContain("Đệ quy là kỹ thuật hàm tự gọi lại");
    expect(system).not.toContain("Con trỏ lưu địa chỉ");
    expect(system).not.toContain("Sắp xếp nổi bọt");
  });

  it("câu trả lời không khớp tài liệu: AI nhận 'không có tài liệu liên quan', không lỗi", async () => {
    const s = await setup("t3");
    const first = spyChat();
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: first.compute,
      computeEmbed: null,
    });
    const second = spyChat();
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: "blockchain và tiền mã hoá",
      computeChat: second.compute,
      computeEmbed: null,
    });
    expect(second.calls[0]![0]!.content).toContain("không có tài liệu liên quan");
  });

  it("không ghi usage của model embedding", async () => {
    const s = await setup("t4");
    const { compute } = spyChat();
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: compute,
      computeEmbed: null,
    });
    const usage = await prisma.aiUsageLog.count({
      where: { userId: s.learnerId, model: DEFAULT_EMBEDDING_MODEL },
    });
    expect(usage).toBe(0);
  });
});

describe("runOralExamTurn có computeEmbed nhưng chunk toàn NULL (tài liệu nhúng trước khi có key)", () => {
  it("lùi về so khớp từ khoá thay vì để AI không có tài liệu", async () => {
    const s = await setup("f1"); // chunk NULL
    const first = spyChat();
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: first.compute,
      computeEmbed: fakeEmbed(),
    });
    const second = spyChat();
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: "Con trỏ là gì, nó lưu địa chỉ bộ nhớ đúng không ạ",
      computeChat: second.compute,
      computeEmbed: fakeEmbed(),
    });
    expect(second.calls[0]![0]!.content).toContain("Con trỏ lưu địa chỉ");
  });
});

describe("runOralExamTurn khi lời gọi embeddings lỗi (key bị hạn chế quyền, 429…)", () => {
  it("không làm hỏng lượt thi: lùi về từ khoá và AI vẫn hỏi được", async () => {
    const s = await setup("e1");
    const first = spyChat();
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: first.compute,
      computeEmbed: null,
    });
    const failing: EmbedComputeFn = async () => {
      throw new Error("403 You do not have access to this model");
    };
    const second = spyChat("Câu hai?");
    const r = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: "Đệ quy là hàm tự gọi lại chính nó",
      computeChat: second.compute,
      computeEmbed: failing,
    });
    expect(r.assistantContent).toBe("Câu hai?");
    expect(second.calls[0]![0]!.content).toContain("Đệ quy là kỹ thuật hàm tự gọi lại");
  });
});

describe("runOralExamPreviewTurn với computeEmbed = null", () => {
  it("GV thử vấn đáp được khi không có OpenAI key", async () => {
    const s = await setup("p1");
    const { compute, calls } = spyChat("Câu hỏi thử?");
    const r = await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [
        { role: "examiner", content: "Câu một?" },
      ],
      studentMessage: "Đệ quy là hàm tự gọi lại chính nó",
      computeChat: compute,
      computeEmbed: null,
    });
    expect(r.assistantContent).toBe("Câu hỏi thử?");
    expect(calls[0]![0]!.content).toContain("Đệ quy là kỹ thuật hàm tự gọi lại");
  });
});
