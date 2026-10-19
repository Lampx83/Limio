import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { createExam, createExamQuestion, createSection } from "../";
import {
  bulkExamAction,
  createExamCollection,
  deleteExamCollection,
  listCourseExamsTable,
  listExamCollections,
  reorderExamCollections,
  updateExamCollection,
} from "../library-admin";

/**
 * LANG L6.6 / L6.7 — quản lý hàng trăm đề của khoá luyện đề: bảng phân trang phía máy chủ, thao tác hàng loạt báo
 * kết quả TỪNG DÒNG, quản lý bộ. Chỉ người có quyền sửa khoá mới dùng được.
 */

const BASE = "http://localhost:3000";
const MCQ = { type: "mcq" as const, prompt: "Q", config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] } };

async function setup(slug: string) {
  const owner = await registerUser({ email: `lad-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `lad-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { kind: "practice_bank", status: "published", publishedAt: new Date() } });
  return { ownerId: owner.userId, courseId: course.courseId };
}

async function mk(s: { ownerId: string; courseId: string }, title: string, meta: Record<string, unknown> = {}, withQuestion = true) {
  const { examId } = await createExam(s.ownerId, s.courseId, { title, durationMin: 10, mockMode: true });
  if (withQuestion) {
    const { id } = await createSection(s.ownerId, examId, { title: "Nghe", durationMin: 10, languageSkill: "listening" });
    await createExamQuestion(s.ownerId, examId, { ...MCQ, sectionId: id });
  }
  if (Object.keys(meta).length) await prisma.exam.update({ where: { id: examId }, data: meta });
  return examId;
}

describe("listCourseExamsTable (L6.6)", () => {
  it("phân trang 50 dòng/trang mặc định, tổng đúng, trang 2 không trùng trang 1", async () => {
    const s = await setup("page");
    for (let i = 1; i <= 7; i++) await mk(s, `Đề ${String(i).padStart(2, "0")}`, { seq: i }, false);
    const p1 = await listCourseExamsTable(s.ownerId, s.courseId, { pageSize: 3 });
    const p2 = await listCourseExamsTable(s.ownerId, s.courseId, { pageSize: 3, page: 2 });
    expect(p1.total).toBe(7);
    expect(p1.rows.map((r) => r.title)).toEqual(["Đề 01", "Đề 02", "Đề 03"]);
    expect(p2.rows.map((r) => r.title)).toEqual(["Đề 04", "Đề 05", "Đề 06"]);
    expect((await listCourseExamsTable(s.ownerId, s.courseId, {})).pageSize).toBe(50);
  });

  it("tìm, lọc theo trạng thái / loại / bộ / độ khó / học thử, và sắp xếp theo cột", async () => {
    const s = await setup("filter");
    const c = await prisma.examCollection.create({ data: { courseId: s.courseId, title: "Part 1" } });
    await mk(s, "Alpha", { seq: 2, paperType: "official", difficulty: 3, collectionId: c.id, status: "published", freePreview: true }, false);
    await mk(s, "Beta", { seq: 1, paperType: "mock", difficulty: 5 }, false);
    await mk(s, "Gamma thật", { seq: 3, paperType: "official", sourceLabel: "IELTS Cambridge 15" }, false);
    const t = (f: Parameters<typeof listCourseExamsTable>[2]) => listCourseExamsTable(s.ownerId, s.courseId, f).then((r) => r.rows.map((x) => x.title));
    expect(await t({ q: "gamma" })).toEqual(["Gamma thật"]);
    expect(await t({ q: "cambridge" })).toEqual(["Gamma thật"]);
    expect(await t({ status: "published" })).toEqual(["Alpha"]);
    expect((await t({ paperType: "official" })).sort()).toEqual(["Alpha", "Gamma thật"]);
    expect(await t({ collectionId: c.id })).toEqual(["Alpha"]);
    expect(await t({ collectionId: "none" })).toEqual(["Beta", "Gamma thật"].sort());
    expect(await t({ difficulty: 5 })).toEqual(["Beta"]);
    expect(await t({ freePreview: true })).toEqual(["Alpha"]);
    expect(await t({ sort: "seq", dir: "asc" })).toEqual(["Beta", "Alpha", "Gamma thật"]);
    expect(await t({ sort: "title", dir: "desc" })).toEqual(["Gamma thật", "Beta", "Alpha"]);
  });

  it("hàng có số câu, số lượt làm, tên bộ; chỉ đề của khoá được hỏi", async () => {
    const s = await setup("rows");
    const other = await setup("rows2");
    const c = await prisma.examCollection.create({ data: { courseId: s.courseId, title: "Part 2" } });
    const id = await mk(s, "Có câu", { collectionId: c.id });
    await mk(other, "Của khoá khác");
    const u = await prisma.user.create({ data: { email: `lad-u-${Date.now()}@e.com`, passwordHash: "x", displayName: "U" } });
    await prisma.examAttempt.create({ data: { examId: id, userId: u.id, status: "in_progress", durationSec: 60 } });
    const r = await listCourseExamsTable(s.ownerId, s.courseId, {});
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ title: "Có câu", questionCount: 1, attemptCount: 1, collectionTitle: "Part 2" });
  });

  it("người không có quyền sửa khoá → bị từ chối", async () => {
    const s = await setup("authz");
    const stranger = await registerUser({ email: "lad-x-authz@e.com", password: "password1234", displayName: "X" }, BASE);
    await expect(listCourseExamsTable(stranger.userId, s.courseId, {})).rejects.toBeTruthy();
  });
});

