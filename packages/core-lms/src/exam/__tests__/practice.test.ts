import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  abandonPracticeSession,
  checkPracticeAnswer,
  completePracticeSession,
  createExam,
  createExamQuestion,
  createSection,
  getPracticeOverview,
  getPracticeSession,
  getPracticeSkillSummary,
  listMockExamsForLearner,
  publishExam,
  savePracticeAnswer,
  startExamAttempt,
  startPracticeSession,
  updateExam,
} from "../";

/**
 * LANG G5e — luyện đề theo kỹ năng. Bảng riêng (không phải ExamAttempt): không giờ ép buộc,
 * không vào bảng điểm/giám sát, kiểm tra đáp án ngay từng câu — và KHÔNG BAO GIỜ dùng được
 * cho lượt thi thử (lộ đáp án trong lúc thi).
 */

const BASE = "http://localhost:3000";
const mcq = (prompt: string) => ({
  type: "mcq" as const,
  prompt,
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
});

async function setup(slug: string, o: { mock?: boolean; publish?: boolean } = {}) {
  const { mock = true, publish = true } = o;
  const owner = await registerUser({ email: `pr-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `pr-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date() } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: "Luyện", durationMin: 30, mockMode: mock });
  const nghe = await createSection(owner.userId, examId, { title: "Nghe", durationMin: 10, languageSkill: "listening" });
  const doc = await createSection(owner.userId, examId, { title: "Đọc", durationMin: 10, languageSkill: "reading" });
  const viet = await createSection(owner.userId, examId, { title: "Viết", durationMin: 10, languageSkill: "writing" });
  const skill = await prisma.skill.create({ data: { code: `pr.skill.${slug}`, name: "S" } });
  const n1 = await createExamQuestion(owner.userId, examId, { ...mcq("N1"), sectionId: nghe.id, skillIds: [skill.id] });
  const n2 = await createExamQuestion(owner.userId, examId, { ...mcq("N2"), sectionId: nghe.id });
  const d1 = await createExamQuestion(owner.userId, examId, { ...mcq("D1"), sectionId: doc.id });
  const e1 = await createExamQuestion(owner.userId, examId, { type: "essay", prompt: "E1", config: {}, points: 5, sectionId: viet.id });
  if (publish) await publishExam(owner.userId, examId);
  const learner = await registerUser({ email: `pr-l-${slug}@e.com`, password: "password1234", displayName: "L" }, BASE);
  await enrollInCourse(learner.userId, course.courseId);
  return {
    ownerId: owner.userId,
    courseId: course.courseId,
    examId,
    learnerId: learner.userId,
    skillId: skill.id,
    sec: { nghe: nghe.id, doc: doc.id, viet: viet.id },
    q: { n1: n1.questionId, n2: n2.questionId, d1: d1.questionId, e1: e1.questionId },
  };
}
type S = Awaited<ReturnType<typeof setup>>;
const RIGHT = { optionIds: ["a"] };
const WRONG = { optionIds: ["b"] };

describe("tổng quan & điều kiện (G5e.1, G5e.9)", () => {
  it("liệt kê các phần với kỹ năng và số câu; chưa có buổi dở", async () => {
    const s = await setup("overview");
    const o = await getPracticeOverview(s.learnerId, s.examId);
    expect(o.sections.map((x) => [x.title, x.languageSkill, x.questionCount])).toEqual([
      ["Nghe", "listening", 2],
      ["Đọc", "reading", 1],
      ["Viết", "writing", 1],
    ]);
    expect(o.inProgress).toBeNull();
  });

  it("chưa ghi danh → not_enrolled; đề nháp, đề thường, hoặc công tắc 'Cho luyện đề' tắt → bị từ chối", async () => {
    const s = await setup("gate");
    const stranger = await registerUser({ email: "pr-x-gate@e.com", password: "password1234", displayName: "X" }, BASE);
    await expect(getPracticeOverview(stranger.userId, s.examId)).rejects.toMatchObject({ code: "not_enrolled" });
    const draft = await setup("gate-draft", { publish: false });
    await expect(getPracticeOverview(draft.learnerId, draft.examId)).rejects.toMatchObject({ code: "practice_disabled" });
    const regular = await setup("gate-regular", { mock: false });
    await expect(getPracticeOverview(regular.learnerId, regular.examId)).rejects.toMatchObject({ code: "practice_disabled" });
    await updateExam(s.ownerId, s.examId, { allowPractice: false });
    await expect(getPracticeOverview(s.learnerId, s.examId)).rejects.toMatchObject({ code: "practice_disabled" });
    await expect(startPracticeSession(s.learnerId, s.examId, { all: true })).rejects.toMatchObject({ code: "practice_disabled" });
  });
});

