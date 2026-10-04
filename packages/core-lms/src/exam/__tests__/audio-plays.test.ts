import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  claimAudioPlay,
  audioPlayLimit,
  createExam,
  createExamQuestion,
  createPassage,
  createSection,
  getAttemptRuntime,
  publishExam,
  startExamAttempt,
  endCurrentSection,
} from "../";

/**
 * LANG G5b — nghe một lần / giới hạn lượt phát trong đề thi thử.
 * Máy chủ cấp từng lượt phát (không chống tải file — nói thẳng giới hạn này);
 * chỉ áp cho đề `mockMode`, đề thường giữ nguyên.
 */

const BASE = "http://localhost:3000";
const AUDIO = "/api/exam-assets/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa.mp3";
const AUDIO_2 = "/api/exam-assets/bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb.mp3";
const doc = (...srcs: string[]) => ({
  type: "doc",
  content: srcs.map((src) => ({ type: "audio", attrs: { src, alt: "Bài nghe" } })),
});
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
};

interface Opts {
  mock?: boolean;
  policy?: "free_replay" | "limited_replay" | "once_only";
  max?: number;
  /** passage thứ hai nằm ở phần 2 (để thử "phần không hoạt động") */
  twoSections?: boolean;
}

async function setup(slug: string, o: Opts = {}) {
  const { mock = true, policy = "once_only", max, twoSections = false } = o;
  const owner = await registerUser({ email: `ap-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `ap-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date() } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: "Nghe", durationMin: 30, mockMode: mock });
  const sectionIds: string[] = [];
  const passageIds: string[] = [];
  const n = twoSections ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const { id: sectionId } = await createSection(owner.userId, examId, { title: `Phần ${i + 1}`, durationMin: 20, languageSkill: "listening" });
    const { passageId } = await createPassage(owner.userId, examId, {
      title: `P${i + 1}`,
      contentJson: doc(AUDIO, AUDIO_2),
      audioPolicy: policy,
      ...(policy === "limited_replay" ? { maxAudioPlays: max ?? 2 } : {}),
    });
    await createExamQuestion(owner.userId, examId, { ...MCQ, passageId, sectionId });
    sectionIds.push(sectionId);
    passageIds.push(passageId);
  }
  await publishExam(owner.userId, examId);
  const learner = await registerUser({ email: `ap-l-${slug}@e.com`, password: "password1234", displayName: "L" }, BASE);
  await enrollInCourse(learner.userId, course.courseId);
  const { attemptId } = await startExamAttempt(learner.userId, examId);
  const subject = { kind: "user" as const, userId: learner.userId };
  return { ownerId: owner.userId, examId, attemptId, passageIds, sectionIds, subject, learnerId: learner.userId };
}

let counter = 0;
const pid = () => `play-${Date.now()}-${counter++}`;

describe("audioPlayLimit (thuần)", () => {
  it("free_replay không giới hạn; limited_replay theo maxAudioPlays; once_only đúng 1", () => {
    expect(audioPlayLimit("free_replay", null)).toBeNull();
    expect(audioPlayLimit("limited_replay", 3)).toBe(3);
    expect(audioPlayLimit("once_only", null)).toBe(1);
    expect(audioPlayLimit("once_only", 5)).toBe(1); // maxAudioPlays không có nghĩa với once_only
  });
  it("limited_replay thiếu maxAudioPlays (dữ liệu hỏng) → coi như 1, không bao giờ vô hạn", () => {
    expect(audioPlayLimit("limited_replay", null)).toBe(1);
    expect(audioPlayLimit("limited_replay", 0)).toBe(1);
  });
});