describe("bulkExamAction (L6.6)", () => {
  it("update: gán loại/nguồn/độ khó/bộ cho nhiều đề; kết quả báo TỪNG dòng, một dòng hỏng không làm hỏng dòng khác", async () => {
    const s = await setup("bulk");
    const a = await mk(s, "A");
    const b = await mk(s, "B");
    const c = await prisma.examCollection.create({ data: { courseId: s.courseId, title: "Part 1" } });
    const foreign = await setup("bulk2");
    const r = await bulkExamAction(s.ownerId, s.courseId, {
      action: "update",
      examIds: [a, b, "00000000-0000-4000-8000-000000000000"],
      patch: { paperType: "official", sourceLabel: "HSK 2023", difficulty: 4, collectionId: c.id },
    });
    expect(r.results.map((x) => [x.ok, x.ok ? null : x.error])).toEqual([[true, null], [true, null], [false, "exam_not_found"]]);
    expect(await prisma.exam.findMany({ where: { id: { in: [a, b] } }, select: { paperType: true, sourceLabel: true, difficulty: true, collectionId: true } })).toEqual([
      { paperType: "official", sourceLabel: "HSK 2023", difficulty: 4, collectionId: c.id },
      { paperType: "official", sourceLabel: "HSK 2023", difficulty: 4, collectionId: c.id },
    ]);
    // đề của KHOÁ KHÁC bị từ chối dù có id hợp lệ
    const fx = await mk(foreign, "Khoá khác");
    const r2 = await bulkExamAction(s.ownerId, s.courseId, { action: "update", examIds: [fx], patch: { difficulty: 1 } });
    expect(r2.results[0]).toMatchObject({ ok: false, error: "exam_not_in_course" });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: fx } })).difficulty).toBeNull();
  });

  it("update với tag: chế độ set / add / remove", async () => {
    const s = await setup("tags");
    const a = await mk(s, "A", { tags: ["x", "y"] });
    await bulkExamAction(s.ownerId, s.courseId, { action: "update", examIds: [a], patch: { tags: ["z", "x"] }, tagsMode: "add" });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: a } })).tags.sort()).toEqual(["x", "y", "z"]);
    await bulkExamAction(s.ownerId, s.courseId, { action: "update", examIds: [a], patch: { tags: ["y"] }, tagsMode: "remove" });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: a } })).tags.sort()).toEqual(["x", "z"]);
    await bulkExamAction(s.ownerId, s.courseId, { action: "update", examIds: [a], patch: { tags: ["only"] }, tagsMode: "set" });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: a } })).tags).toEqual(["only"]);
  });

  it("update: bật/tắt thi thử, luyện đề, học thử cho nhiều đề cùng lúc", async () => {
    const s = await setup("flags");
    const ids = [await mk(s, "A"), await mk(s, "B")];
    await bulkExamAction(s.ownerId, s.courseId, { action: "update", examIds: ids, patch: { allowMock: false, allowPractice: true, freePreview: true } });
    for (const e of await prisma.exam.findMany({ where: { id: { in: ids } } })) {
      expect(e).toMatchObject({ allowMock: false, allowPractice: true, freePreview: true });
    }
  });

  it("publish: đề đủ điều kiện được xuất bản; đề thiếu (không có câu) báo lỗi RIÊNG của dòng đó", async () => {
    const s = await setup("pub");
    const ok = await mk(s, "Đủ");
    const bad = await mk(s, "Thiếu", {}, false);
    const r = await bulkExamAction(s.ownerId, s.courseId, { action: "publish", examIds: [ok, bad] });
    expect(r.results[0]).toMatchObject({ examId: ok, ok: true });
    expect(r.results[1]).toMatchObject({ examId: bad, ok: false });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: ok } })).status).toBe("published");
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: bad } })).status).toBe("draft");
  });

  it("archive: chuyển sang lưu trữ (không xoá), đề biến khỏi danh sách học viên", async () => {
    const s = await setup("arch");
    const a = await mk(s, "A");
    const r = await bulkExamAction(s.ownerId, s.courseId, { action: "archive", examIds: [a] });
    expect(r.results[0]).toMatchObject({ ok: true });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: a } })).status).toBe("archived");
  });

  it("clone: bản sao là NHÁP, vẫn là đề ngoại ngữ (mockMode, phần, câu hỏi) và giữ phân loại + bộ; không sao chép số thứ tự và cờ học thử", async () => {
    const s = await setup("clone");
    const c = await prisma.examCollection.create({ data: { courseId: s.courseId, title: "Part 1" } });
    const a = await mk(s, "Gốc", { paperType: "official", sourceLabel: "HSK 2023", difficulty: 3, tags: ["t"], collectionId: c.id, seq: 5, freePreview: true, allowMock: false });
    const r = await bulkExamAction(s.ownerId, s.courseId, { action: "clone", examIds: [a] });
    const newId = (r.results[0] as { ok: true; newExamId: string }).newExamId;
    const copy = await prisma.exam.findUniqueOrThrow({ where: { id: newId }, include: { sections: true, questions: true } });
    expect(copy).toMatchObject({ status: "draft", mockMode: true, allowMock: false, paperType: "official", sourceLabel: "HSK 2023", difficulty: 3, collectionId: c.id, seq: null, freePreview: false });
    expect(copy.tags).toEqual(["t"]);
    expect(copy.sections).toHaveLength(1);
    expect(copy.sections[0]).toMatchObject({ languageSkill: "listening", durationMin: 10 });
    expect(copy.questions).toHaveLength(1);
  });

  it("giới hạn 200 đề/lần và danh sách rỗng bị từ chối; người không có quyền bị từ chối", async () => {
    const s = await setup("lim");
    await expect(bulkExamAction(s.ownerId, s.courseId, { action: "archive", examIds: [] })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(bulkExamAction(s.ownerId, s.courseId, { action: "archive", examIds: Array.from({ length: 201 }, () => "00000000-0000-4000-8000-000000000000") })).rejects.toMatchObject({ code: "validation_failed" });
    const stranger = await registerUser({ email: "lad-x-lim@e.com", password: "password1234", displayName: "X" }, BASE);
    await expect(bulkExamAction(stranger.userId, s.courseId, { action: "archive", examIds: ["00000000-0000-4000-8000-000000000000"] })).rejects.toBeTruthy();
  });
});

