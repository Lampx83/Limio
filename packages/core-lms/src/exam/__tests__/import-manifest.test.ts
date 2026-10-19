import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { importExamManifest } from "../import-manifest";

/**
 * LANG L6.8 — nhập hàng loạt đề từ manifest JSON: xem trước báo lỗi theo dòng, tạo ở trạng thái nháp, chạy lại
 * không tạo trùng, một đề lỗi không chặn đề khác.
 */

const BASE = "http://localhost:3000";
async function setup(slug: string) {
  const owner = await registerUser({ email: `im-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `im-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { kind: "practice_bank", status: "published", publishedAt: new Date() } });
  return { ownerId: owner.userId, courseId: course.courseId };
}

const q = (prompt: string, right = 0) => ({
  type: "mcq" as const,
  prompt,
  options: ["A", "B", "C"].map((label, i) => ({ label, ...(i === right ? { correct: true } : {}) })),
});
const exam = (over: Record<string, unknown> = {}) => ({
  title: "Đề 1",
  skill: "listening",
  seq: 1,
  sourceLabel: "HSK 2023-05",
  collection: "Phần 1",
  paperType: "official",
  difficulty: 3,
  passages: [{ title: "Hội thoại 1", text: "你好，请问洗手间在哪儿？", audioUrl: "/api/lesson-media/audio/a.mp3", audioPolicy: "limited_replay", maxAudioPlays: 2 }],
  questions: [{ ...q("Người hỏi gì?"), passage: 0 }, q("Câu 2", 1)],
  ...over,
});

