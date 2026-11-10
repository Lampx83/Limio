import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createContentItem } from "../../courses/contents";
import { getOwnedPracticeExamId } from "../../courses/practiceBlock";
import {
  abandonPracticeSession,
  checkPracticeAnswer,
  createExam,
  createExamQuestion,
  createSection,
  getPracticeReviewSummary,
  observePracticeAnswer,
  publishExam,
  savePracticeAnswer,
  startPracticeSession,
  updateExam,
} from "../";

/**
 * LANG đợt 4 — ghi nhận lượt quan sát kỹ năng của Bài luyện nhúng trong bài (cầu nối sang BKT ở tầng apps/web) và
 * tóm tắt "câu luyện nên làm lại" cho trang Lịch ôn tập.
 */

const BASE = "http://localhost:3000";
const mcq = (prompt: string) => ({
  type: "mcq" as const,
  prompt,
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
});
const RIGHT = { optionIds: ["a"] };
const WRONG = { optionIds: ["b"] };

async function user(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function setup(tag: string) {
  const owner = await user(`po-o-${tag}@e.com`);
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `po-${tag}` });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published", publishedAt: new Date() } });
  const m = await createModule(owner, c.courseId, { title: "U1", orderIndex: 0 });
  const withBlock = await createLesson(owner, m.moduleId, { title: "Có bài luyện", orderIndex: 0 });
  const noBlock = await createLesson(owner, m.moduleId, { title: "Không có", orderIndex: 1 });
  // Bài luyện sở hữu đề ẩn (docs/tieu-chi/limio-language-bai-luyen-editor.md): tạo khối rồi thêm câu vào đề của khối.
  const block = await createContentItem(owner, withBlock.lessonId, { type: "exam_practice", payload: { title: `Đề ${tag}` }, orderIndex: 0 });
  const examId = (await getOwnedPracticeExamId(block.contentItemId))!;
  const sec = await prisma.examSection.findFirstOrThrow({ where: { examId }, select: { id: true } });
  await prisma.examSection.update({ where: { id: sec.id }, data: { languageSkill: "reading" } });
  const q1 = await createExamQuestion(owner, examId, { ...mcq("Câu 1"), sectionId: sec.id });
  const q2 = await createExamQuestion(owner, examId, { ...mcq("Câu 2"), sectionId: sec.id });
  const q3 = await createExamQuestion(owner, examId, { type: "essay", prompt: "Viết", config: {}, points: 5, sectionId: sec.id });
  const learner = await user(`po-l-${tag}@e.com`);
  await enrollInCourse(learner, c.courseId);
  const { sessionId } = await startPracticeSession(learner, examId, { all: true });
  return {
    owner, courseId: c.courseId, examId, learner, sessionId,
    lessonId: withBlock.lessonId, otherLessonId: noBlock.lessonId, blockId: block.contentItemId,
    q1: q1.questionId, q2: q2.questionId, q3: q3.questionId, moduleId: m.moduleId,
  };
}
type S = Awaited<ReturnType<typeof setup>>;

async function answerAndCheck(s: S, qid: string, v: unknown) {
  await savePracticeAnswer(s.learner, s.sessionId, qid, v);
  return checkPracticeAnswer(s.learner, s.sessionId, qid);
}

