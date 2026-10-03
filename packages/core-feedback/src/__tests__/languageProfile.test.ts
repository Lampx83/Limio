import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  LANGUAGE_SKILLS,
  LearningEventType,
  lessonSkillCode,
  type LanguageSkill,
} from "@feedbackme/shared-types";
import { getLanguageProfile, LANGUAGE_PROFILE_MIN_EVIDENCE } from "../languageProfile";

/**
 * LANG G3 / G3.2–G3.4 — hồ sơ 4 kỹ năng: phép gộp chỉ đọc trên LearnerSkillState
 * theo Skill.languageSkill. Học viên không bao giờ nhận số mastery.
 */

let seq = 0;

interface LessonSpec {
  skill?: LanguageSkill | null;
  hidden?: boolean;
  locked?: boolean;
  /** [mastery, attempts] — bỏ qua thì chưa có trạng thái. */
  state?: [number, number];
  completed?: boolean;
}
interface Fx {
  userId: string;
  courseId: string;
  lessonIds: string[];
  skillIds: string[];
}

async function fx(
  lessons: LessonSpec[],
  opts: {
    personalization?: boolean;
    languageMode?: boolean;
    enroll?: boolean;
    variant?: "personalized" | "minimal";
    hiddenModule?: boolean;
  } = {},
): Promise<Fx> {
  const n = ++seq;
  const course = await prisma.course.create({
    data: {
      slug: `lang-prof-${Date.now()}-${n}`,
      title: "Ngoại ngữ",
      description: "x",
      personalizationEnabled: opts.personalization ?? true,
      languageMode: opts.languageMode ?? true,
    },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "Chương 1", orderIndex: 0, isHidden: opts.hiddenModule ?? false },
  });
  const user = await prisma.user.create({
    data: { email: `lp-${Date.now()}-${n}@e.com`, passwordHash: "x", displayName: `Học viên ${n}` },
  });
  if (opts.enroll ?? true) {
    const section = await prisma.courseSection.create({
      data: { courseId: course.id, name: "Lớp", feedbackVariant: opts.variant ?? "personalized" },
    });
    await prisma.enrollment.create({
      data: { userId: user.id, courseId: course.id, sectionId: section.id, courseVersion: 1 },
    });
  }
  const lessonIds: string[] = [];
  const skillIds: string[] = [];
  for (let i = 0; i < lessons.length; i++) {
    const spec = lessons[i]!;
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: `Bài ${i + 1}`,
        orderIndex: i,
        languageSkill: spec.skill ?? null,
        isHidden: spec.hidden ?? false,
        isLocked: spec.locked ?? false,
      },
    });
    const skill = await prisma.skill.create({
      data: { code: lessonSkillCode(lesson.id), name: `Bài ${i + 1}`, languageSkill: spec.skill ?? null },
    });
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: lesson.id, skillId: skill.id, coverageWeight: 1 },
    });
    if (spec.state) {
      await prisma.learnerSkillState.create({
        data: {
          userId: user.id,
          skillId: skill.id,
          masteryProbability: spec.state[0],
          attempts: spec.state[1],
          correctCount: 0,
        },
      });
    }
    if (spec.completed) {
      await prisma.learningEvent.create({
        data: {
          userId: user.id,
          courseId: course.id,
          eventType: LearningEventType.LessonCompleted,
          payload: { lessonId: lesson.id },
        },
      });
    }
    lessonIds.push(lesson.id);
    skillIds.push(skill.id);
  }
  return { userId: user.id, courseId: course.id, lessonIds, skillIds };
}

const row = (p: Awaited<ReturnType<typeof getLanguageProfile>>, s: LanguageSkill) =>
  p.skills.find((r) => r.skill === s)!;

