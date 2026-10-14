import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  createCourseSection,
  deleteCourseSection,
  getSectionRoster,
  listCourseSections,
  regenerateInviteCode,
  transferEnrollmentSection,
  updateCourseSection,
} from "../sections";
import {
  generateSectionImportTemplateXlsx,
  importCourseSections,
  parseSectionImportSheet,
  previewSectionImport,
  SectionImportError,
} from "../sectionImport";
import * as XLSX from "xlsx";
import { createCourse, CourseError, publishCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createSkill, tagLessonSkill } from "../skills";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { enrollInCourse } from "../../learning/enroll";
import { completeLesson } from "../../learning/lessons";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function publishedCourse(ownerId: string, slug: string) {
  const c = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  const m = await createModule(ownerId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
  const s = await createSkill({ code: `skill.${slug}`, name: "s" });
  await tagLessonSkill(ownerId, l.lessonId, { skillId: s.skillId });
  await publishCourse(ownerId, c.courseId);
  return c.courseId;
}

describe("createCourseSection / listCourseSections", () => {
  it("creates a section with a unique global invite code, not marked default", async () => {
    const ownerId = await makeUser("sec-o1@e.com");
    const courseId = await publishedCourse(ownerId, "sec1");

    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    expect(section.isDefault).toBe(false);
    expect(section.inviteCode).toBeTruthy();
    expect(section.enrolledCount).toBe(0);

    const list = await listCourseSections(ownerId, courseId);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(section.id);
  });

  it("rejects duplicate section name within the same course", async () => {
    const ownerId = await makeUser("sec-o2@e.com");
    const courseId = await publishedCourse(ownerId, "sec2");
    await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    await expect(
      createCourseSection(ownerId, courseId, { name: "Lớp A" }),
    ).rejects.toMatchObject({ code: "section_name_taken" });
  });

  it("excludes the auto-created default section from the list", async () => {
    const ownerId = await makeUser("sec-o3@e.com");
    const courseId = await publishedCourse(ownerId, "sec3");
    const learnerId = await makeUser("sec-l3@e.com");
    // Direct enroll (no sectionId) lazily creates + assigns the default section.
    await enrollInCourse(learnerId, courseId);

    const list = await listCourseSections(ownerId, courseId);
    expect(list).toHaveLength(0);

    const defaultSection = await prisma.courseSection.findFirst({
      where: { courseId, isDefault: true },
    });
    expect(defaultSection).not.toBeNull();
  });
});

describe("updateCourseSection", () => {
  it("renames a section", async () => {
    const ownerId = await makeUser("sec-o4@e.com");
    const courseId = await publishedCourse(ownerId, "sec4");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });

    await updateCourseSection(ownerId, section.id, { name: "Lớp A (đổi tên)" });
    const list = await listCourseSections(ownerId, courseId);
    expect(list[0]!.name).toBe("Lớp A (đổi tên)");
  });

  it("đổi điều kiện phản hồi: giảng viên thường bị chặn, researcher được; gửi lại giá trị cũ thì không bị chặn", async () => {
    const ownerId = await makeUser("sec-o4b@e.com");
    const adminId = await makeUser("sec-adm4b@e.com");
    const courseId = await publishedCourse(ownerId, "sec4b");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp B" });

    await expect(
      updateCourseSection(ownerId, section.id, { feedbackVariant: "minimal" }),
    ).rejects.toMatchObject({ code: "researcher_only" });

    // Không đổi giá trị thật → không cần quyền researcher.
    await updateCourseSection(ownerId, section.id, {
      name: "Lớp B2",
      feedbackVariant: "personalized",
    });

    await grantRole(adminId, { targetUserId: ownerId, roleName: "researcher" });
    await updateCourseSection(ownerId, section.id, { feedbackVariant: "minimal" });
    const list = await listCourseSections(ownerId, courseId);
    expect(list[0]!.feedbackVariant).toBe("minimal");
  });
});

