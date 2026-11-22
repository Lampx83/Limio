import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { exportProfile } from "../profile";
import { deleteUser } from "../deleteUser";

/**
 * Chấm bài tập bằng AI hàng loạt (docs/tieu-chi/cham-bai-tap-bang-ai-hang-loat.md, AC7): gợi ý điểm/nhận xét AI về bài
 * nộp của học viên là dữ liệu cá nhân — nằm trong bản xuất của chính họ (không lẫn của người khác) và bị xoá khi
 * tài khoản bị xoá.
 */
async function setup(tag: string) {
  const u = await registerUser(
    { email: `ags-${tag}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: tag },
    "http://localhost:3000",
  );
  const course = await prisma.course.create({ data: { slug: `ags-${tag}-${Date.now()}-${Math.random()}`, title: "C", description: "x" } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "M", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "L", orderIndex: 0 } });
  const a = await prisma.assignment.create({ data: { lessonId: lesson.id, title: "A", description: "d" } });
  const sub = await prisma.assignmentSubmission.create({ data: { assignmentId: a.id, userId: u.userId, body: "Bài" } });
  const sug = await prisma.assignmentAiGradeSuggestion.create({
    data: {
      submissionId: sub.id,
      assignmentId: a.id,
      score: 6,
      feedback: `Nhận xét AI cho ${tag}`,
      rationale: "r",
      basedOnSubmissionUpdatedAt: new Date(),
    },
  });
  return { userId: u.userId, submissionId: sub.id, suggestionId: sug.id };
}

describe("gợi ý điểm AI — quyền riêng tư", () => {
  it("nằm trong bản xuất dữ liệu của chính người dùng, không lẫn của người khác", async () => {
    const a = await setup("a");
    const b = await setup("b");
    const out = await exportProfile(a.userId);
    const text = JSON.stringify(out!.assignmentSubmissions);
    expect(text).toContain("Nhận xét AI cho a");
    expect(text).not.toContain("Nhận xét AI cho b");
    expect(JSON.stringify(out)).not.toContain(b.submissionId);
  });

  it("xoá tài khoản xoá luôn gợi ý của người đó; của người khác còn nguyên", async () => {
    const a = await setup("del-a");
    const b = await setup("del-b");
    const admin = await registerUser({ email: `ags-admin-${Date.now()}@e.com`, password: "password1234", displayName: "Admin" }, "http://localhost:3000");
    await deleteUser(admin.userId, a.userId);
    expect(await prisma.assignmentAiGradeSuggestion.count({ where: { id: a.suggestionId } })).toBe(0);
    expect(await prisma.assignmentAiGradeSuggestion.count({ where: { id: b.suggestionId } })).toBe(1);
  });
});
