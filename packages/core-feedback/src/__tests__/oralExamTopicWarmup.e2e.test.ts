import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  createCourse,
  createExam,
  createOralMaterialTopicList,
  createOralTopic,
  enrollInCourse,
  publishExam,
  registerUser,
  startOralExamAttempt,
} from "@feedbackme/core-lms";
import { embedMaterial } from "../oralExam/materialEmbeddings";
import { generateOralExamEvaluation } from "../oralExam/evaluation";
import {
  buildOralSystemPrompt,
  resolveOralPhase,
  runOralExamPreviewTurn,
  runOralExamTurn,
} from "../oralExam/examinerChat";
import type { ChatComputeFn } from "../oralExam/chat";
import type { EmbedComputeFn } from "../oralExam/embeddings";

const BASE = "http://localhost:3000";
const DIM = 1536;

function fakeVector(x: number): number[] {
  const v = new Array(DIM).fill(0);
  v[0] = x;
  return v;
}

/** Ghi lại câu truy vấn được nhúng — để kiểm tra việc tìm tài liệu theo CHỦ ĐỀ chứ không chỉ theo câu trả lời. */
function recordingEmbed(queries: string[]): EmbedComputeFn {
  return async (texts) => {
    queries.push(...texts);
    return { embeddings: texts.map(() => fakeVector(1)), tokensUsed: 5 };
  };
}

function capturingChat(prompts: string[], reply = "ok"): ChatComputeFn {
  return async (messages) => {
    prompts.push(messages[0]!.content);
    return { content: reply, inputTokens: 1, outputTokens: 1 };
  };
}

