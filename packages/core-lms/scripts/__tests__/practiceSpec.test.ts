import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../src/auth/register";
import { createCourse } from "../../src/courses/courses";
import { createModule } from "../../src/courses/modules";
import { createLesson } from "../../src/courses/lessons";
import { getPracticePreview } from "../../src/exam/practice";
import { AssignmentSpec, importAssignment, importPractice } from "../import-course";
import {
  PracticeSpec,
  assetProblems,
  bodyAssetRefs,
  buildPassageDoc,
  expandExamQuestion,
  inlineNodes,
  practiceProblems,
  practiceQuestionCount,
  replaceBodyAssetRefs,
} from "../practice-spec";

// Bài luyện trong manifest học liệu (khoá Speakout Intermediate Plus).

describe("inlineNodes", () => {
  it("đậm và nghiêng bằng dấu sao, chữ còn lại giữ nguyên", () => {
    expect(inlineNodes("Coffee **was** discovered *in* Ethiopia.")).toEqual([
      { type: "text", text: "Coffee " },
      { type: "text", text: "was", marks: [{ type: "bold" }] },
      { type: "text", text: " discovered " },
      { type: "text", text: "in", marks: [{ type: "italic" }] },
      { type: "text", text: " Ethiopia." },
    ]);
    expect(inlineNodes("")).toEqual([]);
  });
});

describe("buildPassageDoc", () => {
  it("đổi khối đơn giản thành tài liệu Tiptap đúng tập nút của trình soạn", () => {
    const doc = buildPassageDoc(
      [
        { h2: "Title" },
        { p: "Hello **world**" },
        { ul: ["a", "b"] },
        { ol: ["x"] },
        { table: { head: ["H1", "H2"], rows: [["1", "2"]] } },
        { image: "i.png", alt: "Ảnh" },
        { audio: "a.mp3", alt: "Nghe", transcript: "T" },
      ],
      { image: (f) => ({ src: `/api/exam-assets/${f}` }), audio: (f) => ({ src: `/api/exam-assets/${f}` }) },
    );
    const types = doc.content.map((n) => (n as { type: string }).type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "orderedList", "table", "image", "audio"]);
    expect(doc.content[5]).toEqual({ type: "image", attrs: { src: "/api/exam-assets/i.png", alt: "Ảnh" } });
    // Transcript KHÔNG nằm trong tài liệu (tài liệu được gửi xuống trình duyệt học viên).
    expect(JSON.stringify(doc)).not.toContain('"T"');
  });
});

describe("expandExamQuestion + practiceProblems", () => {
  const spec = (qs: unknown[]) => PracticeSpec.parse({ questions: qs });

  it("mọi dạng câu cho cấu hình hợp lệ", () => {
    const p = spec([
      { type: "mcq", prompt: "Q", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }], explanation: "vì A" },
      { type: "multi", prompt: "Q", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: true }, { label: "C", isCorrect: false }] },
      { type: "true_false_notgiven", prompt: "Q", correct: "false" },
      { type: "short_answer", prompt: "Q", answers: ["had", "had my hair done"] },
      { type: "gap_fill", prompt: "Q", blanks: [["a"], ["b", "c"]] },
      { type: "matching", prompt: "Q", pairs: [{ left: "1", right: "a" }, { left: "2", right: "b" }] },
      { type: "ordering", prompt: "Q", sequence: ["x", "y", "z"] },
      { type: "numerical", prompt: "Q", expected: 3 },
      { type: "drag_drop_fill", prompt: "A [[1]] B [[2]]", tokens: [{ label: "x", blank: 1 }, { label: "y", blank: 2 }, { label: "z" }] },
      { type: "essay", prompt: "Q", rubric: "r" },
    ]);
    expect(practiceProblems(p, "bài")).toEqual([]);
    expect(practiceQuestionCount(p)).toBe(10);
    expect(expandExamQuestion(p.questions[0]!).config).toMatchObject({ explanation: "vì A", options: [{ id: "o1", isCorrect: true }, { id: "o2" }] });
  });

  it("short_answer được nhập thành gap_fill một ô (chấm tự động, không phải chấm tay)", () => {
    const e = expandExamQuestion({ type: "short_answer", prompt: "Q", answers: ["had", "had my hair done"] });
    expect(e.type).toBe("gap_fill");
    expect(e.config).toMatchObject({ blanks: [{ id: "b1", acceptedAnswers: ["had", "had my hair done"] }] });
  });

  it("báo lỗi cụ thể: mcq hai đáp án đúng, thiếu đáp án, ô kéo thả lệch", () => {
    const bad = spec([
      { type: "mcq", prompt: "Q1", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: true }] },
      { type: "short_answer", prompt: "Q2" },
      { type: "drag_drop_fill", prompt: "A [[1]]", tokens: [{ label: "x", blank: 2 }] },
    ]);
    const msgs = practiceProblems(bad, "bài");
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toMatch(/câu 1/);
    expect(msgs[2]).toMatch(/\[\[N\]\]/);
  });

  it("Bài luyện rỗng bị từ chối", () => {
    expect(() => PracticeSpec.parse({})).toThrow();
  });
});

