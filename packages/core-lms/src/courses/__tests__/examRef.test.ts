import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse, duplicateCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson, duplicateLesson } from "../lessons";
import { createContentItem, updateContentItem } from "../contents";
import { assertExamRefTarget, getExamRefBlockInfo, getExamRefPreviewCard, getExamRefStates, listExamRefChoices, listExamRefChoicesForLesson } from "../examRef";
import { CourseAuthzError } from "../authz";
import { createExam } from "../../exam";

// docs/tieu-chi/bai-hoc-gan-de-thi.md — khối "Đề thi" (exam_ref): gắn đề thi thử đã có của chính khoá vào bài.

const BASE = "http://localhost:3000";
const user = async (email: string) => (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;

async function setup(tag: string) {
  const owner = await user(`er-o-${tag}@e.com`);
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `er-${tag}` });
  const m = await createModule(owner, c.courseId, { title: "U1", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  return { owner, courseId: c.courseId, lessonId: l.lessonId };
}
async function mockExam(s: { owner: string; courseId: string }, title = "Thi thử", status: "draft" | "published" | "archived" = "published") {
  const { examId } = await createExam(s.owner, s.courseId, { title, durationMin: 10, mockMode: true });
  if (status !== "draft") await prisma.exam.update({ where: { id: examId }, data: { status } });
  return examId;
}
const addRef = (s: { owner: string; lessonId: string }, payload: unknown, orderIndex = 0) =>
  createContentItem(s.owner, s.lessonId, { type: "exam_ref", payload, orderIndex });

describe("tạo khối Đề thi", () => {
  it("đề thi thử của chính khoá (nháp hoặc đã xuất bản) gắn được; payload lưu examId và tiêu đề", async () => {
    const s = await setup("ok");
    const pub = await mockExam(s, "Đề A", "published");
    const draft = await mockExam(s, "Đề B", "draft");
    const a = await addRef(s, { examId: pub, title: "  Thi cuối unit  " });
    const b = await addRef(s, { examId: draft }, 1);
    expect((await prisma.contentItem.findUniqueOrThrow({ where: { id: a.contentItemId } })).payload).toEqual({ examId: pub, title: "Thi cuối unit" });
    expect((await prisma.contentItem.findUniqueOrThrow({ where: { id: b.contentItemId } })).payload).toEqual({ examId: draft });
    // một đề gắn vào nhiều bài được
    const l2 = await createLesson(s.owner, (await prisma.lesson.findUniqueOrThrow({ where: { id: s.lessonId } })).moduleId, { title: "Bài 2", orderIndex: 1 });
    await expect(createContentItem(s.owner, l2.lessonId, { type: "exam_ref", payload: { examId: pub }, orderIndex: 0 })).resolves.toBeTruthy();
  });

  it("bị từ chối: đề khoá khác, đề lưu trữ, đề không phải thi thử, đề ẩn của Bài luyện, không có hoặc null examId, khoá lạ trong payload", async () => {
    const s = await setup("bad");
    const other = await setup("bad-other");
    const otherExam = await mockExam(other);
    const archived = await mockExam(s, "Cũ", "archived");
    const plain = (await createExam(s.owner, s.courseId, { title: "Đề thường", durationMin: 10 })).examId; // mockMode=false
    const { contentItemId } = await createContentItem(s.owner, s.lessonId, { type: "exam_practice", payload: {}, orderIndex: 5 });
    const hidden = (await prisma.exam.findUniqueOrThrow({ where: { ownerContentItemId: contentItemId } })).id;
    for (const examId of [otherExam, archived, plain, hidden, "00000000-0000-0000-0000-000000000000"]) {
      await expect(addRef(s, { examId }), examId).rejects.toMatchObject({ code: "validation_failed" });
    }
    await expect(addRef(s, {})).rejects.toMatchObject({ code: "validation_failed" });
    await expect(addRef(s, { examId: null })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(addRef(s, { examId: otherExam, lạ: 1 })).rejects.toMatchObject({ code: "validation_failed" });
    expect(await prisma.contentItem.count({ where: { lessonId: s.lessonId, type: "exam_ref" } })).toBe(0);
  });

  it("người không sửa được khoá bị từ chối", async () => {
    const s = await setup("authz");
    const exam = await mockExam(s);
    const stranger = await user("er-x-authz@e.com");
    await expect(createContentItem(stranger, s.lessonId, { type: "exam_ref", payload: { examId: exam }, orderIndex: 0 })).rejects.toThrow(CourseAuthzError);
  });
});

describe("sửa khối Đề thi", () => {
  it("đổi sang đề khác hợp lệ được; đổi sang đề không hợp lệ hoặc null bị từ chối và giữ nguyên", async () => {
    const s = await setup("upd");
    const a = await mockExam(s, "A");
    const b = await mockExam(s, "B");
    const other = await mockExam(await setup("upd-other"), "Khoá khác");
    const { contentItemId } = await addRef(s, { examId: a });
    await updateContentItem(s.owner, contentItemId, { payload: { examId: b } });
    expect((await prisma.contentItem.findUniqueOrThrow({ where: { id: contentItemId } })).payload).toEqual({ examId: b });
    await expect(updateContentItem(s.owner, contentItemId, { payload: { examId: other } })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(updateContentItem(s.owner, contentItemId, { payload: { examId: null } })).rejects.toMatchObject({ code: "validation_failed" });
    expect((await prisma.contentItem.findUniqueOrThrow({ where: { id: contentItemId } })).payload).toEqual({ examId: b });
  });
});

describe("nhân bản", () => {
  it("nhân bản bài trong cùng khoá giữ examId; nhân bản khoá bỏ liên kết (examId null) và không nhân bản đề", async () => {
    const s = await setup("dup");
    const exam = await mockExam(s);
    await addRef(s, { examId: exam, title: "Thi cuối unit" });
    const d = await duplicateLesson(s.owner, s.lessonId);
    const copied = await prisma.contentItem.findFirstOrThrow({ where: { lessonId: d.lessonId, type: "exam_ref" } });
    expect(copied.payload).toEqual({ examId: exam, title: "Thi cuối unit" });

    const c2 = await duplicateCourse(s.owner, s.courseId);
    const refs = await prisma.contentItem.findMany({ where: { type: "exam_ref", lesson: { module: { courseId: c2.courseId } } } });
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(r.payload).toEqual({ examId: null, title: "Thi cuối unit" });
    expect(await prisma.exam.count({ where: { courseId: c2.courseId, ownerContentItemId: null } })).toBe(0);
  });
});

describe("getExamRefStates / listExamRefChoices / assertExamRefTarget", () => {
  it("trạng thái từng đề: ok, nháp, lưu trữ, tắt cả hai công tắc, không tồn tại, khoá khác, chưa chọn", async () => {
    const s = await setup("state");
    const ok = await mockExam(s, "OK", "published");
    const draft = await mockExam(s, "Nháp", "draft");
    const archived = await mockExam(s, "Cũ", "archived");
    const off = await mockExam(s, "Tắt", "published");
    await prisma.exam.update({ where: { id: off }, data: { allowMock: false, allowPractice: false } });
    const other = await mockExam(await setup("state-other"));
    const missing = "00000000-0000-0000-0000-000000000000";
    const m = await getExamRefStates(s.courseId, [ok, draft, archived, off, other, missing, null]);
    expect(m.get(ok)).toMatchObject({ issue: "ok", title: "OK" });
    expect(m.get(draft)!.issue).toBe("draft");
    expect(m.get(archived)!.issue).toBe("archived");
    expect(m.get(off)!.issue).toBe("modes_off");
    expect(m.get(other)!.issue).toBe("other_course");
    expect(m.get(missing)!.issue).toBe("missing");
    expect(m.get(null)!.issue).toBe("not_selected");
  });

  it("danh sách chọn chỉ có đề thi thử còn dùng được của khoá, kèm số phần và số phút; người lạ bị từ chối", async () => {
    const s = await setup("list");
    const a = await mockExam(s, "A", "published");
    await mockExam(s, "Lưu trữ", "archived");
    await createExam(s.owner, s.courseId, { title: "Đề thường", durationMin: 10 });
    await mockExam(await setup("list-other"), "Khoá khác");
    const list = await listExamRefChoices(s.owner, s.courseId);
    expect(list.map((e) => e.id)).toEqual([a]);
    expect(list[0]).toMatchObject({ title: "A", status: "published", sectionCount: 0, totalMinutes: 0 });
    await expect(listExamRefChoices(await user("er-x-list@e.com"), s.courseId)).rejects.toThrow(CourseAuthzError);
    await expect(assertExamRefTarget(s.courseId, a)).resolves.toBeUndefined();
  });
});

describe("hàm cho trình soạn và xem thử", () => {
  it("listExamRefChoicesForLesson trả courseId của bài và danh sách đề; người lạ bị từ chối", async () => {
    const s = await setup("lesson");
    const a = await mockExam(s, "A");
    const r = await listExamRefChoicesForLesson(s.owner, s.lessonId);
    expect(r.courseId).toBe(s.courseId);
    expect(r.choices.map((c) => c.id)).toEqual([a]);
    await expect(listExamRefChoicesForLesson(await user("er-x-lesson@e.com"), s.lessonId)).rejects.toThrow(CourseAuthzError);
  });

  it("getExamRefBlockInfo: tên đề và trạng thái của khối; đổi trạng thái đề thì đổi theo; khối không phải exam_ref hoặc người lạ thì từ chối", async () => {
    const s = await setup("info");
    const exam = await mockExam(s, "Đề thi cuối unit", "published");
    const { contentItemId } = await addRef(s, { examId: exam });
    expect(await getExamRefBlockInfo(s.owner, contentItemId)).toMatchObject({ courseId: s.courseId, examId: exam, title: "Đề thi cuối unit", issue: "ok", allowMock: true, allowPractice: true });
    await prisma.exam.update({ where: { id: exam }, data: { status: "archived" } });
    expect((await getExamRefBlockInfo(s.owner, contentItemId)).issue).toBe("archived");
    const rich = await createContentItem(s.owner, s.lessonId, { type: "richtext", payload: { html: "<p>x</p>" }, orderIndex: 3 });
    await expect(getExamRefBlockInfo(s.owner, rich.contentItemId)).rejects.toThrow(CourseAuthzError);
    await expect(getExamRefBlockInfo(await user("er-x-info@e.com"), contentItemId)).rejects.toThrow(CourseAuthzError);
  });

  it("getExamRefPreviewCard: thẻ không có lượt thi/buổi luyện, đủ phần và số phút; null với đề không gắn được", async () => {
    const s = await setup("card");
    const exam = await mockExam(s, "Thi HSK");
    await prisma.examSection.create({ data: { examId: exam, title: "Nghe", orderIndex: 0, durationMin: 30, languageSkill: "listening" } });
    await prisma.examSection.create({ data: { examId: exam, title: "Đọc", orderIndex: 1, durationMin: 45, languageSkill: "reading" } });
    const card = await getExamRefPreviewCard(s.courseId, exam);
    expect(card).toMatchObject({ examId: exam, title: "Thi HSK", totalMinutes: 75, attempt: null, attemptCount: 0, practice: { inProgress: null, completedCount: 0 } });
    expect(card!.sections.map((x) => x.title)).toEqual(["Nghe", "Đọc"]);
    const other = await setup("card-other");
    expect(await getExamRefPreviewCard(other.courseId, exam)).toBeNull();
  });
});