describe("deleteCourseSection", () => {
  it("deletes an empty section", async () => {
    const ownerId = await makeUser("sec-o5@e.com");
    const courseId = await publishedCourse(ownerId, "sec5");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });

    await deleteCourseSection(ownerId, section.id);
    const list = await listCourseSections(ownerId, courseId);
    expect(list).toHaveLength(0);
  });

  it("rejects deleting a section with active enrollments", async () => {
    const ownerId = await makeUser("sec-o6@e.com");
    const courseId = await publishedCourse(ownerId, "sec6");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const learnerId = await makeUser("sec-l6@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: section.id });

    await expect(deleteCourseSection(ownerId, section.id)).rejects.toMatchObject({
      code: "section_has_enrollments",
    });
  });
});

describe("regenerateInviteCode", () => {
  it("rotates the invite code — old code stops resolving", async () => {
    const ownerId = await makeUser("sec-o7@e.com");
    const courseId = await publishedCourse(ownerId, "sec7");
    const section = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const oldCode = section.inviteCode!;

    const { inviteCode: newCode } = await regenerateInviteCode(ownerId, section.id);
    expect(newCode).not.toBe(oldCode);

    const byOldCode = await prisma.courseSection.findUnique({ where: { inviteCode: oldCode } });
    expect(byOldCode).toBeNull();
    const byNewCode = await prisma.courseSection.findUnique({ where: { inviteCode: newCode } });
    expect(byNewCode?.id).toBe(section.id);
  });
});

describe("section authz", () => {
  it("non-instructor cannot create a section", async () => {
    const ownerId = await makeUser("sec-o8@e.com");
    const courseId = await publishedCourse(ownerId, "sec8");
    const strangerId = await makeUser("sec-s8@e.com");
    await expect(
      createCourseSection(strangerId, courseId, { name: "Lớp A" }),
    ).rejects.toThrow();
  });

  it("cannot update/delete the auto-created default section", async () => {
    const ownerId = await makeUser("sec-o9@e.com");
    const courseId = await publishedCourse(ownerId, "sec9");
    const learnerId = await makeUser("sec-l9@e.com");
    await enrollInCourse(learnerId, courseId);
    const defaultSection = await prisma.courseSection.findFirstOrThrow({
      where: { courseId, isDefault: true },
    });

    await expect(
      updateCourseSection(ownerId, defaultSection.id, { name: "x" }),
    ).rejects.toMatchObject({ code: "section_not_found" } satisfies Partial<CourseError>);
    await expect(deleteCourseSection(ownerId, defaultSection.id)).rejects.toMatchObject({
      code: "section_not_found",
    });
  });
});

describe("getSectionRoster", () => {
  it("lists enrolled learners with progress %, latest quiz score, and other sections", async () => {
    const ownerId = await makeUser("ros-o1@e.com");
    const courseId = await publishedCourse(ownerId, "ros1");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secB = await createCourseSection(ownerId, courseId, { name: "Lớp B" });

    const learnerId = await makeUser("ros-l1@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });

    const lesson = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId } } });
    await completeLesson(learnerId, lesson.id);

    const quiz = await prisma.quiz.create({ data: { courseId, title: "Q" } });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: learnerId,
        status: "submitted",
        submittedAt: new Date(),
        scorePct: 80,
        passed: true,
      },
    });

    const roster = await getSectionRoster(ownerId, secA.id);
    expect(roster.section.id).toBe(secA.id);
    expect(roster.otherSections).toEqual([{ id: secB.id, name: "Lớp B" }]);
    expect(roster.entries).toHaveLength(1);
    const entry = roster.entries[0]!;
    expect(entry.user.id).toBe(learnerId);
    expect(entry.completedLessons).toBe(1);
    expect(entry.totalLessons).toBe(1);
    expect(entry.courseCompletionPct).toBe(100);
    expect(entry.latestQuizScorePct).toBe(80);
  });

  it("returns empty entries for a section with no learners", async () => {
    const ownerId = await makeUser("ros-o2@e.com");
    const courseId = await publishedCourse(ownerId, "ros2");
    const sec = await createCourseSection(ownerId, courseId, { name: "Lớp A" });

    const roster = await getSectionRoster(ownerId, sec.id);
    expect(roster.entries).toHaveLength(0);
  });

  it("non-instructor cannot view roster", async () => {
    const ownerId = await makeUser("ros-o3@e.com");
    const courseId = await publishedCourse(ownerId, "ros3");
    const sec = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const strangerId = await makeUser("ros-s3@e.com");

    await expect(getSectionRoster(strangerId, sec.id)).rejects.toThrow();
  });
});