describe("getLanguageProfile — gộp và nhãn (G3.2)", () => {
  it("ngưỡng bằng chứng tối thiểu là 5", () => {
    expect(LANGUAGE_PROFILE_MIN_EVIDENCE).toBe(5);
  });

  it("G3.2.1 + G3.2.7: chưa có trạng thái nào → đủ 4 kỹ năng theo thứ tự Nghe, Nói, Đọc, Viết, đều 'Chưa đủ dữ liệu'; kỹ năng không có bài vẫn có mặt", async () => {
    const f = await fx([{ skill: "listening" }, { skill: "reading" }]);
    const p = await getLanguageProfile(f.userId, f.courseId, "learner");
    expect(p.enabled).toBe(true);
    expect(p.skills.map((r) => r.skill)).toEqual([...LANGUAGE_SKILLS]);
    for (const r of p.skills) expect(r.label).toBe("no_data");
    expect(row(p, "speaking").lessonsTotal).toBe(0);
    expect(row(p, "listening").lessonsTotal).toBe(1);
  });

  it("G3.2.2: dưới 5 lượt trả lời thì vẫn 'Chưa đủ dữ liệu'; đủ 5 thì có nhãn", async () => {
    const few = await fx([{ skill: "listening", state: [0.2, 4] }]);
    expect(row(await getLanguageProfile(few.userId, few.courseId, "learner"), "listening").label).toBe("no_data");
    const enough = await fx([{ skill: "listening", state: [0.2, 5] }]);
    expect(row(await getLanguageProfile(enough.userId, enough.courseId, "learner"), "listening").label).toBe("needs_review");
  });

  it("G3.2.3: ba mức đúng tại các điểm biên", async () => {
    const f = await fx([
      { skill: "listening", state: [0.599, 5] },
      { skill: "speaking", state: [0.6, 5] },
      { skill: "reading", state: [0.849, 5] },
      { skill: "writing", state: [0.85, 5] },
    ]);
    const p = await getLanguageProfile(f.userId, f.courseId, "learner");
    expect(row(p, "listening").label).toBe("needs_review");
    expect(row(p, "speaking").label).toBe("practice_more");
    expect(row(p, "reading").label).toBe("practice_more");
    expect(row(p, "writing").label).toBe("solid");
  });

  it("mastery là trung bình các chủ đề đã có lượt trả lời; bằng chứng cộng dồn", async () => {
    const f = await fx([
      { skill: "listening", state: [0.7, 3] },
      { skill: "listening", state: [0.3, 3] },
    ]);
    const p = await getLanguageProfile(f.userId, f.courseId, "instructor");
    const r = row(p, "listening");
    expect(r.mastery).toBeCloseTo(0.5, 5);
    expect(r.evidence).toBe(6);
    expect(r.label).toBe("needs_review");
  });

  it("G3.2.4: chủ đề attempts=0 (mastery mặc định) không kéo trung bình xuống", async () => {
    const f = await fx([
      { skill: "reading", state: [0.1, 0] },
      { skill: "reading", state: [0.9, 5] },
    ]);
    const r = row(await getLanguageProfile(f.userId, f.courseId, "instructor"), "reading");
    expect(r.mastery).toBeCloseTo(0.9, 5);
    expect(r.label).toBe("solid");
    expect(r.lessonsPracticed).toBe(1);
    expect(r.lessonsTotal).toBe(2);
  });

  it("G3.2.5: trạng thái của khoá khác không lẫn vào", async () => {
    const f = await fx([{ skill: "listening" }]);
    const other = await fx([{ skill: "listening", state: [0.1, 50] }]);
    // Cùng người học, chủ đề của khoá khác.
    await prisma.learnerSkillState.create({
      data: { userId: f.userId, skillId: other.skillIds[0]!, masteryProbability: 0.1, attempts: 50, correctCount: 0 },
    });
    const r = row(await getLanguageProfile(f.userId, f.courseId, "instructor"), "listening");
    expect(r.label).toBe("no_data");
    expect(r.evidence).toBe(0);
  });

  it("G3.2.6: bài/module bị ẩn không tính", async () => {
    const hiddenLesson = await fx([
      { skill: "writing", state: [0.2, 9], hidden: true },
      { skill: "writing", state: [0.9, 5] },
    ]);
    const a = row(await getLanguageProfile(hiddenLesson.userId, hiddenLesson.courseId, "instructor"), "writing");
    expect(a.mastery).toBeCloseTo(0.9, 5);
    expect(a.lessonsTotal).toBe(1);

    const hiddenModule = await fx([{ skill: "writing", state: [0.2, 9] }], { hiddenModule: true });
    const b = row(await getLanguageProfile(hiddenModule.userId, hiddenModule.courseId, "instructor"), "writing");
    expect(b.lessonsTotal).toBe(0);
    expect(b.label).toBe("no_data");
  });

  it("bài không gán kỹ năng không thuộc kỹ năng nào", async () => {
    const f = await fx([{ skill: null, state: [0.1, 9] }, { skill: "listening" }]);
    const p = await getLanguageProfile(f.userId, f.courseId, "instructor");
    expect(p.skills.reduce((n, r) => n + r.lessonsTotal, 0)).toBe(1);
  });
});

