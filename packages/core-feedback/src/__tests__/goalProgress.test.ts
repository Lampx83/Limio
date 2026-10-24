import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType, lessonSkillCode, type LanguageSkill } from "@feedbackme/shared-types";
import { assessPace, getGoalProgress, type GoalForProgress } from "../goalProgress";

/**
 * CENTER C6.3 — tiến độ theo mục tiêu. Học viên nhận NHÃN (Cần ôn / Nên luyện / Vững), không bao giờ số mastery;
 * nhận định đúng kế hoạch / chậm / vượt tính khi đọc từ số tuần còn lại và số giờ học thật (lesson.engaged).
 */

const DAY = 86_400_000;
const NOW = new Date("2026-10-23T03:00:00.000Z"); // 10:00 giờ VN, thứ sáu

const goal = (over: Partial<GoalForProgress> = {}): GoalForProgress => ({
  framework: "HSK",
  targetLevel: "HSK 3",
  targetDate: "2027-06-30",
  hoursPerWeek: 4,
  startedAt: new Date(NOW.getTime() - 4 * 7 * DAY).toISOString(), // đặt cách đây 4 tuần
  ...over,
});

describe("assessPace — nhận định so với kế hoạch (thuần, C6.3)", () => {
  // 4 tuần × 4 giờ/tuần = 16 giờ kỳ vọng.
  it.each([
    [16 * 3600, "on_track"],
    [13 * 3600, "on_track"], // 0,8125
    [12.7 * 3600, "behind"], // 0,794
    [0, "behind"],
    [18.4 * 3600, "ahead"], // đúng 1,15
    [30 * 3600, "ahead"],
    [18.3 * 3600, "on_track"], // 1,1437 < 1,15
  ])("đã học %d giây → %s", (sec, status) => {
    expect(assessPace({ goal: goal(), now: NOW, actualSec: sec }).status).toBe(status);
  });

  it("số giờ kỳ vọng và thực tế được trả ra (làm tròn 0,5 giờ cho giờ thực tế)", () => {
    const p = assessPace({ goal: goal(), now: NOW, actualSec: 13.3 * 3600 });
    expect(p.expectedHours).toBe(16);
    expect(p.actualHours).toBe(13.5);
  });

  it("chưa đủ 1 tuần thì chưa đủ dữ liệu; không đặt số giờ thì không nhận định; quá hạn thì báo quá hạn", () => {
    expect(assessPace({ goal: goal({ startedAt: new Date(NOW.getTime() - 3 * DAY).toISOString() }), now: NOW, actualSec: 99999 }).status).toBe("too_early");
    expect(assessPace({ goal: goal({ hoursPerWeek: null }), now: NOW, actualSec: 99999 }).status).toBe("no_hours_target");
    expect(assessPace({ goal: goal({ targetDate: "2026-10-22" }), now: NOW, actualSec: 0 }).status).toBe("overdue");
    // đúng ngày hạn thì chưa quá hạn
    expect(assessPace({ goal: goal({ targetDate: "2026-10-23" }), now: NOW, actualSec: 16 * 3600 }).status).toBe("on_track");
  });

  it("số tuần còn lại làm tròn lên; không có hạn (mục tiêu lớp) thì null", () => {
    // 2026-10-23 → 2027-06-30 = 250 ngày → 36 tuần
    expect(assessPace({ goal: goal(), now: NOW, actualSec: 0 })).toMatchObject({ daysLeft: 250, weeksLeft: 36 });
    expect(assessPace({ goal: goal({ targetDate: "2026-10-30" }), now: NOW, actualSec: 0 })).toMatchObject({ daysLeft: 7, weeksLeft: 1 });
    expect(assessPace({ goal: goal({ targetDate: "2026-10-31" }), now: NOW, actualSec: 0 })).toMatchObject({ daysLeft: 8, weeksLeft: 2 });
    expect(assessPace({ goal: goal({ targetDate: null }), now: NOW, actualSec: 0 })).toMatchObject({ daysLeft: null, weeksLeft: null });
  });
});

