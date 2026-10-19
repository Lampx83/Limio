import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getPracticeLibrarySummary, listPracticeLibrary } from "../library";
import { ExamError } from "../types";

/**
 * LANG L6.1–L6.5 — thư viện đề của khoá luyện đề (practice_bank): danh sách phân trang cho học viên, lọc,
 * trạng thái cá nhân, học thử miễn phí, khoá nội dung với đề chưa mua. Dữ liệu dựng thẳng bằng Prisma.
 */

let seq = 0;
const uid = () => `${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;

async function user(tag: string) {
  return prisma.user.create({ data: { email: `lib-${tag}-${uid()}@e.com`, passwordHash: "x", displayName: `U ${tag}` } });
}

async function bank(o: { kind?: "practice_bank" | "standard" } = {}) {
  const teacher = await user("t");
  const course = await prisma.course.create({
    data: {
      slug: `lib-${uid()}`,
      title: "HSK 4 — Listening",
      description: "x",
      languageMode: true,
      personalizationEnabled: true,
      status: "published",
      kind: o.kind ?? "practice_bank",
    },
  });
  await prisma.courseInstructor.create({ data: { courseId: course.id, userId: teacher.id, role: "owner" } });
  const section = await prisma.courseSection.create({ data: { courseId: course.id, name: "Lớp" } });
  return { courseId: course.id, teacherId: teacher.id, sectionId: section.id };
}

async function enroll(courseId: string, sectionId: string, userId: string) {
  return prisma.enrollment.create({ data: { userId, courseId, sectionId, courseVersion: 1 } });
}

async function collection(courseId: string, title: string, orderIndex: number) {
  return prisma.examCollection.create({ data: { courseId, title, orderIndex } });
}

async function exam(
  courseId: string,
  o: Partial<{
    title: string; seq: number; paperType: "official" | "mock" | "practice_set"; collectionId: string | null; yearLabel: string;
    sourceLabel: string; difficulty: number; tags: string[]; freePreview: boolean; status: "draft" | "published";
    allowMock: boolean; allowPractice: boolean; skill: "listening" | "reading";
  }> = {},
) {
  const e = await prisma.exam.create({
    data: {
      courseId,
      title: o.title ?? `Đề ${uid()}`,
      durationMin: 30,
      openAt: new Date(Date.now() - 86_400_000),
      closeAt: new Date(Date.now() + 86_400_000),
      mockMode: true,
      status: o.status ?? "published",
      allowMock: o.allowMock ?? true,
      allowPractice: o.allowPractice ?? true,
      seq: o.seq ?? null,
      paperType: o.paperType ?? null,
      collectionId: o.collectionId ?? null,
      yearLabel: o.yearLabel ?? null,
      sourceLabel: o.sourceLabel ?? null,
      difficulty: o.difficulty ?? null,
      tags: o.tags ?? [],
      freePreview: o.freePreview ?? false,
    },
  });
  await prisma.examSection.create({ data: { examId: e.id, title: "Nghe", orderIndex: 0, languageSkill: o.skill ?? "listening", durationMin: 20 } });
  return e;
}

async function attempt(examId: string, userId: string, status: "in_progress" | "submitted", scorePct: number | null = null, at = new Date()) {
  return prisma.examAttempt.create({
    data: { examId, userId, status, scorePct, startedAt: at, durationSec: 1800, ...(status === "submitted" ? { submittedAt: at } : {}) },
  });
}

describe("listPracticeLibrary — phạm vi và truy cập (L6.2, L6.5)", () => {
  it("học viên đã ghi danh thấy mọi đề đã xuất bản và còn bật thi thử/luyện đề; bỏ nháp và đề tắt cả hai chế độ", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    await exam(b.courseId, { title: "A", seq: 1 });
    await exam(b.courseId, { title: "B", seq: 2, allowMock: false });
    await exam(b.courseId, { title: "C", seq: 3, allowMock: false, allowPractice: false });
    await exam(b.courseId, { title: "D", seq: 4, status: "draft" });
    const r = await listPracticeLibrary(me.id, b.courseId, {});
    expect(r.items.map((i) => i.title)).toEqual(["A", "B"]);
    expect(r.items.every((i) => i.locked === false)).toBe(true);
    expect(r.total).toBe(2);
  });

  it("chưa ghi danh vào khoá luyện đề: thấy danh sách (tên/nguồn/độ khó) nhưng đề không học thử là KHOÁ", async () => {
    const b = await bank();
    const guest = await user("guest");
    await exam(b.courseId, { title: "Mở", seq: 1, freePreview: true });
    await exam(b.courseId, { title: "Khoá", seq: 2, sourceLabel: "HSK 2023-05", difficulty: 3 });
    const r = await listPracticeLibrary(guest.id, b.courseId, {});
    const byTitle = Object.fromEntries(r.items.map((i) => [i.title, i]));
    expect(byTitle["Mở"]).toMatchObject({ locked: false, freePreview: true });
    expect(byTitle["Khoá"]).toMatchObject({ locked: true, sourceLabel: "HSK 2023-05", difficulty: 3 });
    expect(r.access).toBe("preview");
  });

  it("L6.5: hình dạng dữ liệu của đề khoá KHÔNG chứa câu hỏi, audio hay số câu — chỉ siêu dữ liệu", async () => {
    const b = await bank();
    const guest = await user("guest");
    await exam(b.courseId, { title: "Khoá", seq: 1 });
    const r = await listPracticeLibrary(guest.id, b.courseId, {});
    const json = JSON.stringify(r.items[0]);
    for (const banned of ["question", "prompt", "audio", "answer", "config", "passage"]) expect(json.toLowerCase()).not.toContain(banned);
  });

  it("khoá thường (không phải practice_bank) mà chưa ghi danh → not_enrolled như trước", async () => {
    const b = await bank({ kind: "standard" });
    const guest = await user("guest");
    await exam(b.courseId, { freePreview: true });
    await expect(listPracticeLibrary(guest.id, b.courseId, {})).rejects.toBeInstanceOf(ExamError);
    await expect(listPracticeLibrary(guest.id, b.courseId, {})).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("khoá NHÁP (chưa xuất bản): người chưa ghi danh không thấy gì — như khoá không tồn tại; người đã ghi danh vẫn vào được", async () => {
    const b = await bank();
    await prisma.course.update({ where: { id: b.courseId }, data: { status: "draft" } });
    await exam(b.courseId, { freePreview: true });
    const guest = await user("guest");
    await expect(listPracticeLibrary(guest.id, b.courseId, {})).rejects.toMatchObject({ code: "course_not_found" });
    await expect(getPracticeLibrarySummary(guest.id, b.courseId)).rejects.toMatchObject({ code: "course_not_found" });
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    expect((await listPracticeLibrary(me.id, b.courseId, {})).items).toHaveLength(1);
  });

  it("khoá không tồn tại → course_not_found", async () => {
    const me = await user("me");
    await expect(listPracticeLibrary(me.id, "00000000-0000-4000-8000-000000000000", {})).rejects.toMatchObject({ code: "course_not_found" });
  });
});

describe("listPracticeLibrary — lọc, tìm, sắp xếp, phân trang (L6.2)", () => {
  async function setup() {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    const c1 = await collection(b.courseId, "Part 1", 0);
    const c2 = await collection(b.courseId, "Part 2", 1);
    await exam(b.courseId, { title: "Đề thật 2023", seq: 1, collectionId: c1.id, paperType: "official", yearLabel: "2023", difficulty: 3, sourceLabel: "HSK 2023-05" });
    await exam(b.courseId, { title: "Đề thật 2022", seq: 2, collectionId: c1.id, paperType: "official", yearLabel: "2022", difficulty: 4, tags: ["thực tế"] });
    await exam(b.courseId, { title: "Thi thử tuần 1", seq: 1, collectionId: c2.id, paperType: "mock", yearLabel: "2024", difficulty: 2 });
    await exam(b.courseId, { title: "Chưa phân loại", seq: null as unknown as number });
    return { ...b, me, c1, c2 };
  }

  it("lọc theo bộ, theo loại đề, theo năm, theo độ khó; 'none' là các đề chưa thuộc bộ nào", async () => {
    const s = await setup();
    expect((await listPracticeLibrary(s.me.id, s.courseId, { collectionId: s.c1.id })).items.map((i) => i.title).sort()).toEqual(["Đề thật 2022", "Đề thật 2023"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { collectionId: "none" })).items.map((i) => i.title)).toEqual(["Chưa phân loại"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { paperType: "mock" })).items.map((i) => i.title)).toEqual(["Thi thử tuần 1"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { year: "2022" })).items.map((i) => i.title)).toEqual(["Đề thật 2022"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { difficulty: 4 })).items.map((i) => i.title)).toEqual(["Đề thật 2022"]);
  });

  it("tìm theo tên, nguồn hoặc tag, không phân biệt hoa thường", async () => {
    const s = await setup();
    expect((await listPracticeLibrary(s.me.id, s.courseId, { q: "TUẦN" })).items.map((i) => i.title)).toEqual(["Thi thử tuần 1"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { q: "2023-05" })).items.map((i) => i.title)).toEqual(["Đề thật 2023"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { q: "thực tế" })).items.map((i) => i.title)).toEqual(["Đề thật 2022"]);
    expect((await listPracticeLibrary(s.me.id, s.courseId, { q: "không có gì" })).items).toEqual([]);
  });

  it("sắp xếp mặc định theo bộ rồi số thứ tự; đề chưa có số thứ tự xuống cuối", async () => {
    const s = await setup();
    const titles = (await listPracticeLibrary(s.me.id, s.courseId, {})).items.map((i) => i.title);
    expect(titles).toEqual(["Đề thật 2023", "Đề thật 2022", "Thi thử tuần 1", "Chưa phân loại"]);
  });

  it("phân trang theo con trỏ: limit và nextCursor, trang cuối không có nextCursor, tổng không đổi", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    for (let i = 1; i <= 7; i++) await exam(b.courseId, { title: `Đề ${String(i).padStart(2, "0")}`, seq: i });
    const p1 = await listPracticeLibrary(me.id, b.courseId, { limit: 3 });
    expect(p1.items.map((i) => i.title)).toEqual(["Đề 01", "Đề 02", "Đề 03"]);
    expect(p1.total).toBe(7);
    const p2 = await listPracticeLibrary(me.id, b.courseId, { limit: 3, cursor: p1.nextCursor! });
    expect(p2.items.map((i) => i.title)).toEqual(["Đề 04", "Đề 05", "Đề 06"]);
    const p3 = await listPracticeLibrary(me.id, b.courseId, { limit: 3, cursor: p2.nextCursor! });
    expect(p3.items.map((i) => i.title)).toEqual(["Đề 07"]);
    expect(p3.nextCursor).toBeNull();
    // limit bị chặn trên (100) và dưới (1); con trỏ rác → từ đầu
    expect((await listPracticeLibrary(me.id, b.courseId, { limit: 9999 })).items).toHaveLength(7);
    expect((await listPracticeLibrary(me.id, b.courseId, { cursor: "rác" })).items.length).toBeGreaterThan(0);
  });
});

describe("trạng thái cá nhân của học viên (L6.2, L6.3, L6.10)", () => {
  it("chưa làm · đang làm · đã làm · nên làm lại (đã làm nhưng mức 'Cần ôn'); nhãn mức không phải số", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    const e1 = await exam(b.courseId, { title: "Chưa", seq: 1 });
    const e2 = await exam(b.courseId, { title: "Dở", seq: 2 });
    const e3 = await exam(b.courseId, { title: "Xong tốt", seq: 3 });
    const e4 = await exam(b.courseId, { title: "Làm lại", seq: 4 });
    await attempt(e2.id, me.id, "in_progress");
    await attempt(e3.id, me.id, "submitted", 92);
    await attempt(e4.id, me.id, "submitted", 41);
    const r = await listPracticeLibrary(me.id, b.courseId, {});
    const by = Object.fromEntries(r.items.map((i) => [i.title, i]));
    expect(by["Chưa"]).toMatchObject({ myStatus: "not_started", lastLevel: null, attemptCount: 0 });
    expect(by["Dở"]).toMatchObject({ myStatus: "in_progress" });
    expect(by["Xong tốt"]).toMatchObject({ myStatus: "done", lastLevel: "solid", attemptCount: 1 });
    expect(by["Làm lại"]).toMatchObject({ myStatus: "redo", lastLevel: "needs_review" });
    for (const it of r.items) expect(Object.keys(it).some((k) => /score|pct|point/i.test(k))).toBe(false); // không lộ số điểm (kiểm theo tên trường, không theo giá trị)
    void e1;
  });

  it("lọc theo trạng thái của TÔI; 'chưa làm trước' đưa đề chưa làm lên đầu", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    const a = await exam(b.courseId, { title: "A", seq: 1 });
    await exam(b.courseId, { title: "B", seq: 2 });
    await attempt(a.id, me.id, "submitted", 90);
    expect((await listPracticeLibrary(me.id, b.courseId, { status: "done" })).items.map((i) => i.title)).toEqual(["A"]);
    expect((await listPracticeLibrary(me.id, b.courseId, { status: "not_started" })).items.map((i) => i.title)).toEqual(["B"]);
    expect((await listPracticeLibrary(me.id, b.courseId, { sort: "unstarted" })).items.map((i) => i.title)).toEqual(["B", "A"]);
  });

  it("không rò: lượt thi của người khác không ảnh hưởng trạng thái của tôi", async () => {
    const b = await bank();
    const me = await user("me");
    const other = await user("other");
    await enroll(b.courseId, b.sectionId, me.id);
    const e = await exam(b.courseId, { title: "A", seq: 1 });
    await attempt(e.id, other.id, "submitted", 95);
    const r = await listPracticeLibrary(me.id, b.courseId, {});
    expect(r.items[0]).toMatchObject({ myStatus: "not_started", attemptCount: 0, lastLevel: null });
  });

  it("buổi luyện đề đã hoàn tất cũng tính là đã làm; buổi đang dở tính là đang làm", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    const done = await exam(b.courseId, { title: "Luyện xong", seq: 1 });
    const open = await exam(b.courseId, { title: "Luyện dở", seq: 2 });
    await prisma.examPracticeSession.create({ data: { examId: done.id, userId: me.id, status: "completed", scope: {}, completedAt: new Date() } });
    await prisma.examPracticeSession.create({ data: { examId: open.id, userId: me.id, status: "in_progress", scope: {} } });
    const by = Object.fromEntries((await listPracticeLibrary(me.id, b.courseId, {})).items.map((i) => [i.title, i.myStatus]));
    expect(by).toEqual({ "Luyện xong": "done", "Luyện dở": "in_progress" });
  });
});

describe("getPracticeLibrarySummary (L6.1, L6.4)", () => {
  it("tổng số đề, số đã làm, các bộ kèm số đề, và dải 'Tiếp tục' (đang làm dở)", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    const c1 = await collection(b.courseId, "Part 1", 0);
    const c2 = await collection(b.courseId, "Part 2", 1);
    const a = await exam(b.courseId, { title: "A", seq: 1, collectionId: c1.id });
    const d = await exam(b.courseId, { title: "B", seq: 2, collectionId: c1.id });
    await exam(b.courseId, { title: "C", seq: 1, collectionId: c2.id, freePreview: true });
    await exam(b.courseId, { title: "Nháp", status: "draft" });
    await attempt(a.id, me.id, "submitted", 80);
    await attempt(d.id, me.id, "in_progress");
    const s = await getPracticeLibrarySummary(me.id, b.courseId);
    expect(s).toMatchObject({ enrolled: true, totalExams: 3, doneExams: 1, previewExams: 1, redoExams: 0 });
    expect(s.collections.map((c) => [c.title, c.count, c.done])).toEqual([["Part 1", 2, 1], ["Part 2", 1, 0]]);
    expect(s.inProgress.map((x) => x.title)).toEqual(["B"]);
    expect(s.course).toMatchObject({ title: "HSK 4 — Listening", kind: "practice_bank" });
  });

  it("L6.4: đếm số đề 'nên làm lại' (đã làm nhưng mức Cần ôn) để gợi ý ôn phần yếu", async () => {
    const b = await bank();
    const me = await user("me");
    await enroll(b.courseId, b.sectionId, me.id);
    const weak = await exam(b.courseId, { title: "Yếu" });
    const strong = await exam(b.courseId, { title: "Mạnh" });
    await attempt(weak.id, me.id, "submitted", 30);
    await attempt(strong.id, me.id, "submitted", 95);
    const s = await getPracticeLibrarySummary(me.id, b.courseId);
    expect(s).toMatchObject({ doneExams: 2, redoExams: 1 });
  });

  it("chưa ghi danh: enrolled=false, vẫn thấy số đề và các bộ (để quyết định mua), không có dải tiếp tục", async () => {
    const b = await bank();
    const guest = await user("guest");
    const c1 = await collection(b.courseId, "Part 1", 0);
    await exam(b.courseId, { collectionId: c1.id });
    const s = await getPracticeLibrarySummary(guest.id, b.courseId);
    expect(s).toMatchObject({ enrolled: false, totalExams: 1, doneExams: 0 });
    expect(s.collections).toHaveLength(1);
    expect(s.inProgress).toEqual([]);
  });
});