describe("tệp audio/ảnh", () => {
  it("báo thiếu tệp, sai đuôi", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assets-"));
    writeFileSync(path.join(dir, "ok.mp3"), "x");
    const p = PracticeSpec.parse({
      passages: [{ title: "P", blocks: [{ audio: "ok.mp3", alt: "a" }, { audio: "thieu.mp3", alt: "a" }, { image: "x.bmp", alt: "a" }] }],
    });
    const msgs = assetProblems(p, dir, "bài");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatch(/không thấy tệp audio "thieu.mp3"/);
    expect(msgs[1]).toMatch(/sai định dạng/);
  });
  it("tham chiếu ảnh trong thân bài asset:<tệp>", () => {
    expect(bodyAssetRefs("![a](asset:img/cafe.jpg \"x\") và asset:b.png")).toEqual(["img/cafe.jpg", "b.png"]);
    expect(replaceBodyAssetRefs("![a](asset:b.png)", new Map([["b.png", "/api/lesson-media/images/z.png"]]))).toBe("![a](/api/lesson-media/images/z.png)");
  });
});

describe("importPractice (DB)", () => {
  it("tạo khối Bài luyện có đoạn, ảnh, audio kèm transcript và câu hỏi; học viên nhận transcript, tài liệu đoạn thì không", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assets-"));
    mkdirSync(path.join(dir, "audio"));
    writeFileSync(path.join(dir, "audio", "r1.mp3"), Buffer.from("fake-mp3"));
    writeFileSync(path.join(dir, "cafe.png"), Buffer.from("fake-png"));
    process.env.UPLOADS_ROOT = mkdtempSync(path.join(tmpdir(), "uploads-"));

    const owner = (await registerUser({ email: "ps-owner@e.com", password: "password1234", displayName: "O" }, "http://localhost:3000")).userId;
    const c = await createCourse(owner, { title: "Speakout test", description: "x", slug: "ps-course" });
    const m = await createModule(owner, c.courseId, { title: "Unit 1", orderIndex: 0 });
    const l = await createLesson(owner, m.moduleId, { title: "1.1 Reading", orderIndex: 0 });

    const spec = PracticeSpec.parse({
      title: "Reading",
      passages: [
        {
          title: "Coffee",
          blocks: [{ h2: "Coffee" }, { p: "Coffee was discovered in **Ethiopia**." }, { image: "cafe.png", alt: "Cà phê" }, { audio: "audio/r1.mp3", alt: "Bản đọc", transcript: "Coffee was discovered." }],
          questions: [
            { type: "true_false_notgiven", prompt: "Coffee was found in Yemen.", correct: "false", explanation: "Ethiopia." },
            { type: "short_answer", prompt: "Where?", answers: ["Ethiopia"] },
          ],
        },
      ],
      questions: [{ type: "mcq", prompt: "Standalone", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }] }],
    });
    await importPractice(owner, l.lessonId, spec, 0, dir);

    const block = await prisma.contentItem.findFirstOrThrow({ where: { lessonId: l.lessonId, type: "exam_practice" } });
    const exam = await prisma.exam.findUniqueOrThrow({ where: { ownerContentItemId: block.id }, include: { passages: true, questions: true, assets: true } });
    expect(exam.passages).toHaveLength(1);
    expect(exam.questions).toHaveLength(3);
    expect(exam.questions.filter((q) => q.passageId === exam.passages[0]!.id)).toHaveLength(2);
    expect(exam.assets.map((a) => a.type).sort()).toEqual(["audio", "image"]);
    expect(exam.assets.find((a) => a.type === "audio")!.transcript).toBe("Coffee was discovered.");

    const doc = JSON.stringify(exam.passages[0]!.contentJson);
    expect(doc).toContain("/api/exam-assets/");
    expect(doc).not.toContain("Coffee was discovered.\"}"); // transcript không nằm trong tài liệu đoạn

    const embed = await getPracticePreview(owner, exam.id);
    expect(embed.questions).toHaveLength(3);
    const tr = embed.passages[0]!.transcripts ?? {};
    expect(Object.values(tr)).toEqual(["Coffee was discovered."]);
  });
});