async function setup(slug: string, opts: { warmup: boolean; topics: Array<[string, string]> }) {
  const owner = await registerUser(
    { email: `tw-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `tw-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 15,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  if (opts.warmup) await prisma.exam.update({ where: { id: examId }, data: { oralWarmup: true } });
  for (const [title, brief] of opts.topics) await createOralTopic(owner.userId, examId, { title, brief });
  const { materialId } = await createOralMaterialTopicList(owner.userId, examId, {
    title: "Tài liệu",
    text: "Kim cương đôi và sáu giai đoạn.",
  });
  await embedMaterial(owner.userId, materialId, recordingEmbed([]));
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `tw-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const { attemptId } = await startOralExamAttempt(learner.userId, examId);
  return { ownerId: owner.userId, examId, learnerId: learner.userId, attemptId };
}

describe("resolveOralPhase (A6.7)", () => {
  it("without warmup: first turn is the legacy 'first', then normal", () => {
    expect(resolveOralPhase({ shouldClose: false, warmup: false, examinerTurns: 0 })).toBe("first");
    expect(resolveOralPhase({ shouldClose: false, warmup: false, examinerTurns: 1 })).toBe("normal");
  });
  it("with warmup: warmup → topic_intro → normal", () => {
    expect(resolveOralPhase({ shouldClose: false, warmup: true, examinerTurns: 0 })).toBe("warmup");
    expect(resolveOralPhase({ shouldClose: false, warmup: true, examinerTurns: 1 })).toBe("topic_intro");
    expect(resolveOralPhase({ shouldClose: false, warmup: true, examinerTurns: 2 })).toBe("normal");
  });
  it("closing wins over everything", () => {
    expect(resolveOralPhase({ shouldClose: true, warmup: true, examinerTurns: 0 })).toBe("closing");
    expect(resolveOralPhase({ shouldClose: true, warmup: false, examinerTurns: 5 })).toBe("closing");
  });
});

describe("buildOralSystemPrompt (A6.7)", () => {
  const base = {
    courseTitle: "Khoá",
    examTitle: "Đề",
    contextChunks: [] as string[],
    language: "vi" as const,
    examinerInstructions: "Hỏi thật ngắn gọn.",
  };
  const topic = { title: "Điểm danh QR", brief: "30% mã QR bị chụp gửi bạn." };

  it("warmup: greets + asks a get-to-know question, and does NOT reveal the topic or ask knowledge", () => {
    const p = buildOralSystemPrompt({ ...base, phase: "warmup", topic });
    expect(p).toContain("LƯỢT KHỞI ĐỘNG");
    expect(p).toContain("TUYỆT ĐỐI chưa hỏi câu kiến thức nào");
    expect(p).not.toContain("Điểm danh QR"); // chủ đề chưa được tiết lộ
    expect(p).not.toContain("Tài liệu tham khảo cho câu hỏi");
    expect(p).toContain("Hỏi thật ngắn gọn."); // hướng dẫn của GV vẫn được chèn
    expect(p).toContain("tiếng Việt");
  });

  it("topic_intro: announces the assigned topic and asks the first knowledge question, without greeting again", () => {
    const p = buildOralSystemPrompt({ ...base, phase: "topic_intro", topic });
    expect(p).toContain("Điểm danh QR");
    expect(p).toContain("30% mã QR bị chụp gửi bạn.");
    expect(p).toContain("Không chào lại");
    expect(p).toContain("MỌI câu hỏi phải bám vào chủ đề này");
  });

  it("normal: keeps the topic in scope but adds no first-turn rule", () => {
    const p = buildOralSystemPrompt({ ...base, phase: "normal", topic });
    expect(p).toContain("MỌI câu hỏi phải bám vào chủ đề này");
    expect(p).not.toContain("lượt ĐẦU TIÊN");
    expect(p).not.toContain("Không chào lại");
  });

  it("first (no warmup): legacy greet-then-ask in one turn; mentions the topic only if there is one", () => {
    const withTopic = buildOralSystemPrompt({ ...base, phase: "first", topic });
    expect(withTopic).toContain("lượt ĐẦU TIÊN");
    expect(withTopic).toContain("nêu ngắn gọn chủ đề được giao");
    const noTopic = buildOralSystemPrompt({ ...base, phase: "first", topic: null });
    expect(noTopic).toContain("lượt ĐẦU TIÊN");
    expect(noTopic).not.toContain("chủ đề được giao");
    expect(noTopic).toContain("Nguyên tắc:");
  });

  it("timing: tells the AI how long is left; omitted when there is no clock (preview)", () => {
    const withClock = buildOralSystemPrompt({
      ...base,
      phase: "normal",
      timing: { durationMin: 15, elapsedMin: 11 },
    });
    expect(withClock).toContain("tổng 15 phút");
    expect(withClock).toContain("đã trôi khoảng 11 phút");
    expect(withClock).toContain("còn khoảng 4 phút");
    const noClock = buildOralSystemPrompt({ ...base, phase: "normal", timing: null });
    expect(noClock).not.toContain("Thời gian buổi vấn đáp");
  });

  it("closing prompt is unchanged: no topic, no rules about asking", () => {
    const p = buildOralSystemPrompt({ ...base, phase: "closing", topic });
    expect(p).toContain("lời kết");
    expect(p).not.toContain("Điểm danh QR");
  });
});

describe("runOralExamTurn with warmup + assigned topic (A6.7)", () => {
  it("runs warmup → topic_intro → normal and counts only knowledge questions", async () => {
    const s = await setup("w1", { warmup: true, topics: [["Điểm danh QR", "30% mã QR bị chụp gửi bạn."]] });
    const prompts: string[] = [];
    const queries: string[] = [];
    const args = (msg: string | null) => ({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: msg,
      computeChat: capturingChat(prompts),
      computeEmbed: recordingEmbed(queries),
    });

    const r1 = await runOralExamTurn(args(null));
    expect(prompts[0]).toContain("LƯỢT KHỞI ĐỘNG");
    expect(prompts[0]).not.toContain("Điểm danh QR");
    expect(queries).toHaveLength(0); // khởi động không tìm tài liệu, đỡ tốn token
    expect(r1.questionsAsked).toBe(0); // chào + làm quen chưa phải câu hỏi kiến thức

    const r2 = await runOralExamTurn(args("Mình là An, sẵn sàng rồi ạ."));
    expect(prompts[1]).toContain("Không chào lại");
    expect(prompts[1]).toContain("Điểm danh QR");
    // tìm tài liệu theo CHỦ ĐỀ, không theo câu chào của sinh viên
    expect(queries[0]).toContain("Điểm danh QR");
    expect(queries[0]).not.toContain("Mình là An");
    expect(r2.questionsAsked).toBe(1);

    const r3 = await runOralExamTurn(args("Trước hết em sẽ phỏng vấn sinh viên."));
    // các lượt sau: truy vấn = chủ đề + câu trả lời → sinh viên không lái được sang chủ đề khác
    expect(queries[1]).toContain("Điểm danh QR");
    expect(queries[1]).toContain("phỏng vấn sinh viên");
    expect(prompts[2]).toContain("MỌI câu hỏi phải bám vào chủ đề này");
    expect(r3.questionsAsked).toBe(2);
  });

  it("puts real clock info in the prompt for an actual attempt", async () => {
    const s = await setup("w2", { warmup: false, topics: [] });
    const prompts: string[] = [];
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: capturingChat(prompts),
      computeEmbed: recordingEmbed([]),
    });
    expect(prompts[0]).toContain("tổng 15 phút");
  });

  it("keeps the legacy behaviour when the exam has neither warmup nor topics", async () => {
    const s = await setup("w3", { warmup: false, topics: [] });
    const prompts: string[] = [];
    const queries: string[] = [];
    const r1 = await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: capturingChat(prompts),
      computeEmbed: recordingEmbed(queries),
    });
    expect(prompts[0]).toContain("lượt ĐẦU TIÊN");
    expect(prompts[0]).toContain("Kim cương đôi và sáu giai đoạn."); // đoạn đầu của tài liệu đứng đầu
    expect(queries).toHaveLength(0);
    expect(r1.questionsAsked).toBe(1);

    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: "Em bắt đầu bằng phỏng vấn.",
      computeChat: capturingChat(prompts),
      computeEmbed: recordingEmbed(queries),
    });
    expect(queries).toEqual(["Em bắt đầu bằng phỏng vấn."]); // vẫn tìm theo câu trả lời, như cũ
  });
});

describe("runOralExamPreviewTurn with a chosen topic (A6.7)", () => {
  it("uses the topic the teacher picked, and rejects a topic from another exam", async () => {
    const s = await setup("p1", { warmup: false, topics: [["Điểm danh QR", "30% mã QR bị chụp."]] });
    const other = await setup("p2", { warmup: false, topics: [["Chủ đề lạ", "không thuộc đề này"]] });
    const topicId = (await prisma.oralExamTopic.findFirstOrThrow({ where: { examId: s.examId } })).id;
    const foreignTopicId = (await prisma.oralExamTopic.findFirstOrThrow({ where: { examId: other.examId } })).id;

    const prompts: string[] = [];
    await runOralExamPreviewTurn({
      examId: s.examId,
      teacherUserId: s.ownerId,
      history: [],
      studentMessage: null,
      topicId,
      computeChat: capturingChat(prompts),
      computeEmbed: recordingEmbed([]),
    });
    expect(prompts[0]).toContain("Điểm danh QR");
    expect(prompts[0]).not.toContain("Thời gian buổi vấn đáp"); // bản thử không có đồng hồ

    await expect(
      runOralExamPreviewTurn({
        examId: s.examId,
        teacherUserId: s.ownerId,
        history: [],
        studentMessage: null,
        topicId: foreignTopicId,
        computeChat: capturingChat([]),
        computeEmbed: recordingEmbed([]),
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("grading prompt knows the assigned topic (A6.7)", () => {
  it("includes the topic so each student is graded within their own topic's scope", async () => {
    const s = await setup("g1", { warmup: false, topics: [["Điểm danh QR", "30% mã QR bị chụp gửi bạn."]] });
    await runOralExamTurn({
      attemptId: s.attemptId,
      studentUserId: s.learnerId,
      studentMessage: null,
      computeChat: capturingChat([]),
      computeEmbed: recordingEmbed([]),
    });
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "submitted", submittedAt: new Date() } });

    const prompts: string[] = [];
    const grade: ChatComputeFn = async (messages) => {
      prompts.push(messages[0]!.content);
      return { content: '{"score": 80, "summary": "ok", "breakdown": []}', inputTokens: 1, outputTokens: 1 };
    };
    await generateOralExamEvaluation(s.ownerId, s.attemptId, grade);
    expect(prompts[0]).toContain("Chủ đề được giao cho sinh viên này");
    expect(prompts[0]).toContain("Điểm danh QR");
  });
});
