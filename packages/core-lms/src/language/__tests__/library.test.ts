import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType, levelBandsOverlap, parseLevelBand } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { addCoInstructorByEmail } from "../../courses/instructors";
import { CourseAuthzError } from "../../courses/authz";
import { CourseError } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import { completeLesson } from "../../learning/lessons";
import { isLearnerActivityType } from "../../learning/activity";
import { canAccessProtectedMedia, findProtectingCourseIds, registerLessonMedia, setCourseProtectedMedia } from "../../courses/protectedMedia";
import {
  LIBRARY_PAGE_SIZE,
  levelBandsOverlapping,
  listLibrary,
  normalizeLibraryMeta,
  parseLibraryQuery,
  plainExcerpt,
  saveLibraryCourse,
  unsaveLibraryCourse,
  updateCourseLibraryMeta,
} from "../library";

const BASE = "http://localhost:3000";

describe("shared-types: trình độ CEFR", () => {
  it("parseLevelBand nhận mức đơn và khoảng đúng thứ tự, từ chối còn lại", () => {
    expect(parseLevelBand("A2")).toEqual(["A2", "A2"]);
    expect(parseLevelBand("B1-B2")).toEqual(["B1", "B2"]);
    for (const bad of ["B2-B1", "b1", "B1 - B2", "D1", "", "B1-", "A1-B2-C1"]) expect(parseLevelBand(bad)).toBeNull();
  });
  it("levelBandsOverlap: giao khoảng, không giao thì false, sai định dạng thì false", () => {
    expect(levelBandsOverlap("B1-B2", "B2")).toBe(true);
    expect(levelBandsOverlap("A1-A2", "B1")).toBe(false);
    expect(levelBandsOverlap("A1-C2", "C1")).toBe(true);
    expect(levelBandsOverlap("xx", "B1")).toBe(false);
  });
});

describe("normalizeLibraryMeta (hàm thuần)", () => {
  it("cắt khoảng trắng, chuỗi rỗng và null là xoá, trường vắng mặt giữ nguyên", () => {
    const r = normalizeLibraryMeta({ publisher: "  Oxford  ", authors: "   ", edition: null });
    expect(r).toEqual({ publisher: "Oxford", authors: null, edition: null });
    expect("levelBand" in r).toBe(false);
    expect("inLibrary" in r).toBe(false);
  });
  it("từ chối chuỗi quá 120 ký tự và sai kiểu", () => {
    expect(() => normalizeLibraryMeta({ publisher: "x".repeat(121) })).toThrow(CourseError);
    expect(() => normalizeLibraryMeta({ authors: 5 })).toThrow(CourseError);
    expect(normalizeLibraryMeta({ publisher: "x".repeat(120) }).publisher).toHaveLength(120);
  });
  it("trình độ: A2 và B1-B2 hợp lệ; B2-B1, b1, D1 bị từ chối; rỗng là xoá", () => {
    expect(normalizeLibraryMeta({ levelBand: "B1-B2" }).levelBand).toBe("B1-B2");
    expect(normalizeLibraryMeta({ levelBand: "" }).levelBand).toBeNull();
    for (const bad of ["B2-B1", "b1", "D1", 3]) expect(() => normalizeLibraryMeta({ levelBand: bad })).toThrow(CourseError);
  });
  it("kỹ năng trọng tâm: chỉ giá trị cho phép, không trùng, tối đa 6", () => {
    expect(normalizeLibraryMeta({ focusTags: ["reading", "grammar"] }).focusTags).toEqual(["reading", "grammar"]);
    expect(() => normalizeLibraryMeta({ focusTags: ["reading", "reading"] })).toThrow(CourseError);
    expect(() => normalizeLibraryMeta({ focusTags: ["maths"] })).toThrow(CourseError);
    expect(() => normalizeLibraryMeta({ focusTags: "reading" })).toThrow(CourseError);
    expect(() => normalizeLibraryMeta({ focusTags: ["reading", "listening", "speaking", "writing", "grammar", "vocabulary", "reading"] })).toThrow(CourseError);
  });
  it("inLibrary phải là boolean", () => {
    expect(() => normalizeLibraryMeta({ inLibrary: "yes" })).toThrow(CourseError);
    expect(normalizeLibraryMeta({ inLibrary: false }).inLibrary).toBe(false);
  });
});