describe("transferEnrollmentSection", () => {
  it("moves an enrollment to a different section of the same course", async () => {
    const ownerId = await makeUser("tr-o1@e.com");
    const courseId = await publishedCourse(ownerId, "tr1");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secB = await createCourseSection(ownerId, courseId, { name: "Lớp B" });
    const learnerId = await makeUser("tr-l1@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });

    await transferEnrollmentSection(ownerId, enrollment.id, secB.id);

    const updated = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(updated.sectionId).toBe(secB.id);

    const rosterA = await getSectionRoster(ownerId, secA.id);
    const rosterB = await getSectionRoster(ownerId, secB.id);
    expect(rosterA.entries).toHaveLength(0);
    expect(rosterB.entries).toHaveLength(1);
  });

  it("rejects moving to a section from a different course", async () => {
    const ownerId = await makeUser("tr-o2@e.com");
    const courseId = await publishedCourse(ownerId, "tr2");
    const otherCourseId = await publishedCourse(ownerId, "tr2b");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secOther = await createCourseSection(ownerId, otherCourseId, { name: "Lớp X" });
    const learnerId = await makeUser("tr-l2@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });

    await expect(
      transferEnrollmentSection(ownerId, enrollment.id, secOther.id),
    ).rejects.toMatchObject({ code: "section_not_found" } satisfies Partial<CourseError>);
  });

  it("non-instructor cannot transfer", async () => {
    const ownerId = await makeUser("tr-o3@e.com");
    const courseId = await publishedCourse(ownerId, "tr3");
    const secA = await createCourseSection(ownerId, courseId, { name: "Lớp A" });
    const secB = await createCourseSection(ownerId, courseId, { name: "Lớp B" });
    const learnerId = await makeUser("tr-l3@e.com");
    await enrollInCourse(learnerId, courseId, undefined, { sectionId: secA.id });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: learnerId, courseId } },
    });
    const strangerId = await makeUser("tr-s3@e.com");

    await expect(
      transferEnrollmentSection(strangerId, enrollment.id, secB.id),
    ).rejects.toThrow();
  });
});