describe("bộ / Part / chủ đề (L6.7)", () => {
  it("tạo (tự xếp cuối), đổi tên, sắp thứ tự, liệt kê kèm số đề", async () => {
    const s = await setup("coll");
    const a = await createExamCollection(s.ownerId, s.courseId, { title: "Part 1" });
    const b = await createExamCollection(s.ownerId, s.courseId, { title: "Part 2", description: "Mô tả" });
    expect((await listExamCollections(s.ownerId, s.courseId)).map((c) => c.title)).toEqual(["Part 1", "Part 2"]);
    await updateExamCollection(s.ownerId, b.collectionId, { title: "Part 2 — mới" });
    await reorderExamCollections(s.ownerId, s.courseId, [b.collectionId, a.collectionId]);
    const e = await mk(s, "X", { collectionId: b.collectionId }, false);
    const list = await listExamCollections(s.ownerId, s.courseId);
    expect(list.map((c) => [c.title, c.examCount])).toEqual([["Part 2 — mới", 1], ["Part 1", 0]]);
    void e;
  });

  it("xoá bộ KHÔNG xoá đề — đề về 'chưa thuộc bộ nào'", async () => {
    const s = await setup("del");
    const a = await createExamCollection(s.ownerId, s.courseId, { title: "Part 1" });
    const e = await mk(s, "X", { collectionId: a.collectionId }, false);
    await deleteExamCollection(s.ownerId, a.collectionId);
    expect(await prisma.examCollection.count({ where: { id: a.collectionId } })).toBe(0);
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: e } })).collectionId).toBeNull();
  });

  it("tên rỗng/quá dài bị từ chối; sắp thứ tự với id lạ bị từ chối; người ngoài không sửa được", async () => {
    const s = await setup("val");
    await expect(createExamCollection(s.ownerId, s.courseId, { title: "  " })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createExamCollection(s.ownerId, s.courseId, { title: "x".repeat(201) })).rejects.toMatchObject({ code: "validation_failed" });
    const a = await createExamCollection(s.ownerId, s.courseId, { title: "Part 1" });
    await expect(reorderExamCollections(s.ownerId, s.courseId, [a.collectionId, "00000000-0000-4000-8000-000000000000"])).rejects.toMatchObject({ code: "collection_not_found" });
    const stranger = await registerUser({ email: "lad-x-val@e.com", password: "password1234", displayName: "X" }, BASE);
    await expect(updateExamCollection(stranger.userId, a.collectionId, { title: "hack" })).rejects.toBeTruthy();
    await expect(deleteExamCollection(stranger.userId, a.collectionId)).rejects.toBeTruthy();
  });
});
