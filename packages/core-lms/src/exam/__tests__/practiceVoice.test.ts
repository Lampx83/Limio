import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { exportProfile } from "../../auth/profile";
import { deleteUser } from "../../auth/deleteUser";
import { enrollInCourse } from "../../learning/enroll";
import {
  ExamError,
  checkPracticeAnswer,
  completePracticeSession,
  createExam,
  createExamQuestion,
  createSection,
  getPracticeAnswerAudio,
  getPracticeForEmbed,
  getPracticeSession,
  getPracticeVoiceContext,
  publishExam,
  savePracticeAnswer,
  saveVoiceAnswer,
  startPracticeSession,
} from "../";

/**
 * Bài luyện: trả lời câu mở bằng giọng nói. Chỉ chủ buổi luyện, buổi còn dở, câu thuộc phạm vi, loại essay, không tắt
 * `voiceAnswer`; bản ghi âm cuối cùng được giữ, đổi đáp án thì mất kết quả kiểm tra và góp ý AI; dữ liệu riêng tư theo
 * người dùng (xuất, xoá).
 */

const BASE = "http://localhost:3000";
const META = { durationSec: 12.5, mimeType: "audio/webm", sizeBytes: 4096, metrics: { wpm: 90 } };

async function setup(slug: string) {
  const owner = await registerUser({ email: `pv-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `pv-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date(), language: "en", languageMode: true } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: "Luyện", durationMin: 30, mockMode: true });
  const sec = await createSection(owner.userId, examId, { title: "Nói", durationMin: 10, languageSkill: "speaking" });
  const essay = await createExamQuestion(owner.userId, examId, {
    type: "essay", prompt: "Talk about your day", config: { minWords: 5 }, points: 5, sectionId: sec.id,
  });
  const noVoice = await createExamQuestion(owner.userId, examId, {
    type: "essay", prompt: "Viết, không nói", config: { voiceAnswer: false }, points: 5, sectionId: sec.id,
  });
  const mcq = await createExamQuestion(owner.userId, examId, {
    type: "mcq", prompt: "M", sectionId: sec.id,
    config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
  });
  await publishExam(owner.userId, examId);
  const learner = await registerUser({ email: `pv-l-${slug}@e.com`, password: "password1234", displayName: "L" }, BASE);
  await enrollInCourse(learner.userId, course.courseId);
  const other = await registerUser({ email: `pv-x-${slug}@e.com`, password: "password1234", displayName: "X" }, BASE);
  await enrollInCourse(other.userId, course.courseId);
  const { sessionId } = await startPracticeSession(learner.userId, examId, { all: true });
  return {
    learnerId: learner.userId, otherId: other.userId, courseId: course.courseId, examId, sessionId,
    q: { essay: essay.questionId, noVoice: noVoice.questionId, mcq: mcq.questionId },
  };
}
type S = Awaited<ReturnType<typeof setup>>;
const key = (s: S, name: string) => `practice-answers/${s.sessionId}/${name}`;
const voice = (s: S, name: string, text = "I went to school today and learned a lot") => ({ text, audioKey: key(s, name), audioMeta: META });

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ExamError) return e.code;
    throw e;
  }
  return null;
}

describe("getPracticeVoiceContext", () => {
  it("trả ngôn ngữ, chế độ ngoại ngữ và công tắc của câu; chưa ghi âm thì previousAudioKey = null", async () => {
    const s = await setup("ctx");
    const c = await getPracticeVoiceContext(s.learnerId, s.sessionId, s.q.essay);
    expect(c).toEqual({
      examId: s.examId, courseId: s.courseId, language: "en", languageMode: true,
      voiceAnswer: true, aiFeedback: true, previousAudioKey: null,
    });
  });

  it("chỉ chủ buổi luyện; buổi phải còn dở; câu phải là essay còn bật voiceAnswer và thuộc phạm vi", async () => {
    const s = await setup("guard");
    expect(await codeOf(getPracticeVoiceContext(s.otherId, s.sessionId, s.q.essay))).toBe("practice_session_not_found");
    expect(await codeOf(getPracticeVoiceContext(s.learnerId, s.sessionId, s.q.mcq))).toBe("validation_failed");
    expect(await codeOf(getPracticeVoiceContext(s.learnerId, s.sessionId, s.q.noVoice))).toBe("validation_failed");
    expect(await codeOf(getPracticeVoiceContext(s.learnerId, s.sessionId, "00000000-0000-4000-8000-000000000000"))).toBe("validation_failed");
    await completePracticeSession(s.learnerId, s.sessionId);
    expect(await codeOf(getPracticeVoiceContext(s.learnerId, s.sessionId, s.q.essay))).toBe("practice_session_closed");
  });
});