describe("bắt đầu buổi luyện — phạm vi (G5e.1, G5e.2, G5e.6)", () => {
  it("theo KỸ NĂNG: chỉ câu của các phần có kỹ năng đó", async () => {
    const s = await setup("by-skill");
    const { sessionId, questionCount } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    expect(questionCount).toBe(2);
    const sess = await getPracticeSession(s.learnerId, sessionId);
    expect(sess.questions.map((q) => q.id).sort()).toEqual([s.q.n1, s.q.n2].sort());
  });

  it("theo PHẦN và theo nhiều kỹ năng; cả đề khi all=true", async () => {
    const s = await setup("by-section");
    const a = await startPracticeSession(s.learnerId, s.examId, { sectionIds: [s.sec.doc] });
    expect(a.questionCount).toBe(1);
    await abandonPracticeSession(s.learnerId, a.sessionId);
    const b = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening", "reading"] });
    expect(b.questionCount).toBe(3);
    await abandonPracticeSession(s.learnerId, b.sessionId);
    const c = await startPracticeSession(s.learnerId, s.examId, { all: true });
    expect(c.questionCount).toBe(4);
  });

  it("phạm vi rỗng (không chọn gì, hoặc kỹ năng không có phần nào) → không bắt đầu được", async () => {
    const s = await setup("empty");
    await expect(startPracticeSession(s.learnerId, s.examId, {})).rejects.toMatchObject({ code: "practice_scope_empty" });
    await expect(startPracticeSession(s.learnerId, s.examId, { skills: ["speaking"] })).rejects.toMatchObject({ code: "practice_scope_empty" });
    expect(await prisma.examPracticeSession.count({ where: { userId: s.learnerId } })).toBe(0);
  });

  it("id phần của đề khác bị bỏ qua (không lấy câu của đề khác)", async () => {
    const a = await setup("x-a");
    const b = await setup("x-b");
    await expect(startPracticeSession(a.learnerId, a.examId, { sectionIds: [b.sec.nghe] })).rejects.toMatchObject({ code: "practice_scope_empty" });
  });

  it("đang có buổi dở → bắt đầu lại trả đúng buổi đó (resumed), không tạo buổi thứ hai", async () => {
    const s = await setup("resume");
    const a = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    const b = await startPracticeSession(s.learnerId, s.examId, { skills: ["reading"] });
    expect(b).toMatchObject({ sessionId: a.sessionId, resumed: true });
    expect((await getPracticeOverview(s.learnerId, s.examId)).inProgress).toMatchObject({ sessionId: a.sessionId });
    expect(await prisma.examPracticeSession.count({ where: { userId: s.learnerId, status: "in_progress" } })).toBe(1);
  });

  it("làm xong rồi bắt đầu buổi mới được (nhiều buổi, độc lập)", async () => {
    const s = await setup("many");
    const a = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await completePracticeSession(s.learnerId, a.sessionId);
    const b = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    expect(b.sessionId).not.toBe(a.sessionId);
    expect(b.resumed).toBe(false);
  });
});

describe("không lộ đáp án qua dữ liệu buổi luyện", () => {
  it("getPracticeSession trả cấu hình CÔNG KHAI: không có cờ isCorrect của đáp án", async () => {
    const s = await setup("noleak");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    const sess = await getPracticeSession(s.learnerId, sessionId);
    expect(JSON.stringify(sess.questions)).not.toContain("isCorrect");
  });
});

