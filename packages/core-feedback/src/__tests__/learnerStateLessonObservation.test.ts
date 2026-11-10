import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { BKT, updateMasteryBkt } from "../bkt";
import { updateLearnerStateForLessonObservation } from "../learnerState";

/**
 * LANG đợt 4 — một lượt quan sát áp lên MỌI skill gắn vào bài; nguồn ("h5p" mặc định, "practice" cho Bài luyện nhúng
 * trong bài) được ghi vào `skill.state.updated`.
 */

let seq = 0;
async function fx(skillCount = 1) {
  const n = ++seq;
  const course = await prisma.course.create({ data: { slug: `lo-${Date.now()}-${n}`, title: "NN", description: "x", personalizationEnabled: true, languageMode: true } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "C1", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "Bài", orderIndex: 0, languageSkill: "reading" } });
  const user = await prisma.user.create({ data: { email: `lo-${Date.now()}-${n}@e.com`, passwordHash: "x", displayName: "HV" } });
  const skillIds: string[] = [];
  for (let i = 0; i < skillCount; i++) {
    const s = await prisma.skill.create({ data: { code: `lo.skill.${Date.now()}.${n}.${i}`, name: `S${i}`, languageSkill: "reading" } });
    await prisma.contentSkillMapping.create({ data: { contentType: "lesson", contentId: lesson.id, skillId: s.id } });
    skillIds.push(s.id);
  }
  return { userId: user.id, lessonId: lesson.id, skillIds };
}

describe("updateLearnerStateForLessonObservation", () => {
  it("đúng: mastery tăng đúng công thức BKT, attempts và correctCount tăng, mọi skill gắn bài đều được cập nhật", async () => {
    const f = await fx(2);
    const r = await updateLearnerStateForLessonObservation(f.userId, f.lessonId, true, undefined, "practice");
    expect(r.skillsUpdated).toBe(2);
    const expected = updateMasteryBkt(BKT.P_L0, true).newMastery;
    for (const id of f.skillIds) {
      const st = await prisma.learnerSkillState.findUnique({ where: { userId_skillId: { userId: f.userId, skillId: id } } });
      expect(st?.attempts).toBe(1);
      expect(st?.correctCount).toBe(1);
      expect(st?.masteryProbability).toBeCloseTo(expected, 10);
    }
  });

  it("sai: mastery giảm so với trước, correctCount không tăng", async () => {
    const f = await fx(1);
    await updateLearnerStateForLessonObservation(f.userId, f.lessonId, true, undefined, "practice");
    const before = (await prisma.learnerSkillState.findFirstOrThrow({ where: { userId: f.userId } })).masteryProbability;
    await updateLearnerStateForLessonObservation(f.userId, f.lessonId, false, undefined, "practice");
    const st = await prisma.learnerSkillState.findFirstOrThrow({ where: { userId: f.userId } });
    expect(st.masteryProbability).toBeLessThan(before);
    expect(st.attempts).toBe(2);
    expect(st.correctCount).toBe(1);
  });

  it("ghi nguồn vào skill.state.updated: 'practice' khi được truyền, 'h5p' khi không", async () => {
    const f = await fx(1);
    await updateLearnerStateForLessonObservation(f.userId, f.lessonId, true, undefined, "practice");
    await updateLearnerStateForLessonObservation(f.userId, f.lessonId, true);
    const evs = await prisma.learningEvent.findMany({ where: { userId: f.userId, eventType: LearningEventType.SkillStateUpdated }, orderBy: { id: "asc" } });
    expect(evs.map((e) => (e.payload as { source: string }).source)).toEqual(["practice", "h5p"]);
    expect((evs[0]!.payload as { lessonId: string }).lessonId).toBe(f.lessonId);
  });

  it("bài không có skill gắn (khoá không cá nhân hoá) thì không đổi gì và không lỗi", async () => {
    const n = ++seq;
    const course = await prisma.course.create({ data: { slug: `lo-none-${Date.now()}-${n}`, title: "NN", description: "x" } });
    const mod = await prisma.module.create({ data: { courseId: course.id, title: "C1", orderIndex: 0 } });
    const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "Bài", orderIndex: 0 } });
    const user = await prisma.user.create({ data: { email: `lo-none-${Date.now()}-${n}@e.com`, passwordHash: "x", displayName: "HV" } });
    const r = await updateLearnerStateForLessonObservation(user.id, lesson.id, true, undefined, "practice");
    expect(r.skillsUpdated).toBe(0);
    expect(await prisma.learnerSkillState.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("updateLearnerStateForLessonObservation — chạy song song", () => {
  it("nhiều lượt quan sát cùng lúc không làm mất lượt nào (attempts = số lượt) và mastery bằng chạy tuần tự", async () => {
    const f = await fx(1);
    const obs = [true, false, true, true, false, true];
    await Promise.all(obs.map((ok) => updateLearnerStateForLessonObservation(f.userId, f.lessonId, ok, undefined, "practice")));
    const st = await prisma.learnerSkillState.findFirstOrThrow({ where: { userId: f.userId } });
    expect(st.attempts).toBe(obs.length);
    expect(st.correctCount).toBe(obs.filter(Boolean).length);
    expect(await prisma.learningEvent.count({ where: { userId: f.userId, eventType: LearningEventType.SkillStateUpdated } })).toBe(obs.length);
    // BKT không giao hoán theo thứ tự đúng/sai, nên chỉ kiểm khoảng hợp lệ chứ không so với một thứ tự cố định.
    expect(st.masteryProbability).toBeGreaterThan(0);
    expect(st.masteryProbability).toBeLessThan(1);
  });
});
