import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { exportProfile } from "../profile";
import { deleteUser } from "../deleteUser";

/**
 * LANG G7e.1 — bản ghi âm, bản chữ và góp ý bài nói là lời nói riêng của học viên (đã gửi tới nhà cung cấp
 * AI): nằm trong bản xuất dữ liệu của CHÍNH họ và bị xoá khi tài khoản bị xoá — kể cả file ghi âm.
 */

async function setup(tag: string) {
  const u = await registerUser(
    { email: `sfp-${tag}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: tag },
    "http://localhost:3000",
  );
  const course = await prisma.course.create({ data: { slug: `sfp-${tag}-${Date.now()}-${Math.random()}`, title: "C", description: "x" } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "M", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "L", orderIndex: 0 } });
  const speak = await prisma.assignment.create({ data: { lessonId: lesson.id, title: "Nói", description: "d", responseFormat: "audio" } });
  const other = await prisma.assignment.create({ data: { lessonId: lesson.id, title: "Ảnh", description: "d", responseFormat: "image" } });
  const audioFile = `${u.userId}-1700000000000-aaaa1111.webm`;
  const imageFile = `${u.userId}-1700000000001-bbbb2222.png`;
  const sub = await prisma.assignmentSubmission.create({
    data: { assignmentId: speak.id, userId: u.userId, body: "(bài nói)", attachmentUrl: `/api/assignment-media/${audioFile}` },
  });
  const imgSub = await prisma.assignmentSubmission.create({
    data: { assignmentId: other.id, userId: u.userId, body: "ảnh", attachmentUrl: `/api/assignment-media/${imageFile}` },
  });
  const tr = await prisma.submissionTranscript.create({
    data: {
      submissionId: sub.id, userId: u.userId, courseId: course.id, audioUrl: sub.attachmentUrl!, textHash: "h",
      text: "Hello my name is Anna", metrics: { silent: false }, durationSec: 30, model: "whisper-1",
    },
  });
  const fb = await prisma.speakingFeedback.create({
    data: {
      submissionId: sub.id, transcriptId: tr.id, userId: u.userId, courseId: course.id, transcriptHash: "h", model: "gpt-4o-mini",
      tokensIn: 1, tokensOut: 1, level: "task", levels: ["task"], elaboration: "kcr", sourceKind: "llm", generationContext: {},
      body: { summary: "s", criteria: [], errors: [], nextSteps: [], dropped: 0 },
    },
  });
  return { userId: u.userId, transcriptId: tr.id, feedbackId: fb.id, audioFile, imageFile, imgSubId: imgSub.id };
}

describe("bài nói — quyền riêng tư (G7e.1)", () => {
  it("bản chữ và góp ý nằm trong bản xuất dữ liệu của chính người dùng, không lẫn của người khác", async () => {
    const a = await setup("a");
    const b = await setup("b");
    const out = await exportProfile(a.userId);
    expect(out.submissionTranscripts.map((x) => x.id)).toEqual([a.transcriptId]);
    expect(out.speakingFeedbacksReceived.map((x) => x.id)).toEqual([a.feedbackId]);
    expect(JSON.stringify(out.submissionTranscripts)).toContain("Hello my name is Anna");
    expect(JSON.stringify(out.submissionTranscripts)).toContain(a.audioFile); // link tới file ghi âm
    expect(JSON.stringify(out)).not.toContain(b.audioFile);
  });

  it("xoá tài khoản xoá bản chữ + góp ý, gỡ liên kết file ghi âm và TRẢ DANH SÁCH file cần xoá khỏi kho; ảnh nộp không bị đụng", async () => {
    const a = await setup("del-a");
    const b = await setup("del-b");
    const admin = await registerUser({ email: `sfp-admin-${Date.now()}@e.com`, password: "password1234", displayName: "Admin" }, "http://localhost:3000");
    const r = await deleteUser(admin.userId, a.userId);
    expect(r.removedFiles).toEqual([a.audioFile]);
    expect(await prisma.submissionTranscript.count({ where: { userId: a.userId } })).toBe(0);
    expect(await prisma.speakingFeedback.count({ where: { userId: a.userId } })).toBe(0);
    const audioSub = await prisma.assignmentSubmission.findFirstOrThrow({ where: { userId: a.userId, assignment: { responseFormat: "audio" } } });
    expect(audioSub.attachmentUrl).toBeNull();
    const img = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: a.imgSubId } });
    expect(img.attachmentUrl).toContain(a.imageFile);
    // Người khác nguyên vẹn.
    expect(await prisma.submissionTranscript.count({ where: { userId: b.userId } })).toBe(1);
    expect(await prisma.speakingFeedback.count({ where: { userId: b.userId } })).toBe(1);
  });
});