describe("parseLibraryQuery, levelBandsOverlapping, plainExcerpt", () => {
  it("giá trị lạ bị bỏ, trang bị ép về ≥ 1", () => {
    const q = parseLibraryQuery({ q: "  oxford ", level: "Z9", focus: "maths", tab: "x", sort: "zzz", page: "-3" });
    expect(q).toEqual({ q: "oxford", publisher: "", level: "", focus: "", tab: "all", sort: "relevant", page: 1 });
    expect(parseLibraryQuery({ tab: "saved", sort: "name", level: "B1", focus: "reading", page: "4" })).toMatchObject({
      tab: "saved", sort: "name", level: "B1", focus: "reading", page: 4,
    });
  });
  it("mọi khoảng giao với B1 nằm trong danh sách, khoảng không giao thì không", () => {
    const b = levelBandsOverlapping("B1");
    for (const ok of ["B1", "A2-B1", "B1-B2", "A1-C2", "B1-C2"]) expect(b).toContain(ok);
    for (const no of ["A1", "A2", "B2", "C1", "A1-A2", "B2-C1"]) expect(b).not.toContain(no);
  });
  it("mô tả: bỏ thẻ HTML và ký hiệu Markdown, gộp khoảng trắng, cắt có dấu ba chấm", () => {
    expect(plainExcerpt("<p>Ôn <b>ngữ pháp</b></p>\n\n## Tiêu đề **đậm** [link](http://x.y)")).toBe("Ôn ngữ pháp Tiêu đề đậm link");
    const long = plainExcerpt("a".repeat(300), 50);
    expect(long).toHaveLength(50);
    expect(long.endsWith("…")).toBe(true);
  });
});

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

type LibOpts = {
  inLibrary?: boolean;
  status?: "draft" | "published";
  enrollMode?: "open" | "invite_only";
  publisher?: string | null;
  authors?: string | null;
  levelBand?: string | null;
  focusTags?: string[];
  title?: string;
  publishedAt?: Date;
  lessons?: Array<{ previewable?: boolean; isHidden?: boolean }>;
};

/** Dựng khoá bằng hàm thật (để có module/bài), rồi chỉnh thẳng DB phần thư viện. */
async function libCourse(owner: string, slug: string, o: LibOpts = {}) {
  const c = await createCourse(owner, { title: o.title ?? `Giáo trình ${slug}`, description: `<p>Mô tả ${slug}</p>`, slug });
  const m = await createModule(owner, c.courseId, { title: "Unit 1", orderIndex: 0 });
  const lessonIds: string[] = [];
  const lessons = o.lessons ?? [{}];
  for (let i = 0; i < lessons.length; i++) {
    const l = await createLesson(owner, m.moduleId, { title: `Bài ${i + 1}`, orderIndex: i });
    lessonIds.push(l.lessonId);
    await prisma.lesson.update({ where: { id: l.lessonId }, data: { previewable: !!lessons[i]!.previewable, isHidden: !!lessons[i]!.isHidden } });
  }
  if ((o.status ?? "published") === "published") await publishCourse(owner, c.courseId);
  await prisma.course.update({
    where: { id: c.courseId },
    data: {
      inLibrary: o.inLibrary ?? true,
      enrollMode: o.enrollMode ?? "open",
      publisher: o.publisher === undefined ? "Oxford" : o.publisher,
      authors: o.authors === undefined ? null : o.authors,
      levelBand: o.levelBand === undefined ? null : o.levelBand,
      focusTags: o.focusTags ?? [],
      ...(o.publishedAt ? { publishedAt: o.publishedAt } : {}),
    },
  });
  return { courseId: c.courseId, moduleId: m.moduleId, lessonIds };
}

const slugs = (cards: Array<{ slug: string }>) => cards.map((c) => c.slug);

