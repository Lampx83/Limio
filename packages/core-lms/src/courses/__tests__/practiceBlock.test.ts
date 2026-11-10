import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse, duplicateCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson, duplicateLesson } from "../lessons";
import { createContentItem, updateContentItem } from "../contents";
import { listSelectablePracticeExams } from "../practiceBlock";
import { CourseAuthzError } from "../authz";
import {
  checkPracticeAnswer,
  createExam,
  createExamQuestion,
  createSection,
  getPracticeForEmbed,
  publishExam,
  savePracticeAnswer,
  startPracticeSession,
  updateExam,
} from "../../exam";

/**
 * LANG đợt 3b — khối "Bài luyện" (exam_practice) của bài học: chọn đề đúng điều kiện, dữ liệu nhúng không lộ
 * đáp án, nhân bản khoá không trỏ nhầm sang đề khoá khác.
 */

const BASE = "http://localhost:3000";
const mcq = (prompt: string) => ({
  type: "mcq" as const,
  prompt,
  config: { explanation: "Vì A đúng", options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
});

async function user(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

/** Khoá + bài + một đề thi thử (mặc định đã xuất bản) có 2 câu và 1 đoạn văn. */
async function setup(tag: string, o: { publish?: boolean; mock?: boolean } = {}) {
  const owner = await user(`pb-o-${tag}@e.com`);
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `pb-${tag}` });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published", publishedAt: new Date() } });
  const m = await createModule(owner, c.courseId, { title: "U1", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  const { examId } = await createExam(owner, c.courseId, { title: `Đề ${tag}`, durationMin: 30, mockMode: o.mock ?? true });
  const sec = await createSection(owner, examId, { title: "Đọc", durationMin: 10, languageSkill: "reading" });
  const passage = await prisma.examPassage.create({
    data: { examId, title: "Đoạn 1", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung đoạn văn." }] }] }, orderIndex: 0 },
  });
  const q1 = await createExamQuestion(owner, examId, { ...mcq("Câu 1"), sectionId: sec.id });
  await prisma.examQuestion.update({ where: { id: q1.questionId }, data: { passageId: passage.id, orderInPassage: 0 } });
  const q2 = await createExamQuestion(owner, examId, { ...mcq("Câu 2"), sectionId: sec.id });
  if (o.publish ?? true) await publishExam(owner, examId);
  return { owner, courseId: c.courseId, lessonId: l.lessonId, moduleId: m.moduleId, examId, q1: q1.questionId, q2: q2.questionId, passageId: passage.id };
}

const block = (examId: string, title?: string) => ({ type: "exam_practice", payload: { examId, ...(title ? { title } : {}) }, orderIndex: 0 });

describe("khối Bài luyện: chọn đề", () => {
  it("chọn được đề thi thử đã xuất bản của cùng khoá; payload lưu đúng", async () => {
    const s = await setup("ok");
    const { contentItemId } = await createContentItem(s.owner, s.lessonId, block(s.examId, "  Luyện đọc  "));
    const row = await prisma.contentItem.findUnique({ where: { id: contentItemId } });
    expect(row?.type).toBe("exam_practice");
    expect(row?.payload).toEqual({ examId: s.examId, title: "Luyện đọc" });
  });

  it("từ chối: đề khoá khác, đề nháp, đề không phải thi thử, đề không tồn tại, id sai định dạng", async () => {
    const a = await setup("rej-a");
    const other = await setup("rej-b");
    const draft = await setup("rej-draft", { publish: false });
    const regular = await setup("rej-regular", { mock: false });
    for (const examId of [other.examId, "00000000-0000-0000-0000-000000000000", "khong-phai-uuid"]) {
      await expect(createContentItem(a.owner, a.lessonId, block(examId))).rejects.toMatchObject({ code: "validation_failed" });
    }
    await expect(createContentItem(draft.owner, draft.lessonId, block(draft.examId))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createContentItem(regular.owner, regular.lessonId, block(regular.examId))).rejects.toMatchObject({ code: "validation_failed" });
    expect(await prisma.contentItem.count({ where: { type: "exam_practice" } })).toBe(0);
  });

  it("tắt 'Cho luyện đề' vẫn lưu được khối; sửa payload sang đề khoá khác bị từ chối", async () => {
    const s = await setup("off");
    await updateExam(s.owner, s.examId, { allowPractice: false });
    const { contentItemId } = await createContentItem(s.owner, s.lessonId, block(s.examId));
    const other = await setup("off-other");
    await expect(updateContentItem(s.owner, contentItemId, { payload: { examId: other.examId } })).rejects.toMatchObject({ code: "validation_failed" });
    await updateContentItem(s.owner, contentItemId, { payload: { examId: s.examId, title: "Mới" } });
    expect((await prisma.contentItem.findUnique({ where: { id: contentItemId } }))?.payload).toEqual({ examId: s.examId, title: "Mới" });
  });

  it("người không sửa được khoá không thêm khối được", async () => {
    const s = await setup("authz");
    const stranger = await user("pb-stranger@e.com");
    await expect(createContentItem(stranger, s.lessonId, block(s.examId))).rejects.toThrow(CourseAuthzError);
  });
});

describe("listSelectablePracticeExams", () => {
  it("chỉ đề thi thử đã xuất bản của khoá chứa bài; báo công tắc luyện đề; người lạ bị từ chối", async () => {
    const s = await setup("list");
    await setup("list-other");
    await updateExam(s.owner, s.examId, { allowPractice: false });
    const r = await listSelectablePracticeExams(s.owner, s.lessonId);
    expect(r).toEqual([{ id: s.examId, title: "Đề list", allowPractice: false }]);
    await expect(listSelectablePracticeExams(await user("pb-x@e.com"), s.lessonId)).rejects.toThrow(CourseAuthzError);
  });
});

describe("nhân bản", () => {
  it("nhân bản bài (cùng khoá) giữ khối; nhân bản khoá bỏ khối vì đề thuộc khoá gốc", async () => {
    const s = await setup("dup");
    await createContentItem(s.owner, s.lessonId, block(s.examId));
    const d = await duplicateLesson(s.owner, s.lessonId);
    const copied = await prisma.contentItem.findMany({ where: { lessonId: d.lessonId, type: "exam_practice" } });
    expect(copied).toHaveLength(1);
    expect((copied[0]!.payload as { examId: string }).examId).toBe(s.examId);

    const c2 = await duplicateCourse(s.owner, s.courseId);
    const left = await prisma.contentItem.count({ where: { type: "exam_practice", lesson: { module: { courseId: c2.courseId } } } });
    expect(left).toBe(0);
  });
});

describe("getPracticeForEmbed", () => {
  it("chưa có buổi dở: trả cả đề, sessionId null, cấu hình công khai KHÔNG có đáp án/giải thích", async () => {
    const s = await setup("embed");
    const learner = await user("pb-l-embed@e.com");
    await enrollInCourse(learner, s.courseId);
    const e = await getPracticeForEmbed(learner, s.examId);
    expect(e.sessionId).toBeNull();
    expect(e.questions.map((q) => q.id)).toEqual([s.q1, s.q2]);
    expect(e.passages.map((p) => p.id)).toEqual([s.passageId]);
    expect(e.questions[0]!.passageId).toBe(s.passageId);
    expect(e.answers).toEqual([]);
    const json = JSON.stringify(e);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("Vì A đúng");
  });

  it("có buổi dở: dùng lại đúng buổi, đáp án đã lưu và cờ 'đã kiểm tra'; vẫn không lộ đáp án của câu đã kiểm tra", async () => {
    const s = await setup("resume");
    const learner = await user("pb-l-resume@e.com");
    await enrollInCourse(learner, s.courseId);
    const { sessionId } = await startPracticeSession(learner, s.examId, { all: true });
    await savePracticeAnswer(learner, sessionId, s.q1, { optionIds: ["a"] });
    await savePracticeAnswer(learner, sessionId, s.q2, { optionIds: ["b"] });
    await checkPracticeAnswer(learner, sessionId, s.q1);
    const e = await getPracticeForEmbed(learner, s.examId);
    expect(e.sessionId).toBe(sessionId);
    expect(e.answers.find((a) => a.questionId === s.q1)).toMatchObject({ checked: true, isCorrect: true });
    expect(e.answers.find((a) => a.questionId === s.q2)).toMatchObject({ checked: false });
    expect(JSON.stringify(e.questions)).not.toContain("isCorrect");
  });

  it("chưa ghi danh → not_enrolled; tắt 'Cho luyện đề' → practice_disabled", async () => {
    const s = await setup("gate");
    const stranger = await user("pb-x-gate@e.com");
    await expect(getPracticeForEmbed(stranger, s.examId)).rejects.toMatchObject({ code: "not_enrolled" });
    const learner = await user("pb-l-gate@e.com");
    await enrollInCourse(learner, s.courseId);
    await updateExam(s.owner, s.examId, { allowPractice: false });
    await expect(getPracticeForEmbed(learner, s.examId)).rejects.toMatchObject({ code: "practice_disabled" });
  });
});
