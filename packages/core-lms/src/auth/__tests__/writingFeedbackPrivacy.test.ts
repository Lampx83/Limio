import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { exportProfile } from "../profile";
import { deleteUser } from "../deleteUser";

/**
 * LANG G6e.1 — góp ý bài viết do AI chứa trích đoạn bài viết riêng của học viên và đã được gửi tới
 * nhà cung cấp AI: phải nằm trong bản xuất dữ liệu của CHÍNH họ (không lẫn của người khác) và bị
 * xoá khi tài khoản bị xoá.
 */

async function setup(tag: string) {
  const u = await registerUser(
    { email: `wfp-${tag}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: tag },
    "http://localhost:3000",
  );
  const course = await prisma.course.create({ data: { slug: `wfp-${tag}-${Date.now()}-${Math.random()}`, title: "C", description: "x" } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "M", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "L", orderIndex: 0 } });
  const a = await prisma.assignment.create({ data: { lessonId: lesson.id, title: "A", description: "d" } });
  const sub = await prisma.assignmentSubmission.create({ data: { assignmentId: a.id, userId: u.userId, body: "The weather are nice" } });
  const fb = await prisma.writingFeedback.create({
    data: {
      submissionId: sub.id, userId: u.userId, courseId: course.id, submissionHash: "h", model: "qwen3.5-35b-a3b-int4",
      tokensIn: 1, tokensOut: 1, level: "task", levels: ["task"], elaboration: "kcr", sourceKind: "llm", generationContext: {},
      body: { summary: "s", criteria: [], errors: [{ id: "1", category: "grammar", quote: "The weather are nice", correction: "is", explanation: "e" }], nextSteps: [], dropped: 0 },
    },
  });
  return { userId: u.userId, feedbackId: fb.id };
}

describe("góp ý bài viết AI — quyền riêng tư (G6e.1)", () => {
  it("nằm trong bản xuất dữ liệu của chính người dùng, không lẫn của người khác", async () => {
    const a = await setup("a");
    const b = await setup("b");
    const out = await exportProfile(a.userId);
    const list = out!.writingFeedbacksReceived;
    expect(list.map((x) => x.id)).toEqual([a.feedbackId]);
    expect(JSON.stringify(list)).toContain("The weather are nice");
    expect(list.map((x) => x.id)).not.toContain(b.feedbackId);
  });

  it("xoá tài khoản (ẩn danh hoá) xoá luôn các góp ý bài viết của người đó; của người khác còn nguyên", async () => {
    const a = await setup("del-a");
    const b = await setup("del-b");
    const admin = await registerUser({ email: `wfp-admin-${Date.now()}@e.com`, password: "password1234", displayName: "Admin" }, "http://localhost:3000");
    await deleteUser(admin.userId, a.userId);
    expect(await prisma.writingFeedback.count({ where: { userId: a.userId } })).toBe(0);
    expect(await prisma.writingFeedback.count({ where: { userId: b.userId } })).toBe(1);
  });
});