describe("updateCourseLibraryMeta (giảng viên đặt thông tin)", () => {
  it("chủ khoá đặt được; đồng giảng viên và người lạ bị từ chối; khoá không có → not_found", async () => {
    const owner = await makeUser("o1@e.com");
    const co = await makeUser("co1@e.com");
    const stranger = await makeUser("s1@e.com");
    const { courseId } = await libCourse(owner, "u1", { inLibrary: false });
    await addCoInstructorByEmail(owner, courseId, "co1@e.com", "co-instructor", BASE);

    const r = await updateCourseLibraryMeta(owner, courseId, { inLibrary: true, publisher: "NGL", levelBand: "B1-B2", focusTags: ["reading"] });
    expect(r).toMatchObject({ inLibrary: true, publisher: "NGL", levelBand: "B1-B2", focusTags: ["reading"], listed: true, hiddenReason: null });

    await expect(updateCourseLibraryMeta(co, courseId, { publisher: "X" })).rejects.toThrow(CourseAuthzError);
    await expect(updateCourseLibraryMeta(stranger, courseId, { publisher: "X" })).rejects.toThrow(CourseAuthzError);
    await expect(updateCourseLibraryMeta(owner, "00000000-0000-0000-0000-000000000000", {})).rejects.toMatchObject({ code: "not_found" });
    expect((await prisma.course.findUnique({ where: { id: courseId } }))?.publisher).toBe("NGL");
  });

  it("khoá nháp bật được nhưng chưa hiện (listed=false, nói rõ lý do)", async () => {
    const owner = await makeUser("o2@e.com");
    const { courseId } = await libCourse(owner, "u2", { inLibrary: false, status: "draft" });
    const r = await updateCourseLibraryMeta(owner, courseId, { inLibrary: true });
    expect(r).toMatchObject({ inLibrary: true, listed: false, hiddenReason: "not_published" });
  });

  it("khoá chỉ vào bằng link mời không bật được", async () => {
    const owner = await makeUser("o3@e.com");
    const { courseId } = await libCourse(owner, "u3", { inLibrary: false, enrollMode: "invite_only" });
    await expect(updateCourseLibraryMeta(owner, courseId, { inLibrary: true })).rejects.toMatchObject({ code: "validation_failed" });
    expect((await prisma.course.findUnique({ where: { id: courseId } }))?.inLibrary).toBe(false);
  });

  it("đổi công tắc ghi nhật ký và sự kiện đúng một lần; sửa trường khác hoặc đặt lại cùng giá trị thì không ghi", async () => {
    const owner = await makeUser("o4@e.com");
    const { courseId } = await libCourse(owner, "u4", { inLibrary: false });
    await updateCourseLibraryMeta(owner, courseId, { inLibrary: true });
    await updateCourseLibraryMeta(owner, courseId, { inLibrary: true, publisher: "Khác" });
    const listed = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.LibraryCourseListed } });
    expect(listed).toHaveLength(1);
    expect(listed[0]!.payload).toEqual({ courseId });
    expect(await prisma.auditLog.count({ where: { action: LearningEventType.LibraryCourseListed } })).toBe(1);
    await updateCourseLibraryMeta(owner, courseId, { inLibrary: false });
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.LibraryCourseUnlisted } })).toBe(1);
  });

  it("đầu vào sai không làm đổi gì", async () => {
    const owner = await makeUser("o5@e.com");
    const { courseId } = await libCourse(owner, "u5", { inLibrary: false, publisher: "A" });
    await expect(updateCourseLibraryMeta(owner, courseId, { publisher: "B", levelBand: "B2-B1" })).rejects.toThrow(CourseError);
    expect((await prisma.course.findUnique({ where: { id: courseId } }))?.publisher).toBe("A");
  });
});