describe("importExamManifest", () => {
  it("dry-run: báo would_create, KHÔNG ghi gì vào DB (kể cả bộ)", async () => {
    const s = await setup("dry");
    const r = await importExamManifest(s.ownerId, s.courseId, { exams: [exam()] }, { dryRun: true });
    expect(r.results[0]).toMatchObject({ index: 0, title: "Đề 1", status: "would_create", errors: [] });
    expect(r.summary).toMatchObject({ total: 1, created: 0, wouldCreate: 1, skipped: 0, failed: 0 });
    expect(await prisma.exam.count({ where: { courseId: s.courseId } })).toBe(0);
    expect(await prisma.examCollection.count({ where: { courseId: s.courseId } })).toBe(0);
  });

  it("tạo thật: đề NHÁP một phần đúng kỹ năng, bộ tự tạo, bài đọc có audio + giới hạn lượt, câu hỏi gắn đúng bài/phần, đáp án đúng", async () => {
    const s = await setup("real");
    const r = await importExamManifest(s.ownerId, s.courseId, { exams: [exam()] }, {});
    expect(r.results[0]).toMatchObject({ status: "created" });
    const e = await prisma.exam.findFirstOrThrow({
      where: { courseId: s.courseId },
      include: { sections: true, passages: true, questions: { orderBy: { orderInExam: "asc" }, include: { sectionItem: true } }, collection: true },
    });
    expect(e).toMatchObject({ title: "Đề 1", status: "draft", mockMode: true, seq: 1, sourceLabel: "HSK 2023-05", paperType: "official", difficulty: 3 });
    expect(e.collection?.title).toBe("Phần 1");
    expect(e.sections.map((x) => x.languageSkill)).toEqual(["listening"]);
    expect(e.passages).toHaveLength(1);
    expect(e.passages[0]).toMatchObject({ audioPolicy: "limited_replay", maxAudioPlays: 2 });
    expect(JSON.stringify(e.passages[0]!.contentJson)).toContain("/api/lesson-media/audio/a.mp3");
    expect(e.questions).toHaveLength(2);
    expect(e.questions[0]!.passageId).toBe(e.passages[0]!.id);
    expect(e.questions[1]!.passageId).toBeNull();
    expect(e.questions.every((x) => x.sectionItem?.sectionId === e.sections[0]!.id)).toBe(true);
    const opts = (e.questions[0]!.config as { options: { label: string; isCorrect: boolean }[] }).options;
    expect(opts.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(["A"]);
    const opts2 = (e.questions[1]!.config as { options: { label: string; isCorrect: boolean }[] }).options;
    expect(opts2.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(["B"]);
  });

  it("chạy lại cùng manifest KHÔNG tạo trùng (nhận biết theo nguồn + số thứ tự); bộ được dùng lại", async () => {
    const s = await setup("idem");
    await importExamManifest(s.ownerId, s.courseId, { exams: [exam(), exam({ title: "Đề 2", seq: 2 })] }, {});
    const r = await importExamManifest(s.ownerId, s.courseId, { exams: [exam(), exam({ title: "Đề 2", seq: 2 }), exam({ title: "Đề 3", seq: 3 })] }, {});
    expect(r.results.map((x) => x.status)).toEqual(["skipped_duplicate", "skipped_duplicate", "created"]);
    expect(await prisma.exam.count({ where: { courseId: s.courseId } })).toBe(3);
    expect(await prisma.examCollection.count({ where: { courseId: s.courseId } })).toBe(1);
  });

  it("một đề lỗi KHÔNG chặn các đề khác; lỗi nêu rõ theo đề, và không để lại đề dở", async () => {
    const s = await setup("err");
    const r = await importExamManifest(
      s.ownerId,
      s.courseId,
      {
        exams: [
          exam({ title: "Tốt", seq: 1 }),
          exam({ title: "Hai đáp án đúng", seq: 2, questions: [{ type: "mcq", prompt: "?", options: [{ label: "A", correct: true }, { label: "B", correct: true }] }] }),
          exam({ title: "Không có câu", seq: 3, questions: [] }),
          exam({ title: "Audio ngoài", seq: 4, passages: [{ title: "P", text: "x", audioUrl: "https://evil.example.com/a.mp3" }], questions: [{ ...q("?"), passage: 0 }] }),
          exam({ title: "Bài đọc không tồn tại", seq: 5, questions: [{ ...q("?"), passage: 7 }] }),
          exam({ title: "Thiếu kỹ năng", seq: 6, skill: undefined }),
          exam({ title: "Độ khó 9", seq: 7, difficulty: 9 }),
        ],
      },
      {},
    );
    expect(r.results.map((x) => x.status)).toEqual(["created", "error", "error", "error", "error", "error", "error"]);
    for (const x of r.results.slice(1)) expect(x.errors.length).toBeGreaterThan(0);
    expect(r.results[3]!.errors.join(" ")).toMatch(/audio/i);
    expect(r.summary).toMatchObject({ created: 1, failed: 6 });
    expect(await prisma.exam.count({ where: { courseId: s.courseId } })).toBe(1);
  });

  it("defaultSkill áp cho đề không khai kỹ năng", async () => {
    const s = await setup("def");
    const r = await importExamManifest(s.ownerId, s.courseId, { exams: [exam({ skill: undefined })] }, { defaultSkill: "reading" });
    expect(r.results[0]).toMatchObject({ status: "created" });
    const sec = await prisma.examSection.findFirstOrThrow({ where: { exam: { courseId: s.courseId } } });
    expect(sec.languageSkill).toBe("reading");
  });

  it("trùng (nguồn + số thứ tự) NGAY TRONG manifest: đề sau báo lỗi, không tạo hai bản", async () => {
    const s = await setup("dupin");
    const r = await importExamManifest(s.ownerId, s.courseId, { exams: [exam(), exam({ title: "Đề trùng" })] }, {});
    expect(r.results.map((x) => x.status)).toEqual(["created", "error"]);
    expect(r.results[1]!.errors.join(" ")).toMatch(/trùng|duplicate/i);
  });

  it("publish=true: đề hợp lệ được xuất bản ngay; vẫn là 'created'", async () => {
    const s = await setup("pub");
    const r = await importExamManifest(s.ownerId, s.courseId, { exams: [exam()] }, { publish: true });
    expect(r.results[0]).toMatchObject({ status: "created", published: true });
    expect((await prisma.exam.findFirstOrThrow({ where: { courseId: s.courseId } })).status).toBe("published");
  });

  it("manifest sai hình dạng / quá 500 đề / người không có quyền → bị từ chối", async () => {
    const s = await setup("bad");
    await expect(importExamManifest(s.ownerId, s.courseId, { nope: 1 }, {})).rejects.toMatchObject({ code: "validation_failed" });
    await expect(importExamManifest(s.ownerId, s.courseId, { exams: Array.from({ length: 501 }, () => exam()) }, {})).rejects.toMatchObject({ code: "validation_failed" });
    const stranger = await registerUser({ email: "im-x-bad@e.com", password: "password1234", displayName: "X" }, BASE);
    await expect(importExamManifest(stranger.userId, s.courseId, { exams: [exam()] }, {})).rejects.toBeTruthy();
  });
});
