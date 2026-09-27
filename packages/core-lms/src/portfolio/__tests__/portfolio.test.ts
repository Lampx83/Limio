import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  getOrCreatePortfolio,
  getPortfolioEditor,
  getPublicPortfolio,
  pinPortfolioItem,
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
  const s1 = await submitAssignment(lr.userId, a1.assignmentId, { body: "Bài wireframe" });
  const s2 = await submitAssignment(lr.userId, a2.assignmentId, { body: "Bài prototype" });
  await gradeSubmission(inst.userId, s1.submissionId, { score: 9, feedback: "Tốt, nhưng thiếu lưới" });
  return {
    instId: inst.userId,
    learnerId: lr.userId,
    otherId: other.userId,
    courseId: c.courseId,
    a1: a1.assignmentId,
    graded: s1.submissionId,
    ungraded: s2.submissionId,
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

  it("trang soạn chỉ liệt kê bài đã chấm của chính học viên", async () => {
    const s = await setup();
    const { rows } = await getPortfolioEditor(s.learnerId);
    expect(rows.map((r) => r.submissionId)).toEqual([s.graded]);
    expect(rows[0]).toMatchObject({ groupTitle: "Thiết kế UI", score: 9, pinned: false });
  });

  it("ghim bài đã chấm → phát portfolio.item.added; ghim lại chỉ sửa câu giới thiệu", async () => {
    const s = await setup();
    expect(await pinPortfolioItem(s.learnerId, s.graded, "Bài em tâm đắc")).toEqual({ created: true });
    expect(await pinPortfolioItem(s.learnerId, s.graded, "Sửa lại")).toEqual({ created: false });
    const { rows } = await getPortfolioEditor(s.learnerId);
    expect(rows[0]).toMatchObject({ pinned: true, note: "Sửa lại" });
    const added = await events(s.learnerId, LearningEventType.PortfolioItemAdded);
    expect(added).toHaveLength(1);
    expect(added[0]!.courseId).toBe(s.courseId);
    expect(await events(s.learnerId, LearningEventType.PortfolioItemUpdated)).toHaveLength(1);
  });

  it("không ghim được bài chưa chấm hoặc bài của người khác", async () => {
    const s = await setup();
    await expect(pinPortfolioItem(s.learnerId, s.ungraded, null)).rejects.toMatchObject({ code: "not_graded" });
    await expect(pinPortfolioItem(s.otherId, s.graded, null)).rejects.toMatchObject({
      code: "submission_not_found",
    });
  });

  it("bỏ ghim phát portfolio.item.removed; bỏ ghim lần nữa không làm gì", async () => {
    const s = await setup();
    await pinPortfolioItem(s.learnerId, s.graded, null);
    expect(await unpinPortfolioItem(s.learnerId, s.graded)).toEqual({ removed: true });
    expect(await unpinPortfolioItem(s.learnerId, s.graded)).toEqual({ removed: false });
    expect(await events(s.learnerId, LearningEventType.PortfolioItemRemoved)).toHaveLength(1);
  });

  it("hồ sơ riêng tư → trang công khai trả null; bật công khai → hiện, phát event 1 lần", async () => {
    const s = await setup();
    await pinPortfolioItem(s.learnerId, s.graded, "Bài em tâm đắc");
    const p = await getOrCreatePortfolio(s.learnerId);
    expect(await getPublicPortfolio(p.slug)).toBeNull();

    await updatePortfolioSettings(s.learnerId, { isPublic: true, headline: "SV CNGD" });
    await updatePortfolioSettings(s.learnerId, { isPublic: true });
    expect(await events(s.learnerId, LearningEventType.PortfolioVisibilityChanged)).toHaveLength(1);

    const pub = await getPublicPortfolio(p.slug);
    expect(pub).toMatchObject({ displayName: "Nguyễn Văn An", headline: "SV CNGD" });
    expect(pub!.groups).toHaveLength(1);
    expect(pub!.groups[0]!.items[0]).toMatchObject({ title: "Wireframe", note: "Bài em tâm đắc" });
  });

  it("trang công khai không lộ điểm, nhận xét GV hay email", async () => {
    const s = await setup();
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    const json = JSON.stringify(await getPublicPortfolio(p.slug));
    expect(json).not.toContain("thiếu lưới");
    expect(json).not.toContain("@e.com");
    expect(json).not.toMatch(/"score"|"maxScore"|"feedback"/);
  });

  it("nộp lại bài đã ghim → tạm ẩn khỏi trang công khai tới khi GV chấm lại", async () => {
    const s = await setup();
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    await submitAssignment(s.learnerId, s.a1, { body: "Bản sửa" });
    expect((await getPublicPortfolio(p.slug))!.groups).toHaveLength(0);
    await gradeSubmission(s.instId, s.graded, { score: 10 });
    const pub = await getPublicPortfolio(p.slug);
    expect(pub!.groups[0]!.items[0]!.body).toBe("Bản sửa");
  });

  it("hiện khoá đã hoàn thành", async () => {
    const s = await setup();
    await prisma.enrollment.updateMany({
      where: { userId: s.learnerId },
      data: { status: "completed", completedAt: new Date() },
    });
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    expect((await getPublicPortfolio(p.slug))!.completedCourses.map((c) => c.title)).toEqual(["Thiết kế UI"]);
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

  it("câu giới thiệu quá 500 ký tự bị từ chối", async () => {
    const s = await setup();
    await expect(pinPortfolioItem(s.learnerId, s.graded, "x".repeat(501))).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("hồ sơ có trong file xuất dữ liệu cá nhân", async () => {
    const s = await setup();
    await pinPortfolioItem(s.learnerId, s.graded, "ghi chú");
    const data = await exportProfile(s.learnerId);
    expect(data.portfolio?.items).toEqual([expect.objectContaining({ submissionId: s.graded, note: "ghi chú" })]);
  });

  it("xoá tài khoản (ẩn danh hoá) xoá luôn hồ sơ → link công khai chết", async () => {
    const s = await setup();
    await pinPortfolioItem(s.learnerId, s.graded, null);
    const p = await updatePortfolioSettings(s.learnerId, { isPublic: true });
    const admin = await user("Admin");
    await deleteUser(admin.userId, s.learnerId);
    expect(await getPublicPortfolio(p.slug)).toBeNull();
    expect(await prisma.portfolioItem.count({ where: { portfolioId: p.id } })).toBe(0);
  });
});
