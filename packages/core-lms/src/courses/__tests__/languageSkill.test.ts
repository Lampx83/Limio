import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  LANGUAGE_SKILLS,
  LANGUAGE_SKILL_LABEL,
  isLanguageSkill,
  lessonSkillCode,
} from "@feedbackme/shared-types";
import { createCourse, updateCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson, updateLesson } from "../lessons";
import { backfillCourseTags } from "../autoTags";
import { registerUser } from "../../auth/register";

/**
 * LANG G3 / G3.1 — nhãn kỹ năng ngôn ngữ của bài (Lesson.languageSkill) và bản
 * sao của nó trên Skill tự sinh (Skill.languageSkill), cùng bất biến
 * "chế độ ngoại ngữ cần cá nhân hoá".
 */

const BASE = "http://localhost:3000";

async function owner() {
  return registerUser(
    { email: `ls${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "O" },
    BASE,
  );
}
async function setup(opts: { personalization?: boolean } = {}) {
  const r = await owner();
  const c = await createCourse(r.userId, {
    title: "Ngoại ngữ",
    description: "x",
    personalizationEnabled: opts.personalization ?? true,
  });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  return { userId: r.userId, courseId: c.courseId, moduleId: m.moduleId };
}
const skillOf = (lessonId: string) => prisma.skill.findUnique({ where: { code: lessonSkillCode(lessonId) } });

describe("hằng số kỹ năng ngôn ngữ (shared-types)", () => {
  it("đúng bốn kỹ năng theo thứ tự Nghe, Nói, Đọc, Viết, có nhãn tiếng Việt", () => {
    expect([...LANGUAGE_SKILLS]).toEqual(["listening", "speaking", "reading", "writing"]);
    expect(LANGUAGE_SKILL_LABEL).toEqual({ listening: "Nghe", speaking: "Nói", reading: "Đọc", writing: "Viết" });
  });
  it("isLanguageSkill chỉ nhận bốn giá trị", () => {
    for (const ok of LANGUAGE_SKILLS) expect(isLanguageSkill(ok)).toBe(true);
    for (const bad of ["vocabulary", "", "Listening", null, undefined, 3]) expect(isLanguageSkill(bad)).toBe(false);
  });
});

describe("G3.1.1 — mặc định không đổi hành vi", () => {
  it("khoá mới languageMode=false; bài mới languageSkill=null; Skill tự sinh languageSkill=null", async () => {
    const { userId, courseId, moduleId } = await setup();
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(course.languageMode).toBe(false);
    const l = await createLesson(userId, moduleId, { title: "L", orderIndex: 0 });
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.lessonId } })).languageSkill).toBeNull();
    expect((await skillOf(l.lessonId))!.languageSkill).toBeNull();
  });
});

describe("G3.1.2 — đồng bộ nhãn từ bài sang Skill tự sinh", () => {
  it("tạo bài kèm kỹ năng → Skill nhận kỹ năng đó", async () => {
    const { userId, moduleId } = await setup();
    const l = await createLesson(userId, moduleId, { title: "Nghe bài 5", orderIndex: 0, languageSkill: "listening" });
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.lessonId } })).languageSkill).toBe("listening");
    expect((await skillOf(l.lessonId))!.languageSkill).toBe("listening");
  });

  it("đổi và bỏ nhãn → Skill đổi theo; id của Skill không đổi (giữ LearnerSkillState)", async () => {
    const { userId, moduleId } = await setup();
    const l = await createLesson(userId, moduleId, { title: "L", orderIndex: 0, languageSkill: "listening" });
    const before = (await skillOf(l.lessonId))!;

    await updateLesson(userId, l.lessonId, { languageSkill: "reading" });
    const mid = (await skillOf(l.lessonId))!;
    expect(mid.languageSkill).toBe("reading");
    expect(mid.id).toBe(before.id);

    await updateLesson(userId, l.lessonId, { languageSkill: null });
    const after = (await skillOf(l.lessonId))!;
    expect(after.languageSkill).toBeNull();
    expect(after.id).toBe(before.id);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.lessonId } })).languageSkill).toBeNull();
  });

  it("sửa trường khác của bài không làm mất nhãn kỹ năng", async () => {
    const { userId, moduleId } = await setup();
    const l = await createLesson(userId, moduleId, { title: "L", orderIndex: 0, languageSkill: "writing" });
    await updateLesson(userId, l.lessonId, { title: "Đổi tên" });
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.lessonId } })).languageSkill).toBe("writing");
    expect((await skillOf(l.lessonId))!.languageSkill).toBe("writing");
  });
});

describe("G3.1.3 — khoá không cá nhân hoá không sinh dòng rác", () => {
  it("nhãn vẫn lưu trên bài nhưng không có Skill nào", async () => {
    const { userId, moduleId } = await setup({ personalization: false });
    const before = await prisma.skill.count();
    const l = await createLesson(userId, moduleId, { title: "L", orderIndex: 0, languageSkill: "speaking" });
    await updateLesson(userId, l.lessonId, { languageSkill: "reading" });
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.lessonId } })).languageSkill).toBe("reading");
    expect(await skillOf(l.lessonId)).toBeNull();
    expect(await prisma.skill.count()).toBe(before);
  });
});

describe("G3.1.4 — bật cá nhân hoá / backfill điền nhãn cho bài đã gán, idempotent", () => {
  it("bật cá nhân hoá trên khoá đã có bài mang nhãn → Skill được tạo kèm nhãn", async () => {
    const { userId, courseId, moduleId } = await setup({ personalization: false });
    const a = await createLesson(userId, moduleId, { title: "A", orderIndex: 0, languageSkill: "listening" });
    const b = await createLesson(userId, moduleId, { title: "B", orderIndex: 1 });
    await updateCourse(userId, courseId, { personalizationEnabled: true });
    expect((await skillOf(a.lessonId))!.languageSkill).toBe("listening");
    expect((await skillOf(b.lessonId))!.languageSkill).toBeNull();
  });

  it("backfill chạy lại không đổi gì; sửa nhãn rồi backfill thì Skill khớp lại với bài", async () => {
    const { userId, courseId, moduleId } = await setup();
    const a = await createLesson(userId, moduleId, { title: "A", orderIndex: 0, languageSkill: "reading" });
    const skills = await prisma.skill.count();
    await backfillCourseTags(courseId, { force: true });
    await backfillCourseTags(courseId, { force: true });
    expect(await prisma.skill.count()).toBe(skills);
    expect((await skillOf(a.lessonId))!.languageSkill).toBe("reading");

    // Lệch tay (vd dữ liệu cũ): backfill kéo Skill về đúng nhãn của bài.
    await prisma.skill.update({ where: { code: lessonSkillCode(a.lessonId) }, data: { languageSkill: null } });
    await backfillCourseTags(courseId, { force: true });
    expect((await skillOf(a.lessonId))!.languageSkill).toBe("reading");
  });
});

describe("G3.1.5 — Skill giảng viên tự tạo không bị đụng tới", () => {
  it("đổi nhãn bài không đổi languageSkill của Skill tay gắn vào cùng bài", async () => {
    const { userId, moduleId } = await setup();
    const l = await createLesson(userId, moduleId, { title: "L", orderIndex: 0 });
    const hand = await prisma.skill.create({ data: { code: `zh.tay.${Date.now()}`, name: "Tự tạo" } });
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: l.lessonId, skillId: hand.id, coverageWeight: 1 },
    });
    await updateLesson(userId, l.lessonId, { languageSkill: "listening" });
    expect((await prisma.skill.findUniqueOrThrow({ where: { id: hand.id } })).languageSkill).toBeNull();
    expect((await skillOf(l.lessonId))!.languageSkill).toBe("listening");
  });
});

describe("G3.1.6 — giá trị ngoài bốn kỹ năng bị từ chối", () => {
  it("tạo và sửa bài", async () => {
    const { userId, moduleId } = await setup();
    // Đối chứng: giá trị hợp lệ qua được.
    const ok = await createLesson(userId, moduleId, { title: "OK", orderIndex: 0, languageSkill: "writing" });
    await expect(
      createLesson(userId, moduleId, { title: "X", orderIndex: 1, languageSkill: "vocabulary" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(updateLesson(userId, ok.lessonId, { languageSkill: "Nghe" })).rejects.toMatchObject({
      code: "validation_failed",
    });
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: ok.lessonId } })).languageSkill).toBe("writing");
  });
});

describe("G3.1.7 — chế độ ngoại ngữ cần cá nhân hoá", () => {
  it("bật languageMode khi cá nhân hoá tắt → bị từ chối, giữ nguyên", async () => {
    const { userId, courseId } = await setup({ personalization: false });
    await expect(updateCourse(userId, courseId, { languageMode: true })).rejects.toMatchObject({
      code: "language_mode_requires_personalization",
    });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).languageMode).toBe(false);
  });

  it("bật cả hai trong một lần lưu thì được", async () => {
    const { userId, courseId } = await setup({ personalization: false });
    await updateCourse(userId, courseId, { personalizationEnabled: true, languageMode: true });
    const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(c.languageMode).toBe(true);
    expect(c.personalizationEnabled).toBe(true);
  });

  it("tắt cá nhân hoá khi đang ở chế độ ngoại ngữ → bị từ chối; tắt chế độ ngoại ngữ trước thì được", async () => {
    const { userId, courseId } = await setup();
    await updateCourse(userId, courseId, { languageMode: true });
    await expect(updateCourse(userId, courseId, { personalizationEnabled: false })).rejects.toMatchObject({
      code: "language_mode_requires_personalization",
    });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).personalizationEnabled).toBe(true);
    await updateCourse(userId, courseId, { languageMode: false });
    await updateCourse(userId, courseId, { personalizationEnabled: false });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).personalizationEnabled).toBe(false);
  });

  it("tạo khoá languageMode=true mà personalization=false bị từ chối; hai cờ cùng bật thì được", async () => {
    const r = await owner();
    await expect(
      createCourse(r.userId, { title: "X", description: "x", personalizationEnabled: false, languageMode: true }),
    ).rejects.toMatchObject({ code: "language_mode_requires_personalization" });
    const c = await createCourse(r.userId, { title: "Y", description: "x", languageMode: true });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: c.courseId } })).languageMode).toBe(true);
  });

  it("đổi cờ chế độ ngoại ngữ được ghi vào nhật ký như các cờ quan trọng khác", async () => {
    const { userId, courseId } = await setup();
    await updateCourse(userId, courseId, { languageMode: true });
    const rows = await prisma.auditLog.findMany({ where: { action: "course.language_mode.toggled" } });
    expect(rows.some((r) => (r.payload as { courseId?: string })?.courseId === courseId)).toBe(true);
    // Lưu lại không đổi gì thì không phải sự kiện.
    const n = rows.length;
    await updateCourse(userId, courseId, { languageMode: true });
    expect(await prisma.auditLog.count({ where: { action: "course.language_mode.toggled" } })).toBe(n);
  });
});
