import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse, duplicateCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson, duplicateLesson } from "../lessons";
import { createContentItem, deleteContentItem, updateContentItem } from "../contents";
import { getOwnedPracticeExamId, getPracticeBlockSummaries, getPracticeEditorData } from "../practiceBlock";
import { CourseAuthzError } from "../authz";
import {
  checkPracticeAnswer,
  createExamQuestion,
  createPassage,
  deleteExamQuestion,
  deletePassage,
  getPracticeForEmbed,
  getPracticePreview,
  getPreviewVoiceContext,
  listExamsForCourse,
  previewPracticeCheck,
  reorderExamQuestions,
  reorderPassages,
  savePracticeAnswer,
  startPracticeSession,
  updateExamQuestion,
} from "../../exam";
import { listMockExamsForLearner } from "../../exam/mock-catalog";

/**
 * Editor riêng của Bài luyện (docs/tieu-chi/limio-language-bai-luyen-editor.md): khối SỞ HỮU một đề ẩn
 * (`Exam.ownerContentItemId`); đề ẩn không lọt vào danh sách đề thi; nhân bản sao chép sâu; học viên không thấy đáp án.
 */

const BASE = "http://localhost:3000";
const mcq = (prompt: string) => ({
  type: "mcq" as const,
  prompt,
  config: { explanation: "Vì A đúng", options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
});
const docOf = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function user(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function setup(tag: string) {
  const owner = await user(`pe-o-${tag}@e.com`);
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `pe-${tag}` });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published", publishedAt: new Date() } });
  const m = await createModule(owner, c.courseId, { title: "U1", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  return { owner, courseId: c.courseId, lessonId: l.lessonId };
}

/** Tạo khối Bài luyện + vài nội dung (1 đoạn có 2 câu, 1 câu lẻ). */
async function practice(s: { owner: string; lessonId: string }, title?: string) {
  const { contentItemId } = await createContentItem(s.owner, s.lessonId, { type: "exam_practice", payload: title ? { title } : {}, orderIndex: 0 });
  const examId = (await getOwnedPracticeExamId(contentItemId))!;
  const sectionId = (await prisma.examSection.findFirstOrThrow({ where: { examId }, select: { id: true } })).id;
  const { passageId } = await createPassage(s.owner, examId, { title: "Đoạn 1", contentJson: docOf("Nội dung đoạn."), audioPolicy: "free_replay", revealMode: "all_at_once" });
  const q1 = await createExamQuestion(s.owner, examId, { ...mcq("Câu 1"), passageId, sectionId });
  const q2 = await createExamQuestion(s.owner, examId, { ...mcq("Câu 2"), passageId, sectionId });
  const q3 = await createExamQuestion(s.owner, examId, { ...mcq("Câu lẻ"), sectionId });
  return { contentItemId, examId, sectionId, passageId, q1: q1.questionId, q2: q2.questionId, q3: q3.questionId };
}

describe("tạo khối Bài luyện = tạo luôn đề ẩn (một giao dịch)", () => {
  it("tạo khối: có đề ẩn gắn khối, đã xuất bản + thi thử + cho luyện, đúng một phần; payload chỉ có title", async () => {
    const s = await setup("create");
    const { contentItemId } = await createContentItem(s.owner, s.lessonId, { type: "exam_practice", payload: { title: "  Luyện đọc  " }, orderIndex: 0 });
    const item = await prisma.contentItem.findUniqueOrThrow({ where: { id: contentItemId } });
    expect(item.payload).toEqual({ title: "Luyện đọc" });
    const exam = await prisma.exam.findUniqueOrThrow({ where: { ownerContentItemId: contentItemId }, include: { sections: true } });
    expect(exam).toMatchObject({ courseId: s.courseId, title: "Luyện đọc", status: "published", kind: "written", mockMode: true, allowPractice: true });
    expect(exam.sections).toHaveLength(1);
  });

  it("payload cũ có examId (hoặc khoá lạ) bị từ chối; không tạo khối lẻ", async () => {
    const s = await setup("legacy");
    await expect(createContentItem(s.owner, s.lessonId, { type: "exam_practice", payload: { examId: "00000000-0000-0000-0000-000000000000" }, orderIndex: 0 })).rejects.toMatchObject({ code: "validation_failed" });
    expect(await prisma.contentItem.count({ where: { type: "exam_practice", lessonId: s.lessonId } })).toBe(0);
    expect(await prisma.exam.count({ where: { courseId: s.courseId } })).toBe(0);
  });

  it("đổi tiêu đề khối thì đổi tên đề ẩn; người không sửa được khoá không thêm khối được", async () => {
    const s = await setup("title");
    const { contentItemId } = await createContentItem(s.owner, s.lessonId, { type: "exam_practice", payload: {}, orderIndex: 0 });
    await updateContentItem(s.owner, contentItemId, { payload: { title: "Mới" } });
    expect((await prisma.exam.findUniqueOrThrow({ where: { ownerContentItemId: contentItemId } })).title).toBe("Mới");
    const stranger = await user("pe-stranger@e.com");
    await expect(createContentItem(stranger, s.lessonId, { type: "exam_practice", payload: {}, orderIndex: 1 })).rejects.toThrow(CourseAuthzError);
  });

  it("xoá khối xoá đề ẩn, đoạn, câu và lượt luyện (cascade)", async () => {
    const s = await setup("del");
    const p = await practice(s);
    const learner = await user("pe-l-del@e.com");
    await enrollInCourse(learner, s.courseId);
    const { sessionId } = await startPracticeSession(learner, p.examId, { all: true });
    await savePracticeAnswer(learner, sessionId, p.q1, { optionIds: ["a"] });
    await deleteContentItem(s.owner, p.contentItemId);
    expect(await prisma.exam.count({ where: { id: p.examId } })).toBe(0);
    expect(await prisma.examQuestion.count({ where: { examId: p.examId } })).toBe(0);
    expect(await prisma.examPassage.count({ where: { examId: p.examId } })).toBe(0);
    expect(await prisma.examPracticeSession.count({ where: { examId: p.examId } })).toBe(0);
  });
});

describe("đề ẩn không lọt vào danh sách đề thi (AC8)", () => {
  it("không có trong listExamsForCourse và danh sách thi thử của học viên; đề thường vẫn có", async () => {
    const s = await setup("hide");
    await practice(s);
    const normal = await prisma.exam.create({
      data: { courseId: s.courseId, createdById: s.owner, title: "Đề thường", durationMin: 30, openAt: new Date(), closeAt: new Date(Date.now() + 86_400_000), mockMode: true, status: "published" },
    });
    const list = await listExamsForCourse(s.owner, s.courseId);
    expect(list.map((e) => e.id)).toEqual([normal.id]);
    const learner = await user("pe-l-hide@e.com");
    await enrollInCourse(learner, s.courseId);
    const mocks = await listMockExamsForLearner(learner, s.courseId);
    expect(mocks.map((e) => e.examId)).toEqual([normal.id]);
  });
});

describe("dữ liệu editor và tóm tắt", () => {
  it("getPracticeEditorData: đúng quyền, đúng nội dung; getPracticeBlockSummaries đếm đoạn và câu", async () => {
    const s = await setup("editor");
    const p = await practice(s, "Bài đọc 1");
    const d = await getPracticeEditorData(s.owner, p.contentItemId);
    expect(d).toMatchObject({ examId: p.examId, sectionId: p.sectionId, blockTitle: "Bài đọc 1", lessonId: s.lessonId });
    expect(d.passages.map((x) => x.id)).toEqual([p.passageId]);
    expect(d.questions.map((x) => x.id).sort()).toEqual([p.q1, p.q2, p.q3].sort());
    const stranger = await user("pe-stranger2@e.com");
    await expect(getPracticeEditorData(stranger, p.contentItemId)).rejects.toThrow(CourseAuthzError);
    const sums = await getPracticeBlockSummaries([p.contentItemId]);
    expect(sums[p.contentItemId]).toEqual({ examId: p.examId, passages: 1, questions: 3 });
  });

  it("khối không phải Bài luyện → not_found (không lộ khối của loại khác)", async () => {
    const s = await setup("notpractice");
    const { contentItemId } = await createContentItem(s.owner, s.lessonId, { type: "markdown", payload: { body: "x" }, orderIndex: 0 });
    await expect(getPracticeEditorData(s.owner, contentItemId)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("sửa nội dung: thứ tự làm bài của học viên và sự kiện (AC7)", () => {
  it("đổi thứ tự đoạn/câu ở editor thì học viên làm theo đúng thứ tự đó (đoạn rồi câu lẻ)", async () => {
    const s = await setup("order");
    const p = await practice(s);
    const learner = await user("pe-l-order@e.com");
    await enrollInCourse(learner, s.courseId);
    expect((await getPracticeForEmbed(learner, p.examId)).questions.map((q) => q.id)).toEqual([p.q1, p.q2, p.q3]);
    await reorderExamQuestions(s.owner, p.examId, p.passageId, [p.q2, p.q1]);
    expect((await getPracticeForEmbed(learner, p.examId)).questions.map((q) => q.id)).toEqual([p.q2, p.q1, p.q3]);
    // Thêm đoạn thứ hai có một câu, đưa lên đầu.
    const p2 = await createPassage(s.owner, p.examId, { title: "Đoạn 2", contentJson: docOf("Đoạn hai."), audioPolicy: "free_replay", revealMode: "all_at_once" });
    const q4 = await createExamQuestion(s.owner, p.examId, { ...mcq("Câu 4"), passageId: p2.passageId, sectionId: p.sectionId });
    await reorderPassages(s.owner, p.examId, [p2.passageId, p.passageId]);
    expect((await getPracticeForEmbed(learner, p.examId)).questions.map((q) => q.id)).toEqual([q4.questionId, p.q2, p.q1, p.q3]);
  });

  it("mỗi lần sửa phát lesson.practice.updated chỉ mang id và số liệu, không mang chữ của câu hỏi", async () => {
    const s = await setup("event");
    const p = await practice(s);
    await updateExamQuestion(s.owner, p.q1, { prompt: "Nội dung bí mật của câu" });
    await deleteExamQuestion(s.owner, p.q3);
    await deletePassage(s.owner, p.passageId);
    const events = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.LessonPracticeUpdated }, orderBy: { occurredAt: "asc" } });
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0]!.userId).toBe(s.owner);
    expect(events[events.length - 1]!.payload).toMatchObject({ lessonId: s.lessonId, contentItemId: p.contentItemId, passages: 0 });
    expect(JSON.stringify(events.map((e) => e.payload))).not.toContain("bí mật");
  });
});

describe("học viên và xem trước", () => {
  it("getPracticeForEmbed: không lộ đáp án/giải thích; chưa ghi danh → not_enrolled", async () => {
    const s = await setup("embed");
    const p = await practice(s);
    const stranger = await user("pe-x-embed@e.com");
    await expect(getPracticeForEmbed(stranger, p.examId)).rejects.toMatchObject({ code: "not_enrolled" });
    const learner = await user("pe-l-embed@e.com");
    await enrollInCourse(learner, s.courseId);
    const e = await getPracticeForEmbed(learner, p.examId);
    expect(e.questions).toHaveLength(3);
    expect(e.passages.map((x) => x.id)).toEqual([p.passageId]);
    const json = JSON.stringify(e);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("Vì A đúng");
    // Làm và kiểm tra vẫn chạy trên đề ẩn.
    const { sessionId } = await startPracticeSession(learner, p.examId, { all: true });
    await savePracticeAnswer(learner, sessionId, p.q1, { optionIds: ["a"] });
    expect(await checkPracticeAnswer(learner, sessionId, p.q1)).toMatchObject({ isCorrect: true });
  });

  it("xem trước của giảng viên: dữ liệu như học viên, chấm đúng nhưng KHÔNG tạo buổi luyện hay ghi đáp án/sự kiện; người lạ bị từ chối", async () => {
    const s = await setup("preview");
    const p = await practice(s);
    const e = await getPracticePreview(s.owner, p.examId);
    expect(e.sessionId).toBeNull();
    expect(JSON.stringify(e)).not.toContain("isCorrect");
    const sessionsBefore = await prisma.examPracticeSession.count({ where: { examId: p.examId } });
    const eventsBefore = await prisma.learningEvent.count({ where: { eventType: LearningEventType.ExamPracticeAnswered } });
    expect(await previewPracticeCheck(s.owner, p.examId, p.q1, { optionIds: ["a"] })).toMatchObject({ isCorrect: true, maxScore: 1 });
    expect(await previewPracticeCheck(s.owner, p.examId, p.q1, { optionIds: ["b"] })).toMatchObject({ isCorrect: false });
    expect(await prisma.examPracticeSession.count({ where: { examId: p.examId } })).toBe(sessionsBefore);
    expect(await prisma.examPracticeAnswer.count({ where: { session: { examId: p.examId } } })).toBe(0);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.ExamPracticeAnswered } })).toBe(eventsBefore);
    const stranger = await user("pe-x-preview@e.com");
    await expect(getPracticePreview(stranger, p.examId)).rejects.toThrow(CourseAuthzError);
    // Đề thường (không có chủ) không xem trước được bằng đường này.
    const normal = await prisma.exam.create({
      data: { courseId: s.courseId, createdById: s.owner, title: "Đề thường", durationMin: 30, openAt: new Date(), closeAt: new Date(Date.now() + 86_400_000), mockMode: true, status: "published" },
    });
    await expect(getPracticePreview(s.owner, normal.id)).rejects.toMatchObject({ code: "exam_not_found" });
  });
});