describe("listLibrary: điều kiện hiển thị, lọc, sắp xếp, phân trang", () => {
  it("chỉ khoá published + inLibrary + mở tự do; totalAll không đếm khoá ngoài", async () => {
    const owner = await makeUser("l1o@e.com");
    const me = await makeUser("l1m@e.com");
    await libCourse(owner, "ok");
    await libCourse(owner, "draft", { status: "draft" });
    await libCourse(owner, "out", { inLibrary: false });
    await libCourse(owner, "invite", { enrollMode: "invite_only" });
    const page = await listLibrary(me, {});
    expect(slugs(page.cards)).toEqual(["ok"]);
    expect(page.totalAll).toBe(1);
    expect(page.matching).toBe(1);
  });

  it("tìm theo tên, tác giả, nhà xuất bản (không phân biệt hoa thường); lọc nhà xuất bản, kỹ năng, trình độ giao khoảng", async () => {
    const owner = await makeUser("l2o@e.com");
    const me = await makeUser("l2m@e.com");
    await libCourse(owner, "grammar", { title: "English Grammar in Use", publisher: "Cambridge", authors: "Raymond Murphy", levelBand: "B1-B2", focusTags: ["grammar"] });
    await libCourse(owner, "words", { title: "Oxford Word Skills", publisher: "Oxford", levelBand: "A2-B1", focusTags: ["vocabulary"] });
    await libCourse(owner, "reading", { title: "Active Skills for Reading", publisher: "NGL", authors: "Neil J Anderson", levelBand: "C1", focusTags: ["reading"] });

    expect(slugs((await listLibrary(me, { q: "GRAMMAR" })).cards)).toEqual(["grammar"]);
    expect(slugs((await listLibrary(me, { q: "murphy" })).cards)).toEqual(["grammar"]);
    expect(slugs((await listLibrary(me, { q: "oxford" })).cards)).toEqual(["words"]);
    expect(slugs((await listLibrary(me, { publisher: "NGL" })).cards)).toEqual(["reading"]);
    expect(slugs((await listLibrary(me, { focus: "vocabulary" })).cards)).toEqual(["words"]);
    expect(slugs((await listLibrary(me, { level: "B1", sort: "name" })).cards)).toEqual(["grammar", "words"]);
    expect(slugs((await listLibrary(me, { level: "B2" })).cards)).toEqual(["grammar"]);
    expect(slugs((await listLibrary(me, { level: "C1" })).cards)).toEqual(["reading"]);
    expect((await listLibrary(me, { level: "C2" })).cards).toHaveLength(0);

    const f = (await listLibrary(me, {})).facets;
    expect(f.publishers).toEqual(["Cambridge", "NGL", "Oxford"]);
    expect([...f.levels].sort()).toEqual(["A2-B1", "B1-B2", "C1"]);
    expect(f.focus).toEqual(["reading", "grammar", "vocabulary"]);
  });

  it("sắp xếp: phù hợp nhất đưa khoá đã lưu lên đầu; Tên A–Z; Mới nhất", async () => {
    const owner = await makeUser("l3o@e.com");
    const me = await makeUser("l3m@e.com");
    await libCourse(owner, "sort-b", { title: "B giáo trình", publishedAt: new Date("2026-03-01") });
    await libCourse(owner, "sort-a", { title: "A giáo trình", publishedAt: new Date("2026-01-01") });
    const c = await libCourse(owner, "sort-c", { title: "C giáo trình", publishedAt: new Date("2026-02-01") });
    expect(slugs((await listLibrary(me, { sort: "name" })).cards)).toEqual(["sort-a", "sort-b", "sort-c"]);
    expect(slugs((await listLibrary(me, { sort: "newest" })).cards)).toEqual(["sort-b", "sort-c", "sort-a"]);
    await saveLibraryCourse(me, c.courseId);
    expect(slugs((await listLibrary(me, {})).cards)).toEqual(["sort-c", "sort-b", "sort-a"]);
  });

  it("phân trang 12 khoá một trang, trang vượt quá bị kéo về trang cuối", async () => {
    const owner = await makeUser("l4o@e.com");
    const me = await makeUser("l4m@e.com");
    await prisma.course.createMany({
      data: Array.from({ length: 13 }, (_, i) => ({
        slug: `p${String(i).padStart(2, "0")}`,
        title: `Giáo trình ${String(i).padStart(2, "0")}`,
        description: "d",
        status: "published" as const,
        inLibrary: true,
        publishedAt: new Date(2026, 0, i + 1),
      })),
    });
    void owner;
    const p1 = await listLibrary(me, { sort: "name" });
    expect(LIBRARY_PAGE_SIZE).toBe(12);
    expect(p1.cards).toHaveLength(12);
    expect(p1.pageCount).toBe(2);
    expect(p1.matching).toBe(13);
    const p2 = await listLibrary(me, { sort: "name", page: "2" });
    expect(slugs(p2.cards)).toEqual(["p12"]);
    expect((await listLibrary(me, { sort: "name", page: "99" })).query.page).toBe(2);
  });
});