describe("trả lời và Kiểm tra (G5e.3, G5e.4, G5e.10)", () => {
  it("lưu đáp án, sửa lại được; câu ngoài phạm vi bị từ chối", async () => {
    const s = await setup("save");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, WRONG);
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT); // sửa lại
    const sess = await getPracticeSession(s.learnerId, sessionId);
    expect(sess.answers.find((a) => a.questionId === s.q.n1)).toMatchObject({ answerJson: RIGHT, checked: false, isCorrect: null });
    await expect(savePracticeAnswer(s.learnerId, sessionId, s.q.d1, RIGHT)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("Kiểm tra: đúng/sai kèm đáp án đúng; phải trả lời trước", async () => {
    const s = await setup("check");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await expect(checkPracticeAnswer(s.learnerId, sessionId, s.q.n1)).rejects.toMatchObject({ code: "practice_not_answered" });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, WRONG);
    const wrong = await checkPracticeAnswer(s.learnerId, sessionId, s.q.n1);
    expect(wrong).toMatchObject({ isCorrect: false, score: 0, maxScore: 1, manual: false });
    expect(JSON.stringify(wrong.config)).toContain('"isCorrect":true'); // đáp án đúng hiện SAU khi kiểm tra
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT);
    expect(await checkPracticeAnswer(s.learnerId, sessionId, s.q.n1)).toMatchObject({ isCorrect: true, score: 1 });
    const sess = await getPracticeSession(s.learnerId, sessionId);
    expect(sess.answers.find((a) => a.questionId === s.q.n1)).toMatchObject({ checked: true, isCorrect: true });
  });

  it("sửa đáp án sau khi đã kiểm tra → trở lại chưa kiểm tra", async () => {
    const s = await setup("recheck");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT);
    await checkPracticeAnswer(s.learnerId, sessionId, s.q.n1);
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, WRONG);
    const a = (await getPracticeSession(s.learnerId, sessionId)).answers.find((x) => x.questionId === s.q.n1)!;
    expect(a).toMatchObject({ checked: false, isCorrect: null });
  });

  it("câu tự luận: không kiểm tra tự động (manual=true, không có đúng/sai)", async () => {
    const s = await setup("essay");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["writing"] });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.e1, { text: "Bài viết" });
    expect(await checkPracticeAnswer(s.learnerId, sessionId, s.q.e1)).toMatchObject({ manual: true, isCorrect: null, score: null });
  });

  it("tắt 'Kiểm tra từng câu' → từ chối kiểm tra giữa chừng (nhưng vẫn có kết quả khi kết thúc)", async () => {
    const s = await setup("nocheck");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"], checkEnabled: false });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT);
    await expect(checkPracticeAnswer(s.learnerId, sessionId, s.q.n1)).rejects.toMatchObject({ code: "practice_check_disabled" });
    const r = await completePracticeSession(s.learnerId, sessionId);
    expect(r.bySkill.find((x) => x.skill === "listening")).toMatchObject({ correct: 1, total: 2 });
  });

  it("G5e.4: lượt THI THỬ không bao giờ dùng được endpoint kiểm tra — id lượt thi bị coi là không tồn tại", async () => {
    const s = await setup("mock-noleak");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await expect(checkPracticeAnswer(s.learnerId, attemptId, s.q.n1)).rejects.toMatchObject({ code: "practice_session_not_found" });
    await expect(getPracticeSession(s.learnerId, attemptId)).rejects.toMatchObject({ code: "practice_session_not_found" });
  });

  it("người khác không xem/đụng buổi luyện của bạn", async () => {
    const s = await setup("owner");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await expect(getPracticeSession(s.ownerId, sessionId)).rejects.toMatchObject({ code: "practice_session_not_found" });
    await expect(savePracticeAnswer(s.ownerId, sessionId, s.q.n1, RIGHT)).rejects.toMatchObject({ code: "practice_session_not_found" });
  });

  it("buổi đã kết thúc/bỏ thì không lưu thêm được (practice_session_closed)", async () => {
    const s = await setup("closed");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await completePracticeSession(s.learnerId, sessionId);
    await expect(savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT)).rejects.toMatchObject({ code: "practice_session_closed" });
  });
});

describe("kết thúc, câu sai và làm lại (G5e.7)", () => {
  it("kết quả theo kỹ năng; danh sách câu sai gồm cả câu sai và câu bỏ trống, kèm đáp án đúng", async () => {
    const s = await setup("result");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening", "reading"] });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT);
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n2, WRONG);
    // d1 bỏ trống
    const r = await completePracticeSession(s.learnerId, sessionId);
    expect(r.bySkill.find((x) => x.skill === "listening")).toMatchObject({ correct: 1, total: 2, answered: 2 });
    expect(r.bySkill.find((x) => x.skill === "reading")).toMatchObject({ correct: 0, total: 1, answered: 0 });
    expect(r.wrong.map((w) => [w.questionId, w.answered]).sort()).toEqual([[s.q.n2, true], [s.q.d1, false]].sort());
    expect(JSON.stringify(r.wrong[0]!.config)).toContain('"isCorrect":true');
    expect((await prisma.examPracticeSession.findUniqueOrThrow({ where: { id: sessionId } })).status).toBe("completed");
  });

  it("câu tự luận không tính đúng/sai trong kết quả (không điểm giả)", async () => {
    const s = await setup("result-essay");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["writing"] });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.e1, { text: "x" });
    const r = await completePracticeSession(s.learnerId, sessionId);
    expect(r.bySkill.find((x) => x.skill === "writing")).toMatchObject({ correct: 0, total: 0, manual: 1 });
    expect(r.wrong).toEqual([]);
  });

  it("'Làm lại câu sai': buổi mới chỉ chứa các câu sai của buổi trước", async () => {
    const s = await setup("retry");
    const a = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await savePracticeAnswer(s.learnerId, a.sessionId, s.q.n1, RIGHT);
    await savePracticeAnswer(s.learnerId, a.sessionId, s.q.n2, WRONG);
    await completePracticeSession(s.learnerId, a.sessionId);
    const b = await startPracticeSession(s.learnerId, s.examId, { retryOfSessionId: a.sessionId });
    const sess = await getPracticeSession(s.learnerId, b.sessionId);
    expect(sess.questions.map((q) => q.id)).toEqual([s.q.n2]);
  });

  it("bộ lọc 'chưa làm' và 'từng sai' dựa trên lịch sử luyện; rỗng thì không bắt đầu", async () => {
    const s = await setup("filters");
    const a = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await savePracticeAnswer(s.learnerId, a.sessionId, s.q.n1, RIGHT);
    await savePracticeAnswer(s.learnerId, a.sessionId, s.q.n2, WRONG);
    await completePracticeSession(s.learnerId, a.sessionId);
    const un = await startPracticeSession(s.learnerId, s.examId, { all: true, filter: "unanswered" });
    expect((await getPracticeSession(s.learnerId, un.sessionId)).questions.map((q) => q.id).sort()).toEqual([s.q.d1, s.q.e1].sort());
    await abandonPracticeSession(s.learnerId, un.sessionId);
    const wr = await startPracticeSession(s.learnerId, s.examId, { all: true, filter: "wrong" });
    expect((await getPracticeSession(s.learnerId, wr.sessionId)).questions.map((q) => q.id)).toEqual([s.q.n2]);
    await abandonPracticeSession(s.learnerId, wr.sessionId);
    await expect(startPracticeSession(s.learnerId, s.examId, { skills: ["reading"], filter: "wrong" })).rejects.toMatchObject({ code: "practice_scope_empty" });
  });
});