describe("saveVoiceAnswer", () => {
  it("lưu bản chữ cùng dạng câu gõ tay + viaVoice và bản ghi âm; lần đầu không có previousAudioKey", async () => {
    const s = await setup("save");
    const r = await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    expect(r).toEqual({ previousAudioKey: null });
    const row = await prisma.examPracticeAnswer.findUniqueOrThrow({ where: { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } } });
    expect(row.answerJson).toEqual({ text: "I went to school today and learned a lot", viaVoice: true });
    expect(row.audioKey).toBe(key(s, "a-1.webm"));
    expect(row.audioMeta).toMatchObject({ durationSec: 12.5, mimeType: "audio/webm", sizeBytes: 4096 });
  });

  it("ghi lại thì trả previousAudioKey của bản cũ và chỉ giữ bản mới", async () => {
    const s = await setup("replace");
    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    const r = await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-2.webm", "Another answer here for you"));
    expect(r.previousAudioKey).toBe(key(s, "a-1.webm"));
    const row = await prisma.examPracticeAnswer.findUniqueOrThrow({ where: { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } } });
    expect(row.audioKey).toBe(key(s, "a-2.webm"));
    expect((await getPracticeVoiceContext(s.learnerId, s.sessionId, s.q.essay)).previousAudioKey).toBe(key(s, "a-2.webm"));
  });

  it("từ chối người khác, câu không phải essay, voiceAnswer:false, buổi đã đóng và dữ liệu rỗng", async () => {
    const s = await setup("deny");
    expect(await codeOf(saveVoiceAnswer(s.otherId, s.sessionId, s.q.essay, voice(s, "x.webm")))).toBe("practice_session_not_found");
    expect(await codeOf(saveVoiceAnswer(s.learnerId, s.sessionId, s.q.mcq, voice(s, "x.webm")))).toBe("validation_failed");
    expect(await codeOf(saveVoiceAnswer(s.learnerId, s.sessionId, s.q.noVoice, voice(s, "x.webm")))).toBe("validation_failed");
    expect(await codeOf(saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "x.webm", "   ")))).toBe("validation_failed");
    await completePracticeSession(s.learnerId, s.sessionId);
    expect(await codeOf(saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "x.webm")))).toBe("practice_session_closed");
    expect(await prisma.examPracticeAnswer.count({ where: { sessionId: s.sessionId, audioKey: { not: null } } })).toBe(0);
  });

  it("đổi đáp án (ghi âm lại hoặc gõ lại) làm mất kết quả kiểm tra và góp ý AI; gõ lại giữ bản ghi âm", async () => {
    const s = await setup("reset");
    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    await checkPracticeAnswer(s.learnerId, s.sessionId, s.q.essay);
    const where = { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } };
    const withFeedback = async () =>
      prisma.examPracticeAnswer.update({ where, data: { aiFeedback: { summary: "ok" }, aiFeedbackHash: "h", aiFeedbackAt: new Date() } });
    expect((await prisma.examPracticeAnswer.findUniqueOrThrow({ where })).checkedAt).not.toBeNull();
    await withFeedback();

    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-2.webm", "A completely different answer text"));
    let row = await prisma.examPracticeAnswer.findUniqueOrThrow({ where });
    expect(row.checkedAt).toBeNull();
    expect(row.isCorrect).toBeNull();
    expect(row.aiFeedback).toBeNull();
    expect(row.aiFeedbackHash).toBeNull();
    expect(row.aiFeedbackAt).toBeNull();

    await checkPracticeAnswer(s.learnerId, s.sessionId, s.q.essay);
    await withFeedback();
    await savePracticeAnswer(s.learnerId, s.sessionId, s.q.essay, { text: "Typed after speaking" });
    row = await prisma.examPracticeAnswer.findUniqueOrThrow({ where });
    expect(row.checkedAt).toBeNull();
    expect(row.aiFeedback).toBeNull();
    expect(row.audioKey).toBe(key(s, "a-2.webm"));
  });
});