describe("Lưu / Bỏ lưu", () => {
  it("lưu idempotent, sự kiện chỉ ghi một lần và chỉ mang courseId; tab Đã lưu và số đếm đúng", async () => {
    const owner = await makeUser("s1o@e.com");
    const me = await makeUser("s1m@e.com");
    const { courseId } = await libCourse(owner, "sv1");
    await libCourse(owner, "sv2");
    await saveLibraryCourse(me, courseId);
    await saveLibraryCourse(me, courseId);
    expect(await prisma.courseSave.count({ where: { userId: me } })).toBe(1);
    const evs = await prisma.learningEvent.findMany({ where: { userId: me, eventType: LearningEventType.LibraryCourseSaved } });
    expect(evs).toHaveLength(1);
    expect(evs[0]!.payload).toEqual({ courseId });

    const saved = await listLibrary(me, { tab: "saved" });
    expect(slugs(saved.cards)).toEqual(["sv1"]);
    expect(saved.savedCount).toBe(1);
    expect(saved.totalAll).toBe(2);
    expect(saved.cards[0]!.saved).toBe(true);

    await unsaveLibraryCourse(me, courseId);
    await unsaveLibraryCourse(me, courseId);
    expect(await prisma.courseSave.count({ where: { userId: me } })).toBe(0);
    expect(await prisma.learningEvent.count({ where: { userId: me, eventType: LearningEventType.LibraryCourseUnsaved } })).toBe(1);
  });

  it("khoá ngoài thư viện (nháp, không bật, chỉ mời) → not_found và không tạo hàng", async () => {
    const owner = await makeUser("s2o@e.com");
    const me = await makeUser("s2m@e.com");
    for (const [slug, o] of [["d", { status: "draft" as const }], ["n", { inLibrary: false }], ["i", { enrollMode: "invite_only" as const }]] as const) {
      const { courseId } = await libCourse(owner, `sx-${slug}`, o);
      await expect(saveLibraryCourse(me, courseId)).rejects.toMatchObject({ code: "not_found" });
    }
    await expect(saveLibraryCourse(me, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "not_found" });
    expect(await prisma.courseSave.count()).toBe(0);
  });

  it("riêng tư: mục đã lưu của người này không hiện cho người khác; khoá rời thư viện thì không còn trong Đã lưu nhưng vẫn bỏ lưu được", async () => {
    const owner = await makeUser("s3o@e.com");
    const a = await makeUser("s3a@e.com");
    const b = await makeUser("s3b@e.com");
    const { courseId } = await libCourse(owner, "sp1");
    await saveLibraryCourse(a, courseId);
    expect((await listLibrary(b, { tab: "saved" })).cards).toHaveLength(0);
    expect((await listLibrary(b, {})).cards[0]!.saved).toBe(false);

    await updateCourseLibraryMeta(owner, courseId, { inLibrary: false });
    const after = await listLibrary(a, { tab: "saved" });
    expect(after.cards).toHaveLength(0);
    expect(after.savedCount).toBe(0);
    await unsaveLibraryCourse(a, courseId);
    expect(await prisma.courseSave.count({ where: { userId: a } })).toBe(0);
  });

  it("xoá tài khoản xoá luôn mục đã lưu (cascade)", async () => {
    const owner = await makeUser("s4o@e.com");
    const me = await makeUser("s4m@e.com");
    const { courseId } = await libCourse(owner, "sc1");
    await saveLibraryCourse(me, courseId);
    await prisma.user.delete({ where: { id: me } });
    expect(await prisma.courseSave.count({ where: { courseId } })).toBe(0);
  });

  it("sự kiện library.* không tính là hoạt động học", () => {
    for (const t of ["library.course.saved", "library.course.unsaved", "library.course.listed", "library.course.unlisted"]) {
      expect(isLearnerActivityType(t)).toBe(false);
    }
    expect(isLearnerActivityType("lesson.completed")).toBe(true);
  });
});

