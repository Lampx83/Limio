import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  getOrCreatePortfolio,
  getPortfolioEditor,
  getPublicPortfolio,
  pinPortfolioCourse,
  pinPortfolioItem,
  PORTFOLIO_MAX_ITEMS_PER_GROUP,
  unpinPortfolioCourse,
  unpinPortfolioItem,
  updatePortfolioSettings,
} from "../index";
import { createAssignment, gradeSubmission, submitAssignment } from "../../courses/assignments";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { enrollInCourse } from "../../learning/enroll";
import { deleteUser } from "../../auth/deleteUser";
import { exportProfile } from "../../auth/profile";

const BASE = "http://localhost:3000";

async function user(name: string) {
  return registerUser(
    { email: `u-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
}

/** Cấp chứng nhận thẳng vào DB — bài kiểm tra tiến độ 100% đã có test riêng ở certification. */
async function certify(userId: string, courseId: string, title = "Thiết kế UI") {
  return prisma.certificate.create({
    data: {
      userId,
      courseId,
      certNumber: `LIM-T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      userNameSnapshot: "x",
      courseTitleSnapshot: title,
      issuerName: "Limio",
    },
  });
}

async function setup() {
  const inst = await user("Inst");
  const lr = await user("Nguyễn Văn An");
  const other = await user("Other");
  const c = await createCourse(inst.userId, { title: "Thiết kế UI", description: "x" });
  const m = await createModule(inst.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(inst.userId, m.moduleId, { title: "L", orderIndex: 0 });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
  await enrollInCourse(lr.userId, c.courseId);
  await enrollInCourse(other.userId, c.courseId);
  const a1 = await createAssignment(inst.userId, l.lessonId, { title: "Wireframe", description: "x", maxScore: 10 });
  const a2 = await createAssignment(inst.userId, l.lessonId, { title: "Prototype", description: "x", maxScore: 10 });
  const a3 = await createAssignment(inst.userId, l.lessonId, { title: "Kiểm thử", description: "x", maxScore: 10 });
  const s1 = await submitAssignment(lr.userId, a1.assignmentId, { body: "Bài wireframe" });
  const s2 = await submitAssignment(lr.userId, a2.assignmentId, { body: "Bài prototype" });
  const s3 = await submitAssignment(lr.userId, a3.assignmentId, { body: "Bài kiểm thử" });
  await gradeSubmission(inst.userId, s1.submissionId, { score: 9, feedback: "Tốt, nhưng thiếu lưới" });
  return {
    instId: inst.userId,
    learnerId: lr.userId,
    otherId: other.userId,
    courseId: c.courseId,
    a1: a1.assignmentId,
    graded: s1.submissionId,
    ungraded: s2.submissionId,
    third: s3.submissionId,
  };
}

async function events(userId: string, eventType: string) {
  return prisma.learningEvent.findMany({ where: { userId, eventType } });
}

describe("E-portfolio — A8", () => {
  it("tạo hồ sơ lười: riêng tư, slug từ tên + hậu tố ngẫu nhiên, gọi lại không tạo thêm", async () => {
    const s = await setup();
    const p1 = await getOrCreatePortfolio(s.learnerId);
    const p2 = await getOrCreatePortfolio(s.learnerId);
    expect(p1.id).toBe(p2.id);
    expect(p1.isPublic).toBe(false);
    expect(p1.slug).toMatch(/^nguyen-van-an-[0-9a-f]{6}$/);
  });

  it("trang soạn: khoá chưa hoàn thành → không có bài nào để ghim", async () => {
    const s = await setup();
    const { rows, courses } = await getPortfolioEditor(s.learnerId);
    expect(rows).toEqual([]);
    expect(courses).toEqual([]);
  });

  it("trang soạn: khoá đã hoàn thành liệt kê cả bài đã chấm lẫn chưa chấm, chỉ của chính học viên", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    const { rows, courses } = await getPortfolioEditor(s.learnerId);
    expect(rows.map((r) => r.submissionId).sort()).toEqual([s.graded, s.ungraded, s.third].sort());
    expect(rows.find((r) => r.submissionId === s.graded)).toMatchObject({
      groupTitle: "Thiết kế UI",
      status: "graded",
      score: 9,
      pinned: false,
    });
    expect(rows.find((r) => r.submissionId === s.ungraded)).toMatchObject({ status: "submitted", score: null });
    expect(courses).toEqual([expect.objectContaining({ courseId: s.courseId, pinned: false })]);
    expect((await getPortfolioEditor(s.otherId)).rows).toEqual([]);
  });

  it("ghim bài (đã chấm hay chưa) → phát portfolio.item.added; ghim lại chỉ sửa câu giới thiệu", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    expect(await pinPortfolioItem(s.learnerId, s.ungraded, "Bài em tâm đắc")).toEqual({ created: true });
    expect(await pinPortfolioItem(s.learnerId, s.ungraded, "Sửa lại")).toEqual({ created: false });
    const { rows } = await getPortfolioEditor(s.learnerId);
    expect(rows.find((r) => r.submissionId === s.ungraded)).toMatchObject({ pinned: true, note: "Sửa lại" });
    const added = await events(s.learnerId, LearningEventType.PortfolioItemAdded);
    expect(added).toHaveLength(1);
    expect(added[0]!.courseId).toBe(s.courseId);
    expect(await events(s.learnerId, LearningEventType.PortfolioItemUpdated)).toHaveLength(1);
  });

  it("không ghim được bài của khoá chưa hoàn thành hoặc bài của người khác", async () => {
    const s = await setup();
    await expect(pinPortfolioItem(s.learnerId, s.graded, null)).rejects.toMatchObject({
      code: "course_not_completed",
    });
    await certify(s.learnerId, s.courseId);
    await expect(pinPortfolioItem(s.otherId, s.graded, null)).rejects.toMatchObject({
      code: "submission_not_found",
    });
  });

  it(`mỗi khoá tối đa ${PORTFOLIO_MAX_ITEMS_PER_GROUP} bài: bài thứ ba bị từ chối, bỏ một bài thì ghim lại được`, async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, null);
    await pinPortfolioItem(s.learnerId, s.ungraded, null);
    await expect(pinPortfolioItem(s.learnerId, s.third, null)).rejects.toMatchObject({ code: "group_full" });
    // Sửa câu giới thiệu của bài đã ghim không bị trần chặn.
    await expect(pinPortfolioItem(s.learnerId, s.graded, "vẫn sửa được")).resolves.toEqual({ created: false });
    await unpinPortfolioItem(s.learnerId, s.graded);
    await expect(pinPortfolioItem(s.learnerId, s.third, null)).resolves.toEqual({ created: true });
  });

  it("ghim đồng thời không vượt trần", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    const results = await Promise.allSettled([
      pinPortfolioItem(s.learnerId, s.graded, null),
      pinPortfolioItem(s.learnerId, s.ungraded, null),
      pinPortfolioItem(s.learnerId, s.third, null),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(PORTFOLIO_MAX_ITEMS_PER_GROUP);
    const p = await getOrCreatePortfolio(s.learnerId);
    expect(await prisma.portfolioItem.count({ where: { portfolioId: p.id } })).toBe(PORTFOLIO_MAX_ITEMS_PER_GROUP);
  });

  it("bỏ ghim phát portfolio.item.removed; bỏ ghim lần nữa không làm gì", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, null);
    expect(await unpinPortfolioItem(s.learnerId, s.graded)).toEqual({ removed: true });
    expect(await unpinPortfolioItem(s.learnerId, s.graded)).toEqual({ removed: false });
    expect(await events(s.learnerId, LearningEventType.PortfolioItemRemoved)).toHaveLength(1);
  });

  it("khoe khoá cần chứng nhận; khoe/thôi khoe idempotent và phát event", async () => {
    const s = await setup();
    await expect(pinPortfolioCourse(s.learnerId, s.courseId)).rejects.toMatchObject({ code: "course_not_completed" });
    await certify(s.learnerId, s.courseId);
    expect(await pinPortfolioCourse(s.learnerId, s.courseId)).toEqual({ created: true });
    expect(await pinPortfolioCourse(s.learnerId, s.courseId)).toEqual({ created: false });
    expect((await getPortfolioEditor(s.learnerId)).courses[0]).toMatchObject({ pinned: true });
    expect(await unpinPortfolioCourse(s.learnerId, s.courseId)).toEqual({ removed: true });
    expect(await unpinPortfolioCourse(s.learnerId, s.courseId)).toEqual({ removed: false });
    expect(await events(s.learnerId, LearningEventType.PortfolioCourseAdded)).toHaveLength(1);
    expect(await events(s.learnerId, LearningEventType.PortfolioCourseRemoved)).toHaveLength(1);
  });

  it("hồ sơ riêng tư → trang công khai trả null; bật công khai → hiện, phát event 1 lần", async () => {
    const s = await setup();
    const cert = await certify(s.learnerId, s.courseId);
    await pinPortfolioCourse(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, "Bài em tâm đắc");
    const p = await getOrCreatePortfolio(s.learnerId);
    expect(await getPublicPortfolio(p.slug)).toBeNull();

    await updatePortfolioSettings(s.learnerId, { isPublic: true, headline: "SV CNGD", about: "Mình thích UX" });
    await updatePortfolioSettings(s.learnerId, { isPublic: true });
    expect(await events(s.learnerId, LearningEventType.PortfolioVisibilityChanged)).toHaveLength(1);

    const pub = await getPublicPortfolio(p.slug);
    expect(pub).toMatchObject({
      displayName: "Nguyễn Văn An",
      headline: "SV CNGD",
      about: "Mình thích UX",
      workCount: 1,
    });
    expect(pub!.groups).toHaveLength(1);
    expect(pub!.groups[0]).toMatchObject({
      title: "Thiết kế UI",
      certificate: { certNumber: cert.certNumber },
    });
    expect(pub!.groups[0]!.items[0]).toMatchObject({ title: "Wireframe", note: "Bài em tâm đắc" });
    expect(pub!.groups[0]!.items[0]!.gradedAt).not.toBeNull();
  });

  it("bài của khoá không được khoe thì ẩn; thôi khoe khoá giữ bài nhưng ẩn", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    expect((await getPublicPortfolio(p.slug))).toMatchObject({ groups: [], workCount: 0 });

    await pinPortfolioCourse(s.learnerId, s.courseId);
    expect((await getPublicPortfolio(p.slug))!.workCount).toBe(1);

    await unpinPortfolioCourse(s.learnerId, s.courseId);
    expect((await getPublicPortfolio(p.slug))).toMatchObject({ groups: [], workCount: 0 });
    expect((await getPortfolioEditor(s.learnerId)).rows.find((r) => r.submissionId === s.graded)!.pinned).toBe(true);
  });

  it("khoá được khoe mà chưa ghim bài nào vẫn hiện, kèm chứng nhận", async () => {
    const s = await setup();
    const cert = await certify(s.learnerId, s.courseId);
    await pinPortfolioCourse(s.learnerId, s.courseId);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    const pub = await getPublicPortfolio(p.slug);
    expect(pub!.groups).toEqual([
      expect.objectContaining({ items: [], certificate: expect.objectContaining({ certNumber: cert.certNumber }) }),
    ]);
  });

  it("trang công khai không lộ điểm, nhận xét GV hay email", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await pinPortfolioCourse(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    const json = JSON.stringify(await getPublicPortfolio(p.slug));
    expect(json).not.toContain("thiếu lưới");
    expect(json).not.toContain("@e.com");
    expect(json).not.toMatch(/"score"|"maxScore"|"feedback"/);
  });

  it("bài đã ghim được nộp lại: vẫn hiện, nội dung mới nhất, nhãn đã chấm biến mất tới khi chấm lại", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await pinPortfolioCourse(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    await submitAssignment(s.learnerId, s.a1, { body: "Bản sửa" });
    let item = (await getPublicPortfolio(p.slug))!.groups[0]!.items[0]!;
    expect(item.body).toBe("Bản sửa");
    expect(item.gradedAt).toBeNull();
    await gradeSubmission(s.instId, s.graded, { score: 10 });
    item = (await getPublicPortfolio(p.slug))!.groups[0]!.items[0]!;
    expect(item.gradedAt).not.toBeNull();
  });

  it("đổi slug: kiểm tra định dạng và trùng", async () => {
    const s = await setup();
    await updatePortfolioSettings(s.otherId, { slug: "an-nguyen" });
    await expect(updatePortfolioSettings(s.learnerId, { slug: "an-nguyen" })).rejects.toMatchObject({
      code: "slug_taken",
    });
    for (const bad of ["ab", "Có dấu", "-abc", "abc-", "a--b", "x".repeat(41)]) {
      await expect(updatePortfolioSettings(s.learnerId, { slug: bad })).rejects.toMatchObject({
        code: expect.stringMatching(/slug_invalid|validation_failed/),
      });
    }
    const p = await updatePortfolioSettings(s.learnerId, { slug: "AN-van-2026" });
    expect(p.slug).toBe("an-van-2026");
  });

  it("đoạn giới thiệu quá 500 ký tự bị từ chối", async () => {
    const s = await setup();
    await expect(updatePortfolioSettings(s.learnerId, { about: "x".repeat(501) })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("câu giới thiệu quá 500 ký tự bị từ chối", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await expect(pinPortfolioItem(s.learnerId, s.graded, "x".repeat(501))).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("hồ sơ có trong file xuất dữ liệu cá nhân", async () => {
    const s = await setup();
    const cert = await certify(s.learnerId, s.courseId);
    await pinPortfolioCourse(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, "ghi chú");
    await updatePortfolioSettings(s.learnerId, { about: "Giới thiệu" });
    const data = await exportProfile(s.learnerId);
    expect(data.portfolio?.about).toBe("Giới thiệu");
    expect(data.portfolio?.items).toEqual([expect.objectContaining({ submissionId: s.graded, note: "ghi chú" })]);
    expect(data.portfolio?.courses).toEqual([expect.objectContaining({ certificateId: cert.id })]);
  });

  it("xoá tài khoản (ẩn danh hoá) xoá luôn hồ sơ → link công khai chết", async () => {
    const s = await setup();
    await certify(s.learnerId, s.courseId);
    await pinPortfolioCourse(s.learnerId, s.courseId);
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    const admin = await user("Admin");
    await deleteUser(admin.userId, s.learnerId);
    expect(await getPublicPortfolio(p.slug)).toBeNull();
    expect(await prisma.portfolioItem.count({ where: { portfolioId: p.id } })).toBe(0);
    expect(await prisma.portfolioCourse.count({ where: { portfolioId: p.id } })).toBe(0);
  });
});