describe("getLanguageProfile — quyền và riêng tư (G3.3)", () => {
  it("G3.3.2: phản hồi cho HỌC VIÊN không chứa mastery, xác suất, bằng chứng hay số lượt trả lời", async () => {
    const f = await fx([{ skill: "listening", state: [0.4321, 7] }, { skill: "reading", state: [0.9, 6] }]);
    const learner = await getLanguageProfile(f.userId, f.courseId, "learner");
    const json = JSON.stringify(learner);
    expect(json).not.toMatch(/mastery|probab|evidence|attempts|correct/i);
    expect(json).not.toContain("0.4321");
    expect(json).not.toMatch(/\d+\.\d{3,}/); // không có số thập phân dài nào lọt ra
    for (const r of learner.skills) {
      expect(Object.keys(r).sort()).toEqual(["label", "lessonsPracticed", "lessonsTotal", "skill"]);
    }
  });

  it("G3.3.2: phản hồi cho GIẢNG VIÊN có thêm mastery (null nếu chưa đủ dữ liệu) và bằng chứng", async () => {
    const f = await fx([{ skill: "listening", state: [0.4321, 7] }]);
    const p = await getLanguageProfile(f.userId, f.courseId, "instructor");
    expect(row(p, "listening").mastery).toBeCloseTo(0.4321, 4);
    expect(row(p, "listening").evidence).toBe(7);
    expect(row(p, "speaking").mastery).toBeNull();
    expect(row(p, "speaking").evidence).toBe(0);
  });

  it("G3.3.3: cá nhân hoá tắt / chế độ ngoại ngữ tắt / khoá không có → tắt kèm lý do, không lộ dữ liệu", async () => {
    const noPers = await fx([{ skill: "listening", state: [0.2, 9] }], { personalization: false, languageMode: false });
    // personalization=false kèm languageMode=true là tổ hợp không hợp lệ ở tầng ứng dụng,
    // nhưng hàm đọc vẫn phải tự bảo vệ nếu dữ liệu cũ lệch.
    await prisma.course.update({ where: { id: noPers.courseId }, data: { languageMode: true } });
    const a = await getLanguageProfile(noPers.userId, noPers.courseId, "instructor");
    expect(a).toMatchObject({ enabled: false, reason: "personalization_off", skills: [], suggestion: null });

    const noMode = await fx([{ skill: "listening", state: [0.2, 9] }], { languageMode: false });
    expect(await getLanguageProfile(noMode.userId, noMode.courseId, "learner")).toMatchObject({
      enabled: false, reason: "language_mode_off", skills: [], suggestion: null,
    });

    expect(
      await getLanguageProfile(noMode.userId, "00000000-0000-4000-8000-000000000000", "learner"),
    ).toMatchObject({ enabled: false, reason: "course_not_found" });
  });

  it("chưa ghi danh → tắt (not_enrolled)", async () => {
    const f = await fx([{ skill: "listening", state: [0.2, 9] }], { enroll: false });
    expect(await getLanguageProfile(f.userId, f.courseId, "learner")).toMatchObject({
      enabled: false, reason: "not_enrolled", skills: [],
    });
  });

  it("G3.3.4: lớp đối chứng (B10) không thấy hồ sơ; giảng viên vẫn xem được", async () => {
    const f = await fx([{ skill: "listening", state: [0.2, 9] }], { variant: "minimal" });
    expect(await getLanguageProfile(f.userId, f.courseId, "learner")).toMatchObject({
      enabled: false, reason: "control_variant", skills: [], suggestion: null,
    });
    const asTeacher = await getLanguageProfile(f.userId, f.courseId, "instructor");
    expect(asTeacher.enabled).toBe(true);
    expect(row(asTeacher, "listening").label).toBe("needs_review");
  });

  it("G3.6.2: hồ sơ không kèm email hay tên hiển thị", async () => {
    const f = await fx([{ skill: "listening", state: [0.2, 9] }]);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: f.userId } });
    for (const audience of ["learner", "instructor"] as const) {
      const json = JSON.stringify(await getLanguageProfile(f.userId, f.courseId, audience));
      expect(json).not.toContain(user.email);
      expect(json).not.toContain(user.displayName);
    }
  });
});