describe("Hành động trên thẻ: ghi danh, Preview, Đang học", () => {
  it("enrolled đúng luật isUserEnrolled: ghi danh còn hạn có; hết hạn, rút, hoàn tiền thì không", async () => {
    const owner = await makeUser("e1o@e.com");
    const me = await makeUser("e1m@e.com");
    const ok = await libCourse(owner, "en-ok");
    const expired = await libCourse(owner, "en-exp");
    const dropped = await libCourse(owner, "en-drop");
    const none = await libCourse(owner, "en-none");
    for (const c of [ok, expired, dropped]) await enrollInCourse(me, c.courseId);
    await prisma.enrollment.update({ where: { userId_courseId: { userId: me, courseId: expired.courseId } }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
    await prisma.enrollment.update({ where: { userId_courseId: { userId: me, courseId: dropped.courseId } }, data: { status: "dropped" } });
    void none;
    const page = await listLibrary(me, { sort: "name" });
    const flag = Object.fromEntries(page.cards.map((c) => [c.slug, c.enrolled]));
    expect(flag).toMatchObject({ "en-ok": true, "en-exp": false, "en-drop": false, "en-none": false });
  });

  it("Preview: chỉ bài xem thử đang hiển thị; không có thì null (ẩn nút)", async () => {
    const owner = await makeUser("p1o@e.com");
    const me = await makeUser("p1m@e.com");
    const withPreview = await libCourse(owner, "pv-yes", { lessons: [{}, { previewable: true }, { previewable: true }] });
    await libCourse(owner, "pv-none");
    await libCourse(owner, "pv-hidden", { lessons: [{ previewable: true, isHidden: true }] });
    const page = await listLibrary(me, {});
    const by = Object.fromEntries(page.cards.map((c) => [c.slug, c.previewLessonId]));
    expect(by["pv-yes"]).toBe(withPreview.lessonIds[1]);
    expect(by["pv-none"]).toBeNull();
    expect(by["pv-hidden"]).toBeNull();
  });

  it("học liệu bản quyền: Preview chỉ mở file của bài xem thử; đưa vào thư viện không mở thêm gì", async () => {
    const owner = await makeUser("p2o@e.com");
    const stranger = await makeUser("p2s@e.com");
    const c = await libCourse(owner, "pv-prot", { lessons: [{}, { previewable: true }] });
    const FREE = "u1-1790000000010-aaaa1111bbbb2222.pdf";
    const LOCKED = "u1-1790000000011-cccc3333dddd4444.pdf";
    await prisma.lesson.update({ where: { id: c.lessonIds[0]! }, data: { description: `<a href="/api/lesson-media/pdfs/${LOCKED}">x</a>` } });
    await prisma.lesson.update({ where: { id: c.lessonIds[1]! }, data: { description: `<a href="/api/lesson-media/pdfs/${FREE}">x</a>` } });
    await setCourseProtectedMedia(owner, c.courseId, true);
    for (const l of c.lessonIds) await registerLessonMedia(l);

    expect(await findProtectingCourseIds(FREE)).toEqual([]);
    expect(await findProtectingCourseIds(LOCKED)).toEqual([c.courseId]);
    expect((await prisma.course.findUnique({ where: { id: c.courseId } }))?.inLibrary).toBe(true);
    expect(await canAccessProtectedMedia(stranger, [c.courseId])).toBe(false);
    expect(await canAccessProtectedMedia(null, [c.courseId])).toBe(false);
    const card = (await listLibrary(stranger, {})).cards[0]!;
    expect(card.previewLessonId).toBe(c.lessonIds[1]);
  });

  it("Đang học: hiện khi không lọc, đúng Unit và tiến độ, và không lặp lại ở lưới", async () => {
    const owner = await makeUser("i1o@e.com");
    const me = await makeUser("i1m@e.com");
    const c = await libCourse(owner, "ip1", { lessons: [{}, {}, {}] });
    await libCourse(owner, "ip2");
    await enrollInCourse(me, c.courseId);
    await completeLesson(me, c.lessonIds[0]!);
    await prisma.enrollment.update({ where: { userId_courseId: { userId: me, courseId: c.courseId } }, data: { lastLessonId: c.lessonIds[1]! } });

    const page = await listLibrary(me, {});
    expect(page.inProgress).toMatchObject({ lessonId: c.lessonIds[1], unitTitle: "Unit 1", unitDone: 1, unitTotal: 3, completionPct: 33 });
    expect(page.inProgress!.card.slug).toBe("ip1");
    expect(page.inProgress!.card.enrolled).toBe(true);
    expect(slugs(page.cards)).toEqual(["ip2"]);
    expect(page.matching).toBe(2);

    // Có lọc / tab Đã lưu / trang 2: khối biến mất và khoá hiện ở lưới như thường.
    expect((await listLibrary(me, { q: "ip1" })).inProgress).toBeNull();
    expect(slugs((await listLibrary(me, { q: "ip1" })).cards)).toEqual(["ip1"]);
    expect((await listLibrary(me, { tab: "saved" })).inProgress).toBeNull();
  });

  it("Đang học: không hiện khi học hết, khi chưa mở bài nào, hoặc khi ghi danh hết hạn", async () => {
    const owner = await makeUser("i2o@e.com");
    const me = await makeUser("i2m@e.com");
    const done = await libCourse(owner, "ipd", { lessons: [{}] });
    const fresh = await libCourse(owner, "ipf", { lessons: [{}] });
    const exp = await libCourse(owner, "ipx", { lessons: [{}] });
    for (const c of [done, fresh, exp]) await enrollInCourse(me, c.courseId);
    await completeLesson(me, done.lessonIds[0]!);
    await prisma.enrollment.update({ where: { userId_courseId: { userId: me, courseId: done.courseId } }, data: { lastLessonId: done.lessonIds[0]! } });
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: me, courseId: exp.courseId } },
      data: { lastLessonId: exp.lessonIds[0]!, accessExpiresAt: new Date(Date.now() - 1000) },
    });
    expect((await listLibrary(me, {})).inProgress).toBeNull();
  });
});