describe("claimAudioPlay — G5b.1 / G5b.2 / G5b.3", () => {
  it("once_only: lượt đầu được (còn 0), lượt thứ hai bị từ chối audio_plays_exhausted", async () => {
    const s = await setup("once");
    const a = await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() });
    expect(a).toMatchObject({ unlimited: false, limit: 1, used: 1, remaining: 0 });
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "audio_plays_exhausted" });
  });

  it("limited_replay (2 lượt): còn 1 rồi còn 0, lượt thứ ba bị từ chối", async () => {
    const s = await setup("lim", { policy: "limited_replay", max: 2 });
    const first = await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() });
    expect(first).toMatchObject({ limit: 2, used: 1, remaining: 1 });
    const second = await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() });
    expect(second).toMatchObject({ used: 2, remaining: 0 });
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "audio_plays_exhausted" });
  });

  it("G5b.2: gửi lại cùng playId (mất mạng) không tính hai lần và vẫn trả kết quả như lần đầu", async () => {
    const s = await setup("idem");
    const id = pid();
    const a = await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: id });
    const b = await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: id });
    expect(b).toEqual(a);
    expect(await prisma.examAudioPlay.count({ where: { attemptId: s.attemptId } })).toBe(1);
  });

  it("G5b.3: lượt đã dùng được máy chủ nhớ — vào lại (runtime mới) vẫn thấy đã dùng, không có thêm lượt", async () => {
    const s = await setup("persist");
    await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() });
    const rt = await getAttemptRuntime(s.subject, s.attemptId);
    expect(rt.audioPlays).toEqual([{ passageId: s.passageIds[0]!, audioKey: AUDIO, used: 1 }]);
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "audio_plays_exhausted" });
  });

  it("mỗi audio trong cùng một bài có hạn mức riêng", async () => {
    const s = await setup("two-audio");
    await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() });
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO_2, playId: pid() }),
    ).resolves.toMatchObject({ used: 1, remaining: 0 });
  });

  it("hai yêu cầu song song (playId khác nhau) với hạn mức 1: đúng một cái được, cái kia bị từ chối", async () => {
    const s = await setup("race");
    const claim = () => claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() });
    const results = await Promise.allSettled([claim(), claim(), claim(), claim()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected" && (r.reason as { code?: string }).code === "audio_plays_exhausted")).toHaveLength(3);
    expect(await prisma.examAudioPlay.count({ where: { attemptId: s.attemptId } })).toBe(1);
  });

  it("free_replay: không giới hạn và không ghi dòng nào", async () => {
    const s = await setup("free", { policy: "free_replay" });
    for (let i = 0; i < 4; i++) {
      await expect(
        claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
      ).resolves.toMatchObject({ unlimited: true });
    }
    expect(await prisma.examAudioPlay.count({ where: { attemptId: s.attemptId } })).toBe(0);
  });
});

describe("claimAudioPlay — chặn gian lận và hồi quy", () => {
  it("G5b.6: đề thường (không mockMode) không bị giới hạn dù bài đặt once_only, và không ghi gì", async () => {
    const s = await setup("regular", { mock: false });
    for (let i = 0; i < 3; i++) {
      await expect(
        claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
      ).resolves.toMatchObject({ unlimited: true });
    }
    expect(await prisma.examAudioPlay.count({ where: { attemptId: s.attemptId } })).toBe(0);
  });

  it("audioKey không có trong bài (bịa để xin hạn mức mới) → validation_failed", async () => {
    const s = await setup("fake-key");
    await claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }); // đối chứng: key thật được
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: "/api/exam-assets/khong-co.mp3", playId: pid() }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("bài của đề khác → validation_failed", async () => {
    const a = await setup("x-a");
    const b = await setup("x-b");
    await expect(
      claimAudioPlay(a.subject, a.attemptId, { passageId: b.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("bài thuộc phần chưa mở/đã đóng (đề thi thử) → section_not_active; không ghi lượt", async () => {
    const s = await setup("sect", { twoSections: true });
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[1]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "section_not_active" });
    expect(await prisma.examAudioPlay.count({ where: { attemptId: s.attemptId } })).toBe(0);
    // nộp phần 1 rồi: phần 2 mở, xin lượt bài 2 được; bài 1 (phần đã đóng) bị khoá
    await endCurrentSection(s.subject, s.attemptId);
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[1]!, audioKey: AUDIO, playId: pid() }),
    ).resolves.toMatchObject({ used: 1 });
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "section_not_active" });
  });

  it("người khác không xin lượt hộ được", async () => {
    const s = await setup("other");
    await expect(
      claimAudioPlay({ kind: "user", userId: s.ownerId }, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "attempt_belongs_to_other" });
  });

  it("lượt thi đã nộp → attempt_already_submitted", async () => {
    const s = await setup("done");
    await endCurrentSection(s.subject, s.attemptId); // phần duy nhất → nộp cả bài
    await expect(
      claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId: pid() }),
    ).rejects.toMatchObject({ code: "attempt_already_submitted" });
  });

  it("playId rỗng hoặc quá dài → validation_failed", async () => {
    const s = await setup("badid");
    for (const playId of ["", "x".repeat(101)]) {
      await expect(
        claimAudioPlay(s.subject, s.attemptId, { passageId: s.passageIds[0]!, audioKey: AUDIO, playId }),
      ).rejects.toMatchObject({ code: "validation_failed" });
    }
  });

  it("đề thường: runtime.audioPlays là mảng rỗng", async () => {
    const s = await setup("rt-reg", { mock: false });
    expect((await getAttemptRuntime(s.subject, s.attemptId)).audioPlays).toEqual([]);
  });
});