describe("không ảnh hưởng thi thật, bảng điểm, XP; event (G5e.8)", () => {
  it("luyện đề không tạo ExamAttempt, không đổi số lượt thi thử, không cấp XP", async () => {
    const s = await setup("isolated");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { all: true });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT);
    await checkPracticeAnswer(s.learnerId, sessionId, s.q.n1);
    await completePracticeSession(s.learnerId, sessionId);
    expect(await prisma.examAttempt.count({ where: { examId: s.examId } })).toBe(0);
    expect(await prisma.xpTransaction.count({ where: { userId: s.learnerId } })).toBe(0);
    const [card] = await listMockExamsForLearner(s.learnerId, s.courseId);
    expect(card!.attemptCount).toBe(0);
    // và thi thử vẫn bắt đầu bình thường dù có buổi luyện (kể cả đang dở)
    await startPracticeSession(s.learnerId, s.examId, { all: true });
    await expect(startExamAttempt(s.learnerId, s.examId)).resolves.toMatchObject({ resumed: false });
  });

  it("kiểm tra một câu phát exam.practice.answered kèm thẻ kỹ năng; kiểm tra lại cùng đáp án không phát thêm", async () => {
    const s = await setup("events");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await savePracticeAnswer(s.learnerId, sessionId, s.q.n1, RIGHT);
    await checkPracticeAnswer(s.learnerId, sessionId, s.q.n1);
    await checkPracticeAnswer(s.learnerId, sessionId, s.q.n1);
    const evs = await prisma.learningEvent.findMany({ where: { eventType: "exam.practice.answered", userId: s.learnerId } });
    expect(evs).toHaveLength(1);
    expect(evs[0]!.payload).toMatchObject({ examId: s.examId, sessionId, questionId: s.q.n1, correct: true, languageSkill: "listening", skillIds: [s.skillId] });
  });

  it("kết thúc buổi phát exam.practice.completed một lần", async () => {
    const s = await setup("events2");
    const { sessionId } = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await completePracticeSession(s.learnerId, sessionId);
    await completePracticeSession(s.learnerId, sessionId).catch(() => undefined);
    expect(await prisma.learningEvent.count({ where: { eventType: "exam.practice.completed", userId: s.learnerId } })).toBe(1);
  });
});

describe("getPracticeSkillSummary — khối 'Luyện đề' trên hồ sơ", () => {
  it("độ chính xác theo kỹ năng trên các câu đã chấm gần nhất; chưa luyện → null", async () => {
    const s = await setup("summary");
    expect(await getPracticeSkillSummary(s.learnerId, s.courseId)).toBeNull();
    const a = await startPracticeSession(s.learnerId, s.examId, { skills: ["listening"] });
    await savePracticeAnswer(s.learnerId, a.sessionId, s.q.n1, RIGHT);
    await savePracticeAnswer(s.learnerId, a.sessionId, s.q.n2, WRONG);
    await completePracticeSession(s.learnerId, a.sessionId);
    const sum = (await getPracticeSkillSummary(s.learnerId, s.courseId))!;
    expect(sum.sessionCount).toBe(1);
    expect(sum.skills.find((x) => x.skill === "listening")).toMatchObject({ correct: 1, total: 2, pct: 50 });
    expect(sum.skills.find((x) => x.skill === "reading")).toBeUndefined();
  });
});