describe("kỳ học (chữ tự gõ) và ghi chú của lớp", () => {
  it("lưu kỳ học + ghi chú khi tạo; cắt khoảng trắng; rỗng thành null", async () => {
    const ownerId = await makeUser("term-a@e.com");
    const courseId = await publishedCourse(ownerId, "term-a");
    const a = await createCourseSection(ownerId, courseId, {
      name: "Lớp A",
      termLabel: "  HK1 2026-27 ",
      description: "Thứ 7 chiều",
    });
    expect(a).toMatchObject({ termLabel: "HK1 2026-27", description: "Thứ 7 chiều" });
    const b = await createCourseSection(ownerId, courseId, { name: "Lớp B", termLabel: "   ", description: "  " });
    expect(b).toMatchObject({ termLabel: null, description: null });
  });

  it("đổi và xoá kỳ học / ghi chú qua update; tên không đụng tới", async () => {
    const ownerId = await makeUser("term-b@e.com");
    const courseId = await publishedCourse(ownerId, "term-b");
    const s = await createCourseSection(ownerId, courseId, { name: "Lớp A", termLabel: "HK1" });
    await updateCourseSection(ownerId, s.id, { termLabel: "HK2", description: "mới" });
    let [row] = await listCourseSections(ownerId, courseId);
    expect(row).toMatchObject({ name: "Lớp A", termLabel: "HK2", description: "mới" });
    await updateCourseSection(ownerId, s.id, { termLabel: null, description: null });
    [row] = await listCourseSections(ownerId, courseId);
    expect(row).toMatchObject({ termLabel: null, description: null });
  });

  it("từ chối kỳ học quá 100 ký tự", async () => {
    const ownerId = await makeUser("term-c@e.com");
    const courseId = await publishedCourse(ownerId, "term-c");
    await expect(
      createCourseSection(ownerId, courseId, { name: "Lớp A", termLabel: "x".repeat(101) }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("import lớp học từ Excel", () => {
  function sheet(rows: unknown[][]): Buffer {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "S");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  it("đọc file theo tên cột (bất kể thứ tự, nhận 'Kì học'); không có header thì theo thứ tự Tên/Kỳ/Ghi chú", () => {
    const rows = parseSectionImportSheet(
      sheet([
        ["Ghi chú", "Tên lớp", "Kì học"],
        ["sáng", "A1", "HK1"],
        ["", "", ""],
      ]),
    );
    expect(rows).toEqual([{ line: 2, name: "A1", termLabel: "HK1", note: "sáng" }]);
    expect(parseSectionImportSheet(sheet([["B1", "HK2", "ghi"]]))[0]).toMatchObject({
      name: "B1",
      termLabel: "HK2",
      note: "ghi",
    });
  });

  it("xem trước phân loại từng dòng và không ghi gì", async () => {
    const ownerId = await makeUser("imp-a@e.com");
    const courseId = await publishedCourse(ownerId, "imp-a");
    await createCourseSection(ownerId, courseId, { name: "Đã có" });
    const preview = await previewSectionImport(ownerId, courseId, [
      { line: 2, name: "Mới 1", termLabel: "HK1" },
      { line: 3, name: "" },
      { line: 4, name: "Mới 1" },
      { line: 5, name: "Đã có" },
    ]);
    expect(preview.rows.map((r) => r.status)).toEqual(["ok", "missing_name", "duplicate_in_file", "name_exists"]);
    expect(preview.actionable).toBe(1);
    expect(await listCourseSections(ownerId, courseId)).toHaveLength(1);
  });

  it("import chỉ tạo dòng hợp lệ, có kỳ học + ghi chú; dòng lỗi được báo lại", async () => {
    const ownerId = await makeUser("imp-b@e.com");
    const courseId = await publishedCourse(ownerId, "imp-b");
    const res = await importCourseSections(ownerId, courseId, [
      { line: 2, name: "L1", termLabel: "HK1", note: "Sáng T2" },
      { line: 3, name: "L2" },
      { line: 4, name: "L1" },
    ]);
    expect(res.created).toBe(2);
    expect(res.failed).toEqual([{ line: 4, name: "L1", error: "duplicate_in_file" }]);
    const list = await listCourseSections(ownerId, courseId);
    expect(list.find((s) => s.name === "L1")).toMatchObject({ termLabel: "HK1", description: "Sáng T2" });
  });

  it("chặn file rỗng, quá nhiều dòng, và người không có quyền", async () => {
    const ownerId = await makeUser("imp-c@e.com");
    const courseId = await publishedCourse(ownerId, "imp-c");
    await expect(previewSectionImport(ownerId, courseId, [])).rejects.toBeInstanceOf(SectionImportError);
    const many = Array.from({ length: 201 }, (_, i) => ({ line: i + 2, name: `X${i}` }));
    await expect(previewSectionImport(ownerId, courseId, many)).rejects.toMatchObject({ code: "too_many_rows" });
    const stranger = await makeUser("imp-stranger@e.com");
    await expect(previewSectionImport(stranger, courseId, [{ line: 2, name: "A" }])).rejects.toBeDefined();
  });

  it("file mẫu đọc lại được đúng 2 dòng", () => {
    expect(parseSectionImportSheet(generateSectionImportTemplateXlsx())).toHaveLength(2);
  });
});