describe("nhân bản sao chép sâu (AC9)", () => {
  it("nhân bản bài: khối mới có đề ẩn riêng với đoạn/câu độc lập; sửa bản sao không đổi bản gốc; tệp đính kèm được đổi id", async () => {
    const s = await setup("dup");
    const p = await practice(s, "Bài đọc");
    const asset = await prisma.examAsset.create({ data: { examId: p.examId, type: "audio", s3Key: "k/a.mp3", mimeType: "audio/mpeg", sizeBytes: 10, uploadedById: s.owner } });
    await prisma.examPassage.update({ where: { id: p.passageId }, data: { contentJson: { type: "doc", content: [{ type: "audio", attrs: { assetId: asset.id } }] } } });

    const d = await duplicateLesson(s.owner, s.lessonId);
    const copy = await prisma.contentItem.findFirstOrThrow({ where: { lessonId: d.lessonId, type: "exam_practice" } });
    const copyExamId = (await getOwnedPracticeExamId(copy.id))!;
    expect(copyExamId).not.toBe(p.examId);
    expect(await prisma.examQuestion.count({ where: { examId: copyExamId } })).toBe(3);
    const copyPassage = await prisma.examPassage.findFirstOrThrow({ where: { examId: copyExamId } });
    const copyAsset = await prisma.examAsset.findFirstOrThrow({ where: { examId: copyExamId } });
    expect(copyAsset.id).not.toBe(asset.id);
    expect(JSON.stringify(copyPassage.contentJson)).toContain(copyAsset.id);
    expect(JSON.stringify(copyPassage.contentJson)).not.toContain(asset.id);
    // Thứ tự làm bài của bản sao giống bản gốc.
    const learner = await user("pe-l-dup@e.com");
    await enrollInCourse(learner, s.courseId);
    const orig = (await getPracticeForEmbed(learner, p.examId)).questions.map((q) => q.prompt);
    const dup = (await getPracticeForEmbed(learner, copyExamId)).questions.map((q) => q.prompt);
    expect(dup).toEqual(orig);
    // Độc lập: xoá câu ở bản sao không đổi bản gốc.
    const someCopyQ = await prisma.examQuestion.findFirstOrThrow({ where: { examId: copyExamId } });
    await deleteExamQuestion(s.owner, someCopyQ.id);
    expect(await prisma.examQuestion.count({ where: { examId: p.examId } })).toBe(3);
  });

  it("nhân bản khoá mang theo Bài luyện (trước đây bị bỏ); không chép lượt luyện của học viên", async () => {
    const s = await setup("dupcourse");
    const p = await practice(s);
    const learner = await user("pe-l-dupc@e.com");
    await enrollInCourse(learner, s.courseId);
    const { sessionId } = await startPracticeSession(learner, p.examId, { all: true });
    await savePracticeAnswer(learner, sessionId, p.q1, { optionIds: ["a"] });

    const c2 = await duplicateCourse(s.owner, s.courseId);
    const items = await prisma.contentItem.findMany({ where: { type: "exam_practice", lesson: { module: { courseId: c2.courseId } } } });
    expect(items).toHaveLength(1);
    const examId2 = (await getOwnedPracticeExamId(items[0]!.id))!;
    const exam2 = await prisma.exam.findUniqueOrThrow({ where: { id: examId2 } });
    expect(exam2.courseId).toBe(c2.courseId);
    expect(await prisma.examQuestion.count({ where: { examId: examId2 } })).toBe(3);
    expect(await prisma.examPracticeSession.count({ where: { examId: examId2 } })).toBe(0);
  });

  it("xem trước ghi âm của giảng viên: chỉ người sửa được khoá, câu essay còn bật voiceAnswer; trả ngôn ngữ của khoá; không tạo buổi luyện", async () => {
    const s = await setup("previewvoice");
    const p = await practice(s);
    await prisma.course.update({ where: { id: s.courseId }, data: { language: "en" } });
    const essay = await createExamQuestion(s.owner, p.examId, { type: "essay", prompt: "Talk about your day", config: { minWords: 5 }, points: 5 });
    const noVoice = await createExamQuestion(s.owner, p.examId, { type: "essay", prompt: "Write only", config: { voiceAnswer: false }, points: 5 });
    const sessionsBefore = await prisma.examPracticeSession.count({ where: { examId: p.examId } });
    expect(await getPreviewVoiceContext(s.owner, p.examId, essay.questionId)).toEqual({ language: "en" });
    expect(await prisma.examPracticeSession.count({ where: { examId: p.examId } })).toBe(sessionsBefore);
    await expect(getPreviewVoiceContext(s.owner, p.examId, noVoice.questionId)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(getPreviewVoiceContext(s.owner, p.examId, p.q1)).rejects.toMatchObject({ code: "validation_failed" }); // mcq
    const stranger = await user("pe-x-previewvoice@e.com");
    await expect(getPreviewVoiceContext(stranger, p.examId, essay.questionId)).rejects.toThrow(CourseAuthzError);
    const learner = await user("pe-l-previewvoice@e.com");
    await enrollInCourse(learner, s.courseId);
    await expect(getPreviewVoiceContext(learner, p.examId, essay.questionId)).rejects.toThrow(CourseAuthzError);
  });
});