let seq = 0;
async function user(name: string) {
  return (await prisma.user.create({ data: { email: `gp-${name}-${Date.now()}-${++seq}@e.com`, passwordHash: "x", displayName: name } })).id;
}

interface LessonSpec {
  skill?: LanguageSkill;
  state?: [number, number]; // [mastery, attempts]
}

async function course(userId: string, specs: LessonSpec[], opts: { languageMode?: boolean; personalization?: boolean; variant?: "personalized" | "minimal" } = {}) {
  const c = await prisma.course.create({
    data: { slug: `gp-${Date.now()}-${++seq}`, title: "Khoá", description: "d", personalizationEnabled: opts.personalization ?? true, languageMode: opts.languageMode ?? true },
  });
  const mod = await prisma.module.create({ data: { courseId: c.id, title: "Chương", orderIndex: 0 } });
  const section = await prisma.courseSection.create({ data: { courseId: c.id, name: "Lớp", feedbackVariant: opts.variant ?? "personalized" } });
  await prisma.enrollment.create({ data: { userId, courseId: c.id, sectionId: section.id, courseVersion: 1 } });
  const lessonIds: string[] = [];
  for (const [i, spec] of specs.entries()) {
    const l = await prisma.lesson.create({ data: { moduleId: mod.id, title: `Bài ${i + 1}`, orderIndex: i, languageSkill: spec.skill ?? null } });
    const sk = await prisma.skill.create({ data: { code: lessonSkillCode(l.id), name: `Bài ${i + 1}`, languageSkill: spec.skill ?? null } });
    await prisma.contentSkillMapping.create({ data: { contentType: "lesson", contentId: l.id, skillId: sk.id, coverageWeight: 1 } });
    if (spec.state) await prisma.learnerSkillState.create({ data: { userId, skillId: sk.id, masteryProbability: spec.state[0], attempts: spec.state[1], correctCount: 0 } });
    lessonIds.push(l.id);
  }
  return { courseId: c.id, lessonIds };
}

async function engaged(userId: string, courseId: string, lessonId: string, activeSec: number, at: Date) {
  await prisma.learningEvent.create({
    data: { userId, courseId, eventType: LearningEventType.LessonEngaged, payload: { lessonId, activeSec, scrollPct: 50, videoPct: 0, totalActiveSec: activeSec }, occurredAt: at },
  });
}

describe("getGoalProgress — số giờ học thật", () => {
  it("cộng activeSec của lesson.engaged của chính học viên, trong khoá của mục tiêu, từ lúc đặt mục tiêu", async () => {
    const me = await user("me");
    const other = await user("other");
    const c = await course(me, [{ skill: "listening" }]);
    const c2 = await course(me, [{ skill: "reading" }]);
    const g = goal();
    const before = new Date(NOW.getTime() - 5 * 7 * DAY); // trước khi đặt mục tiêu
    const after = new Date(NOW.getTime() - 2 * DAY);
    await engaged(me, c.courseId, c.lessonIds[0]!, 3600, before); // không tính: trước mục tiêu
    await engaged(me, c.courseId, c.lessonIds[0]!, 2 * 3600, after);
    await engaged(me, c.courseId, c.lessonIds[0]!, 3600, after);
    await engaged(me, c2.courseId, c2.lessonIds[0]!, 5 * 3600, after); // khoá khác
    await engaged(other, c.courseId, c.lessonIds[0]!, 9 * 3600, after); // người khác

    const p = await getGoalProgress({ userId: me, courseId: c.courseId, goal: g, audience: "learner", now: NOW });
    expect(p.pace.actualHours).toBe(3);
    // mục tiêu chung (không khoá) cộng mọi khoá của chính mình
    const all = await getGoalProgress({ userId: me, courseId: null, goal: g, audience: "learner", now: NOW });
    expect(all.pace.actualHours).toBe(8);
    expect(all.skills).toBeNull();
    expect(all.overall).toBeNull();
  });
});