describe("getLanguageProfile — gợi ý 'Luyện hôm nay' (G3.4.3)", () => {
  it("chọn kỹ năng yếu nhất (Cần ôn trước Nên luyện) và bài điểm thấp nhất của nó", async () => {
    const f = await fx([
      { skill: "reading", state: [0.7, 5] }, // Nên luyện
      { skill: "listening", state: [0.4, 5], completed: true },
      { skill: "listening", state: [0.2, 5], completed: true }, // thấp nhất của Nghe
    ]);
    const p = await getLanguageProfile(f.userId, f.courseId, "learner");
    expect(p.suggestion).toMatchObject({ skill: "listening", lessonId: f.lessonIds[2], reason: "review" });
  });

  it("hai kỹ năng cùng Cần ôn: mastery thấp hơn thắng; bằng nhau thì theo thứ tự Nghe, Nói, Đọc, Viết", async () => {
    const lower = await fx([
      { skill: "listening", state: [0.4, 5] },
      { skill: "writing", state: [0.2, 5] },
    ]);
    expect((await getLanguageProfile(lower.userId, lower.courseId, "learner")).suggestion?.skill).toBe("writing");
    const tie = await fx([
      { skill: "writing", state: [0.3, 5] },
      { skill: "speaking", state: [0.3, 5] },
    ]);
    expect((await getLanguageProfile(tie.userId, tie.courseId, "learner")).suggestion?.skill).toBe("speaking");
  });

  it("chỉ có Nên luyện → gợi ý với lý do 'practice'", async () => {
    const f = await fx([{ skill: "reading", state: [0.7, 5] }]);
    expect((await getLanguageProfile(f.userId, f.courseId, "learner")).suggestion).toMatchObject({
      skill: "reading", reason: "practice",
    });
  });

  it("không kỹ năng nào yếu nhưng có kỹ năng chưa có dữ liệu → bài đầu CHƯA HỌC, không khoá, của kỹ năng đó ('start')", async () => {
    const f = await fx([
      { skill: "reading", state: [0.95, 6], completed: true },
      { skill: "listening", completed: true }, // đã học nhưng chưa có dữ liệu
      { skill: "listening", locked: true }, // khoá: bỏ qua
      { skill: "listening" }, // đây
    ]);
    const p = await getLanguageProfile(f.userId, f.courseId, "learner");
    expect(p.suggestion).toMatchObject({ skill: "listening", lessonId: f.lessonIds[3], reason: "start" });
  });

  it("tất cả đã Vững, hoặc kỹ năng chưa có dữ liệu mà không còn bài nào để học → không gợi ý", async () => {
    const solid = await fx([{ skill: "reading", state: [0.95, 6], completed: true }]);
    expect((await getLanguageProfile(solid.userId, solid.courseId, "learner")).suggestion).toBeNull();
    const nothing = await fx([{ skill: "listening", completed: true }]);
    expect((await getLanguageProfile(nothing.userId, nothing.courseId, "learner")).suggestion).toBeNull();
  });

  it("gợi ý không lộ số: chỉ lessonId, lessonTitle, skill, reason", async () => {
    const f = await fx([{ skill: "listening", state: [0.2, 5], completed: true }]);
    const s = (await getLanguageProfile(f.userId, f.courseId, "learner")).suggestion!;
    expect(Object.keys(s).sort()).toEqual(["lessonId", "lessonTitle", "reason", "skill"]);
  });
});