describe("audio bài mẫu của câu essay (sampleAudio)", () => {
  const essay = { type: "essay", prompt: "What are the benefits of coffee?", explanation: "It gives you energy.", sampleAudio: "audio/sample.m4a" };

  it("đưa explanationAudio, voiceAnswer/aiFeedback (chỉ khi tắt) vào cấu hình essay", () => {
    const p = PracticeSpec.parse({ questions: [{ ...essay, voiceAnswer: false }] });
    expect(practiceProblems(p, "bài")).toEqual([]);
    const cfg = expandExamQuestion(p.questions[0]!, "/api/exam-assets/s-1.m4a").config as Record<string, unknown>;
    expect(cfg).toMatchObject({ explanationAudio: "/api/exam-assets/s-1.m4a", voiceAnswer: false, explanation: "It gives you energy." });
    expect(cfg).not.toHaveProperty("aiFeedback");
    const plain = expandExamQuestion(PracticeSpec.parse({ questions: [{ type: "essay", prompt: "Q", voiceAnswer: true, aiFeedback: true }] }).questions[0]!).config as Record<string, unknown>;
    expect(plain).not.toHaveProperty("voiceAnswer");
    expect(plain).not.toHaveProperty("aiFeedback");
    expect(plain).not.toHaveProperty("explanationAudio");
  });

  it("dry-run: thiếu tệp, sai đuôi, quá nặng đều báo lỗi", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assets-"));
    writeFileSync(path.join(dir, "ok.m4a"), "x");
    const p = PracticeSpec.parse({
      questions: [
        { ...essay, sampleAudio: "ok.m4a" },
        { ...essay, sampleAudio: "thieu.m4a" },
        { ...essay, sampleAudio: "x.bmp" },
      ],
    });
    const msgs = assetProblems(p, dir, "bài");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatch(/không thấy tệp audio bài mẫu "thieu.m4a"/);
    expect(msgs[1]).toMatch(/sai định dạng/);
  });

  it("câu mcq có sampleAudio bị từ chối", () => {
    const p = PracticeSpec.parse({ questions: [{ type: "mcq", prompt: "Q", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }], sampleAudio: "a.m4a" }] });
    const msgs = practiceProblems(p, "bài");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/chỉ dùng cho câu essay/);
  });

  it("importPractice (DB): lưu explanationAudio đúng và ExamAsset audio", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assets-"));
    mkdirSync(path.join(dir, "audio"));
    writeFileSync(path.join(dir, "audio", "sample.m4a"), Buffer.from("fake-m4a"));
    process.env.UPLOADS_ROOT = mkdtempSync(path.join(tmpdir(), "uploads-"));
    const owner = (await registerUser({ email: "ps-sample@e.com", password: "password1234", displayName: "O" }, "http://localhost:3000")).userId;
    const c = await createCourse(owner, { title: "Speakout sample", description: "x", slug: "ps-sample-course" });
    const m = await createModule(owner, c.courseId, { title: "Unit 1", orderIndex: 0 });
    const l = await createLesson(owner, m.moduleId, { title: "1.1 Reading", orderIndex: 0 });
    await importPractice(owner, l.lessonId, PracticeSpec.parse({ questions: [{ ...essay, aiFeedback: false }, { type: "essay", prompt: "No audio" }] }), 0, dir);

    const block = await prisma.contentItem.findFirstOrThrow({ where: { lessonId: l.lessonId, type: "exam_practice" } });
    const exam = await prisma.exam.findUniqueOrThrow({ where: { ownerContentItemId: block.id }, include: { questions: { orderBy: { orderInExam: "asc" } }, assets: true } });
    expect(exam.assets).toHaveLength(1);
    expect(exam.assets[0]).toMatchObject({ type: "audio", altText: "Sample answer audio" });
    const cfg = exam.questions[0]!.config as Record<string, unknown>;
    expect(cfg.explanationAudio).toBe(`/api/exam-assets/${exam.assets[0]!.s3Key}`);
    expect(cfg).toMatchObject({ aiFeedback: false, explanation: "It gives you energy." });
    expect(exam.questions[1]!.config as Record<string, unknown>).not.toHaveProperty("explanationAudio");
  });
});