describe("getGoalProgress — tiến độ theo kỹ năng bằng nhãn (C6.3)", () => {
  it("khoá ngoại ngữ: đủ 4 kỹ năng với nhãn, không có số mastery cho học viên", async () => {
    const me = await user("lang");
    const c = await course(me, [{ skill: "listening", state: [0.9, 6] }, { skill: "reading", state: [0.3, 6] }]);
    const p = await getGoalProgress({ userId: me, courseId: c.courseId, goal: goal(), audience: "learner", now: NOW });
    expect(p.skills!.map((s) => [s.skill, s.label])).toEqual([
      ["listening", "solid"], ["speaking", "no_data"], ["reading", "needs_review"], ["writing", "no_data"],
    ]);
    expect(p.overall).toBeNull();
    const raw = JSON.stringify(p);
    expect(raw).not.toContain("mastery");
    expect(raw).not.toContain("evidence");
    expect(p.reason).toBeUndefined();
  });

  it("giảng viên xem cùng hình dạng (nhãn), có thêm số liệu chỉ giảng viên thấy", async () => {
    const me = await user("lang-t");
    const c = await course(me, [{ skill: "listening", state: [0.9, 6] }]);
    const p = await getGoalProgress({ userId: me, courseId: c.courseId, goal: goal(), audience: "instructor", now: NOW });
    expect(p.skills!.find((s) => s.skill === "listening")).toMatchObject({ label: "solid", mastery: expect.any(Number) });
  });

  it("khoá thường (không ngoại ngữ): một nhãn tổng và số bài đã luyện", async () => {
    const me = await user("plain");
    const c = await course(me, [{ state: [0.9, 4] }, { state: [0.5, 4] }, {}], { languageMode: false });
    const p = await getGoalProgress({ userId: me, courseId: c.courseId, goal: goal(), audience: "learner", now: NOW });
    expect(p.skills).toBeNull();
    // trung bình 0,7 → Nên luyện; 8 lượt trả lời đủ bằng chứng
    expect(p.overall).toEqual({ label: "practice_more", lessonsPracticed: 2, lessonsTotal: 3 });
  });

  it("chưa đủ bằng chứng thì 'chưa đủ dữ liệu', không đoán", async () => {
    const me = await user("thin");
    const c = await course(me, [{ state: [0.95, 2] }], { languageMode: false });
    const p = await getGoalProgress({ userId: me, courseId: c.courseId, goal: goal(), audience: "learner", now: NOW });
    expect(p.overall).toMatchObject({ label: "no_data", lessonsPracticed: 1, lessonsTotal: 1 });
  });

  it("khoá tắt cá nhân hoá: không có nhãn, nêu lý do; lớp đối chứng: học viên không thấy nhãn", async () => {
    const a = await user("nopers");
    const c = await course(a, [{ skill: "listening", state: [0.9, 6] }], { personalization: false, languageMode: false });
    const p = await getGoalProgress({ userId: a, courseId: c.courseId, goal: goal(), audience: "learner", now: NOW });
    expect(p).toMatchObject({ skills: null, overall: null, reason: "personalization_off" });

    const b = await user("ctrl");
    const d = await course(b, [{ skill: "listening", state: [0.9, 6] }], { variant: "minimal" });
    const pb = await getGoalProgress({ userId: b, courseId: d.courseId, goal: goal(), audience: "learner", now: NOW });
    expect(pb).toMatchObject({ skills: null, overall: null, reason: "control_variant" });
    // giảng viên vẫn xem được để quản lớp
    const pt = await getGoalProgress({ userId: b, courseId: d.courseId, goal: goal(), audience: "instructor", now: NOW });
    expect(pt.skills).not.toBeNull();
  });

  it("nhận định và số tuần còn lại đi kèm", async () => {
    const me = await user("pace");
    const c = await course(me, [{ skill: "listening" }]);
    await engaged(me, c.courseId, c.lessonIds[0]!, 16 * 3600, new Date(NOW.getTime() - DAY));
    const p = await getGoalProgress({ userId: me, courseId: c.courseId, goal: goal(), audience: "learner", now: NOW });
    expect(p.pace.status).toBe("on_track");
    expect(p.weeksLeft).toBe(36);
    expect(p.daysLeft).toBe(250);
  });
});
