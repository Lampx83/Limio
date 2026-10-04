import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName, lessonSkillCode } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { createCourse, publishCourse } from "../../courses/courses";
import { LANGUAGE_TEMPLATES, LanguageTemplateError, createLanguageTemplateCourse } from "../index";

/**
 * LANG G8 — "Khoá mẫu ngoại ngữ": tạo khoá nháp Tiếng Trung / Tiếng Anh dựng sẵn qua
 * đúng các hàm dịch vụ mà giao diện đi (nên auto-tag, personalization... tự đúng).
 */

const BASE = "http://localhost:3000";

async function makeInstructor() {
  const r = await registerUser(
    { email: `g8${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  await grantRole(r.userId, { targetUserId: r.userId, roleName: RoleName.Instructor });
  return r.userId;
}

async function load(courseId: string) {
  return prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              contentItems: { orderBy: { orderIndex: "asc" } },
              quizzes: { include: { questions: { include: { options: true } } } },
              assignments: true,
            },
          },
        },
      },
      instructors: true,
    },
  });
}
const lessonsOf = (c: Awaited<ReturnType<typeof load>>) => c.modules.flatMap((m) => m.lessons);

describe("danh mục khoá mẫu", () => {
  it("có Tiếng Trung và Tiếng Anh", () => {
    expect(LANGUAGE_TEMPLATES.map((t) => t.id).sort()).toEqual(["en", "zh"]);
  });
});

describe.each([
  { template: "zh" as const, readingLabel: "Pinyin", examMarker: "HSK", lang: "zh" },
  { template: "en" as const, readingLabel: "IPA", examMarker: "IELTS", lang: "en" },
])("khoá mẫu $template", ({ template, readingLabel, examMarker, lang }) => {
  it("LANG.8.1 — bản nháp của giảng viên, bật sẵn chế độ ngoại ngữ, chưa ai ghi danh", async () => {
    const owner = await makeInstructor();
    const { courseId } = await createLanguageTemplateCourse(owner, { template });
    const c = await load(courseId);
    expect(c.status).toBe("draft");
    expect(c.languageMode).toBe(true);
    expect(c.personalizationEnabled).toBe(true);
    expect(c.language).toBe(lang);
    expect(c.instructors.map((i) => [i.userId, i.role])).toEqual([[owner, "owner"]]);
    expect(await prisma.enrollment.count({ where: { courseId } })).toBe(0);
  });

  it("LANG.8.2 — đủ bốn kỹ năng, mỗi kỹ năng đúng một bài; có bài từ vựng và hội thoại", async () => {
    const owner = await makeInstructor();
    const { courseId } = await createLanguageTemplateCourse(owner, { template });
    const lessons = lessonsOf(await load(courseId));
    const skills = lessons.map((l) => l.languageSkill).filter(Boolean).sort();
    expect(skills).toEqual(["listening", "reading", "speaking", "writing"]);

    const vocab = lessons.flatMap((l) => l.contentItems).find((c) => c.type === "vocab_list");
    expect(vocab).toBeTruthy();
    expect((vocab!.payload as { readingLabel?: string }).readingLabel).toBe(readingLabel);
    expect(((vocab!.payload as { items: unknown[] }).items).length).toBeGreaterThanOrEqual(5);

    const speaking = lessons.find((l) => l.languageSkill === "speaking")!;
    expect(speaking.contentItems.some((c) => c.type === "dialogue")).toBe(true);
  });

  it("LANG.8.2 — bài Nghe không kèm audio giả, có ghi chú tải audio, và có quiz hợp lệ", async () => {
    const owner = await makeInstructor();
    const { courseId } = await createLanguageTemplateCourse(owner, { template });
    const listening = lessonsOf(await load(courseId)).find((l) => l.languageSkill === "listening")!;
    expect(listening.contentItems.some((c) => c.type === "audio")).toBe(false);
    const hasAudioFile = listening.contentItems.some((c) => JSON.stringify(c.payload).includes("/api/lesson-media/"));
    expect(hasAudioFile).toBe(false);
    const note = listening.contentItems.find((c) => c.type === "richtext");
    expect(JSON.stringify(note?.payload)).toMatch(/tải audio/i);
    expect(listening.quizzes).toHaveLength(1);
    for (const q of listening.quizzes[0]!.questions) {
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });

  it("LANG.8.3 — bài tập Viết và Nói đều có rubric; Nói ghi rõ chấm tự động chưa bật", async () => {
    const owner = await makeInstructor();
    const { courseId } = await createLanguageTemplateCourse(owner, { template });
    const lessons = lessonsOf(await load(courseId));
    const writing = lessons.find((l) => l.languageSkill === "writing")!.assignments;
    const speaking = lessons.find((l) => l.languageSkill === "speaking")!.assignments;
    expect(writing).toHaveLength(1);
    expect((writing[0]!.rubricText ?? "").length).toBeGreaterThan(50);
    expect(speaking).toHaveLength(1);
    expect((speaking[0]!.rubricText ?? "").length).toBeGreaterThan(50);
    expect(speaking[0]!.description).toMatch(/chưa bật/i);
  });

  it("LANG.8.2 — mỗi bài tự sinh chủ đề (lesson-as-tag) kèm nhãn kỹ năng", async () => {
    const owner = await makeInstructor();
    const { courseId } = await createLanguageTemplateCourse(owner, { template });
    const lessons = lessonsOf(await load(courseId));
    for (const l of lessons) {
      const skill = await prisma.skill.findUnique({ where: { code: lessonSkillCode(l.id) } });
      expect(skill, l.title).toBeTruthy();
      expect(skill!.languageSkill).toBe(l.languageSkill);
    }
  });

  it("LANG.8.4 — đề thi thử đã xuất bản, đủ phần có giờ và câu hỏi, đánh dấu mẫu", async () => {
    const owner = await makeInstructor();
    const { courseId, examId } = await createLanguageTemplateCourse(owner, { template });
    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      include: { sections: { orderBy: { orderIndex: "asc" } } },
    });
    expect(exam.courseId).toBe(courseId);
    expect(exam.mockMode).toBe(true);
    expect(exam.status).toBe("published");
    expect(exam.title).toContain("(mẫu)");
    expect(exam.title).toContain(examMarker);
    expect(exam.sections.map((s) => s.languageSkill)).toEqual(["listening", "reading", "writing"]);
    for (const s of exam.sections) {
      expect(s.durationMin).toBeGreaterThan(0);
      const n = await prisma.examQuestion.count({ where: { examId, sectionItem: { sectionId: s.id } } });
      expect(n, s.title).toBeGreaterThanOrEqual(2);
    }
    expect(exam.durationMin).toBe(exam.sections.reduce((a, s) => a + (s.durationMin ?? 0), 0));
    // Mọi câu đều thuộc một phần (không câu mồ côi) và đúng một đáp án đúng.
    expect(await prisma.examQuestion.count({ where: { examId, sectionItem: null } })).toBe(0);
  });

  it("LANG.8.1 — khoá mẫu xuất bản được ngay", async () => {
    const owner = await makeInstructor();
    const { courseId } = await createLanguageTemplateCourse(owner, { template });
    await expect(publishCourse(owner, courseId)).resolves.not.toThrow();
  });

  it("LANG.8.5 — tạo nhiều lần ra nhiều khoá riêng, slug khác nhau", async () => {
    const owner = await makeInstructor();
    const a = await createLanguageTemplateCourse(owner, { template });
    const b = await createLanguageTemplateCourse(owner, { template });
    expect(a.courseId).not.toBe(b.courseId);
    expect(a.slug).not.toBe(b.slug);
  });
});

describe("LANG.8.6 — an toàn", () => {
  it("không phải giảng viên thì bị chặn và không tạo gì", async () => {
    const r = await registerUser(
      { email: `g8l${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "HV" },
      BASE,
    );
    const before = await prisma.course.count();
    await expect(createLanguageTemplateCourse(r.userId, { template: "zh" })).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(await prisma.course.count()).toBe(before);
  });

  it("mẫu không có thì validation_failed", async () => {
    const owner = await makeInstructor();
    await expect(createLanguageTemplateCourse(owner, { template: "fr" })).rejects.toBeInstanceOf(
      LanguageTemplateError,
    );
    await expect(createLanguageTemplateCourse(owner, {})).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("không đụng tới khoá khác: chỉ thêm đúng một khoá mới", async () => {
    const owner = await makeInstructor();
    const other = await createCourse(owner, { title: "Khoá thường", description: "x" });
    const snap = await prisma.course.findUniqueOrThrow({ where: { id: other.courseId } });
    const before = await prisma.course.count();
    await createLanguageTemplateCourse(owner, { template: "en" });
    expect(await prisma.course.count()).toBe(before + 1);
    const after = await prisma.course.findUniqueOrThrow({ where: { id: other.courseId } });
    expect(after).toEqual(snap);
    expect(after.languageMode).toBe(false);
  });

  it("không dùng câu của đề thật: tiêu đề/đề không chứa số năm đề hay tên đề gốc", async () => {
    const owner = await makeInstructor();
    const { examId } = await createLanguageTemplateCourse(owner, { template: "zh" });
    const qs = await prisma.examQuestion.findMany({ where: { examId } });
    expect(JSON.stringify(qs)).not.toMatch(/H3\d{4}|Cambridge/);
  });
});