describe("observePracticeAnswer", () => {
  it("câu đã kiểm tra: tính một lượt, đúng/sai lấy từ dữ liệu máy chủ; ghi sự kiện chỉ mang id và đúng/sai", async () => {
    const s = await setup("ok");
    await answerAndCheck(s, s.q1, RIGHT);
    const r = await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId);
    expect(r).toEqual({ created: true, correct: true });
    await answerAndCheck(s, s.q2, WRONG);
    expect(await observePracticeAnswer(s.learner, s.sessionId, s.q2, s.lessonId)).toEqual({ created: true, correct: false });
    const evs = await prisma.learningEvent.findMany({ where: { userId: s.learner, eventType: LearningEventType.ExamPracticeObserved }, orderBy: { id: "asc" } });
    expect(evs).toHaveLength(2);
    expect(evs[0]!.payload).toEqual({ examId: s.examId, sessionId: s.sessionId, questionId: s.q1, lessonId: s.lessonId, correct: true });
    expect(evs[0]!.courseId).toBe(s.courseId);
    expect(evs[0]!.eventKey).toBe(`exam.practice.observed:${s.sessionId}:${s.q1}`);
  });

  it("đúng MỘT lần mỗi (buổi, câu): gọi lại, kiểm tra lại, sửa đáp án rồi kiểm tra lại đều không tính thêm", async () => {
    const s = await setup("once");
    await answerAndCheck(s, s.q1, WRONG);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(true);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(false);
    await checkPracticeAnswer(s.learner, s.sessionId, s.q1); // mở lại bài: kiểm tra lại
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(false);
    await answerAndCheck(s, s.q1, RIGHT); // xem đáp án rồi đổi
    const again = await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId);
    expect(again.created).toBe(false);
    expect(await prisma.learningEvent.count({ where: { userId: s.learner, eventType: LearningEventType.ExamPracticeObserved } })).toBe(1);
  });

  it("buổi luyện MỚI (luyện lại) của cùng câu được tính lại", async () => {
    const s = await setup("again");
    await answerAndCheck(s, s.q1, RIGHT);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(true);
    await prisma.examPracticeSession.update({ where: { id: s.sessionId }, data: { status: "completed", completedAt: new Date() } });
    const next = await startPracticeSession(s.learner, s.examId, { all: true });
    await savePracticeAnswer(s.learner, next.sessionId, s.q1, RIGHT);
    await checkPracticeAnswer(s.learner, next.sessionId, s.q1);
    expect((await observePracticeAnswer(s.learner, next.sessionId, s.q1, s.lessonId)).created).toBe(true);
  });

  it("không tính: chưa kiểm tra, câu tự luận, buổi của người khác, buổi đã bỏ", async () => {
    const s = await setup("deny");
    await savePracticeAnswer(s.learner, s.sessionId, s.q1, RIGHT); // chưa kiểm tra
    expect(await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).toEqual({ created: false, correct: null });
    await answerAndCheck(s, s.q3, { text: "bài viết" }); // tự luận: isCorrect null
    expect(await observePracticeAnswer(s.learner, s.sessionId, s.q3, s.lessonId)).toEqual({ created: false, correct: null });
    await answerAndCheck(s, s.q2, RIGHT);
    const stranger = await user("po-x-deny@e.com");
    expect((await observePracticeAnswer(stranger, s.sessionId, s.q2, s.lessonId)).created).toBe(false);
    await abandonPracticeSession(s.learner, s.sessionId);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q2, s.lessonId)).created).toBe(false);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.ExamPracticeObserved } })).toBe(0);
  });

  it("không tin lessonId: bài không có khối, khối ẩn, bài ẩn, bài của khoá khác, bài không tồn tại đều bị bỏ qua", async () => {
    const s = await setup("link");
    await answerAndCheck(s, s.q1, RIGHT);
    const other = await setup("link-other");
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.otherLessonId)).created).toBe(false);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, other.lessonId)).created).toBe(false);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, "00000000-0000-0000-0000-000000000000")).created).toBe(false);
    await prisma.contentItem.update({ where: { id: s.blockId }, data: { isHidden: true } });
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(false);
    await prisma.contentItem.update({ where: { id: s.blockId }, data: { isHidden: false } });
    await prisma.lesson.update({ where: { id: s.lessonId }, data: { isHidden: true } });
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(false);
    await prisma.lesson.update({ where: { id: s.lessonId }, data: { isHidden: false } });
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(true);
  });

  it("bài chứa khối của ĐỀ KHÁC thì không tính cho buổi luyện của đề này; hết quyền ghi danh thì không tính", async () => {
    const s = await setup("exam");
    // Bài thứ hai có khối Bài luyện riêng (đề ẩn khác): quan sát qua bài đó không được tính cho đề của s.
    const otherBlock = await createContentItem(s.owner, s.otherLessonId, { type: "exam_practice", payload: {}, orderIndex: 0 });
    expect(await getOwnedPracticeExamId(otherBlock.contentItemId)).not.toBe(s.examId);
    await answerAndCheck(s, s.q1, RIGHT);
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.otherLessonId)).created).toBe(false);
    await prisma.enrollment.update({ where: { userId_courseId: { userId: s.learner, courseId: s.courseId } }, data: { status: "dropped" } });
    expect((await observePracticeAnswer(s.learner, s.sessionId, s.q1, s.lessonId)).created).toBe(false);
  });
});

describe("getPracticeReviewSummary", () => {
  it("đếm câu mà lần trả lời GẦN NHẤT sai; đã sửa đúng thì không còn; tự luận không tính; chỉ đề đã bật luyện đề", async () => {
    const s = await setup("rev");
    await answerAndCheck(s, s.q1, WRONG);
    await answerAndCheck(s, s.q2, WRONG);
    await answerAndCheck(s, s.q3, { text: "x" });
    expect(await getPracticeReviewSummary(s.learner, s.courseId)).toEqual([{ examId: s.examId, title: "Đề rev", wrong: 2 }]);
    await answerAndCheck(s, s.q1, RIGHT); // sửa đúng
    expect((await getPracticeReviewSummary(s.learner, s.courseId))[0]!.wrong).toBe(1);
    await updateExam(s.owner, s.examId, { allowPractice: false });
    expect(await getPracticeReviewSummary(s.learner, s.courseId)).toEqual([]);
  });

  it("chưa làm gì hoặc chưa ghi danh thì rỗng; dữ liệu của người khác không lẫn vào", async () => {
    const s = await setup("rev-empty");
    expect(await getPracticeReviewSummary(s.learner, s.courseId)).toEqual([]);
    await answerAndCheck(s, s.q1, WRONG);
    const stranger = await user("po-x-rev@e.com");
    expect(await getPracticeReviewSummary(stranger, s.courseId)).toEqual([]);
    const other = await user("po-o2-rev@e.com");
    await enrollInCourse(other, s.courseId);
    expect(await getPracticeReviewSummary(other, s.courseId)).toEqual([]);
  });
});
