import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { countPendingAiFeedback, listPendingAiFeedback } from "../aiReviewQueue";

/** LANG L3.1 — hàng đợi "Góp ý AI chờ duyệt" (bản nháp Viết + Nói) cho giảng viên, theo khoá. */

let seq = 0;
const uid = () => `${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;

async function fixture() {
  const course = await prisma.course.create({ data: { slug: `q-${uid()}`, title: "C", description: "x", languageMode: true, personalizationEnabled: true } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "M", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "L", orderIndex: 0 } });
  const a = await prisma.assignment.create({ data: { lessonId: lesson.id, title: "Bài tập", description: "d" } });
  const user = await prisma.user.create({ data: { email: `q-${uid()}@e.com`, passwordHash: "x", displayName: `HV ${seq}` } });
  const sub = await prisma.assignmentSubmission.create({ data: { assignmentId: a.id, userId: user.id, body: "x" } });
  return { courseId: course.id, userId: user.id, submissionId: sub.id, assignmentId: a.id };
}

const base = { tokensIn: 1, tokensOut: 1, level: "task" as const, levels: ["task"], elaboration: "kcr" as const, sourceKind: "llm" as const, generationContext: {}, body: { summary: "s", criteria: [], errors: [], nextSteps: [], dropped: 0 } };

async function writing(f: Awaited<ReturnType<typeof fixture>>, status: "draft" | "approved" | "rejected", at = new Date()) {
  return prisma.writingFeedback.create({ data: { ...base, submissionId: f.submissionId, userId: f.userId, courseId: f.courseId, submissionHash: uid(), model: "m", status, generatedAt: at } });
}
async function speaking(f: Awaited<ReturnType<typeof fixture>>, status: "draft" | "approved" | "rejected", at = new Date()) {
  const t = await prisma.submissionTranscript.create({
    data: { submissionId: f.submissionId, userId: f.userId, courseId: f.courseId, audioUrl: `/api/assignment-media/${uid()}.webm`, textHash: "h", text: "x", metrics: {}, durationSec: 5, model: "whisper-1" },
  });
  return prisma.speakingFeedback.create({ data: { ...base, submissionId: f.submissionId, transcriptId: t.id, userId: f.userId, courseId: f.courseId, transcriptHash: "h", model: "m", status, generatedAt: at } });
}

describe("countPendingAiFeedback", () => {
  it("chỉ đếm bản NHÁP (chưa duyệt) của Viết và Nói trong các khoá được hỏi", async () => {
    const a = await fixture();
    const b = await fixture();
    await writing(a, "draft");
    await writing(a, "approved");
    await writing(a, "rejected");
    await speaking(a, "draft");
    await speaking(b, "draft"); // khoá khác: không tính khi chỉ hỏi khoá a
    expect(await countPendingAiFeedback([a.courseId])).toEqual({ writing: 1, speaking: 1, total: 2 });
    expect(await countPendingAiFeedback([a.courseId, b.courseId])).toEqual({ writing: 1, speaking: 2, total: 3 });
  });
  it("không có khoá nào → 0, không truy vấn lỗi", async () => {
    expect(await countPendingAiFeedback([])).toEqual({ writing: 0, speaking: 0, total: 0 });
  });
});

describe("listPendingAiFeedback", () => {
  it("trả bản nháp cũ nhất trước, gộp Viết + Nói, kèm tên học viên và bài nộp để bấm tới duyệt; tôn trọng giới hạn", async () => {
    const f = await fixture();
    const t0 = Date.now();
    await writing(f, "draft", new Date(t0 - 3000));
    await speaking(f, "draft", new Date(t0 - 9000));
    await writing(f, "approved", new Date(t0 - 20000));
    const list = await listPendingAiFeedback([f.courseId], 10);
    expect(list.map((x) => x.kind)).toEqual(["speaking", "writing"]);
    expect(list[0]).toMatchObject({ submissionId: f.submissionId, assignmentId: f.assignmentId, courseId: f.courseId });
    expect(list[0]!.studentName).toMatch(/^HV/);
    expect(await listPendingAiFeedback([f.courseId], 1)).toHaveLength(1);
  });
});