describe("importAssignment (DB)", () => {
  it("tạo Bài tập nói (ghi âm) và viết (văn bản), mặc định không tính vào điểm", async () => {
    const owner = (await registerUser({ email: "ps-asg@e.com", password: "password1234", displayName: "O" }, "http://localhost:3000")).userId;
    const c = await createCourse(owner, { title: "Speakout asg", description: "x", slug: "ps-asg-course" });
    const m = await createModule(owner, c.courseId, { title: "Unit 1", orderIndex: 0 });
    const l = await createLesson(owner, m.moduleId, { title: "1.1 Speaking", orderIndex: 0 });
    await importAssignment(owner, l.lessonId, AssignmentSpec.parse({ title: "Talk about your lifestyle", description: "Record yourself.", responseFormat: "audio" }));
    await importAssignment(owner, l.lessonId, AssignmentSpec.parse({ title: "Write a paragraph", description: "Write 100 words.", countsTowardGrade: true }));
    const rows = await prisma.assignment.findMany({ where: { lessonId: l.lessonId }, orderBy: { createdAt: "asc" }, select: { title: true, responseFormat: true, countsTowardGrade: true } });
    expect(rows).toEqual([
      { title: "Talk about your lifestyle", responseFormat: "audio", countsTowardGrade: false },
      { title: "Write a paragraph", responseFormat: "text", countsTowardGrade: true },
    ]);
  });
});

describe("hội thoại đóng vai (roleplay) của câu essay", () => {
  const turns = [
    { speaker: "A", text: "Chocolate! It’s good for energy.", audio: "audio/rp-1.m4a" },
    { speaker: "B", text: "I was thinking the same thing.", audio: "audio/rp-2.m4a" },
    { speaker: "A", text: "Great, let’s take it." },
  ];
  const q = { type: "essay", prompt: "Role-play the conversation.", roleplay: { roles: { A: "Khách", B: "Chủ quán" }, turns } };

  it("đưa kịch bản và đường dẫn audio từng lượt vào cấu hình essay; lượt không audio thì không có khoá audio", () => {
    const p = PracticeSpec.parse({ questions: [q] });
    expect(practiceProblems(p, "bài")).toEqual([]);
    const cfg = expandExamQuestion(p.questions[0]!, undefined, ["/api/exam-assets/a.m4a", "/api/exam-assets/b.m4a", undefined]).config as {
      roleplay: { roles: unknown; turns: Array<Record<string, unknown>> };
    };
    expect(cfg.roleplay.roles).toEqual({ A: "Khách", B: "Chủ quán" });
    expect(cfg.roleplay.turns).toEqual([
      { speaker: "A", text: "Chocolate! It’s good for energy.", audio: "/api/exam-assets/a.m4a" },
      { speaker: "B", text: "I was thinking the same thing.", audio: "/api/exam-assets/b.m4a" },
      { speaker: "A", text: "Great, let’s take it." },
    ]);
  });

  it("dry-run: thiếu tệp audio của một lượt báo lỗi nói rõ lượt nào", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assets-"));
    mkdirSync(path.join(dir, "audio"));
    writeFileSync(path.join(dir, "audio", "rp-1.m4a"), "x");
    const msgs = assetProblems(PracticeSpec.parse({ questions: [q] }), dir, "bài");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/không thấy tệp audio lượt 2 của hội thoại "audio\/rp-2.m4a"/);
  });

  it("câu không phải essay có roleplay bị từ chối; ít hơn 2 lượt sai định dạng", () => {
    const mcq = PracticeSpec.parse({ questions: [{ type: "mcq", prompt: "Q", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }], roleplay: { turns } }] });
    expect(practiceProblems(mcq, "bài")[0]).toMatch(/roleplay chỉ dùng cho câu essay/);
    expect(PracticeSpec.safeParse({ questions: [{ ...q, roleplay: { turns: [turns[0]] } }] }).success).toBe(false);
  });
});