describe("getPracticeAnswerAudio", () => {
  it("null khi chưa ghi âm; trả khoá và loại tệp cho chủ buổi; người khác bị từ chối", async () => {
    const s = await setup("audio");
    expect(await getPracticeAnswerAudio(s.learnerId, s.sessionId, s.q.essay)).toBeNull();
    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    expect(await getPracticeAnswerAudio(s.learnerId, s.sessionId, s.q.essay)).toEqual({ audioKey: key(s, "a-1.webm"), mimeType: "audio/webm" });
    expect(await codeOf(getPracticeAnswerAudio(s.otherId, s.sessionId, s.q.essay))).toBe("practice_session_not_found");
    // buổi đã đóng vẫn nghe lại được bài của mình
    await completePracticeSession(s.learnerId, s.sessionId);
    expect(await getPracticeAnswerAudio(s.learnerId, s.sessionId, s.q.essay)).not.toBeNull();
  });
});

describe("hasAudio và aiFeedback trong dữ liệu buổi luyện", () => {
  it("getPracticeSession và getPracticeForEmbed khôi phục bản ghi âm và góp ý; không lộ khoá tệp", async () => {
    const s = await setup("session");
    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    await savePracticeAnswer(s.learnerId, s.sessionId, s.q.mcq, { optionIds: ["a"] });
    const where = { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } };
    await prisma.examPracticeAnswer.update({ where, data: { aiFeedback: { summary: "Tốt" } } });

    const sess = await getPracticeSession(s.learnerId, s.sessionId);
    const a = sess.answers.find((x) => x.questionId === s.q.essay)!;
    expect(a.hasAudio).toBe(true);
    expect(a.aiFeedback).toEqual({ summary: "Tốt" });
    const m = sess.answers.find((x) => x.questionId === s.q.mcq)!;
    expect(m.hasAudio).toBe(false);
    expect(m.aiFeedback).toBeNull();
    expect(JSON.stringify(sess.answers)).not.toContain("practice-answers");

    const embed = await getPracticeForEmbed(s.learnerId, s.examId);
    expect(embed.answers.find((x) => x.questionId === s.q.essay)).toMatchObject({ hasAudio: true, aiFeedback: { summary: "Tốt" } });
  });
});

describe("quyền riêng tư của bản ghi âm", () => {
  it("bản xuất dữ liệu của chính người dùng có góp ý AI và khoá tệp, không lẫn người khác", async () => {
    const s = await setup("export");
    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    await prisma.examPracticeAnswer.update({
      where: { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } },
      data: { aiFeedback: { summary: "Góp ý riêng" } },
    });
    const mine = JSON.stringify(await exportProfile(s.learnerId));
    expect(mine).toContain("Góp ý riêng");
    expect(mine).toContain(key(s, "a-1.webm"));
    expect(JSON.stringify(await exportProfile(s.otherId))).not.toContain(key(s, "a-1.webm"));
  });

  it("deleteUser trả khoá file ghi âm, gỡ liên kết và góp ý; không đụng người khác", async () => {
    const s = await setup("delete");
    await saveVoiceAnswer(s.learnerId, s.sessionId, s.q.essay, voice(s, "a-1.webm"));
    await prisma.examPracticeAnswer.update({
      where: { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } },
      data: { aiFeedback: { summary: "Góp ý riêng" } },
    });
    const { sessionId: otherSession } = await startPracticeSession(s.otherId, s.examId, { all: true });
    await saveVoiceAnswer(s.otherId, otherSession, s.q.essay, { text: "Other answer text", audioKey: `practice-answers/${otherSession}/b.webm`, audioMeta: META });

    const admin = await registerUser({ email: `pv-admin-delete@e.com`, password: "password1234", displayName: "Admin" }, BASE);
    const r = await deleteUser(admin.userId, s.learnerId);
    expect(r.removedFiles).toEqual([key(s, "a-1.webm")]);
    const row = await prisma.examPracticeAnswer.findUniqueOrThrow({ where: { sessionId_questionId: { sessionId: s.sessionId, questionId: s.q.essay } } });
    expect(row.audioKey).toBeNull();
    expect(row.audioMeta).toBeNull();
    expect(row.aiFeedback).toBeNull();

    const other = await prisma.examPracticeAnswer.findUniqueOrThrow({ where: { sessionId_questionId: { sessionId: otherSession, questionId: s.q.essay } } });
    expect(other.audioKey).toBe(`practice-answers/${otherSession}/b.webm`);
  });
});
