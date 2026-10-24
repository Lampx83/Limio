import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  GOAL_LEVELS,
  LearningEventType,
  goalLevelOptions,
  isValidGoalLevel,
} from "@feedbackme/shared-types";
import {
  GoalError,
  adoptSectionGoal,
  changeGoal,
  getEffectiveGoal,
  getGoalHistory,
  listLearnerGoals,
  listMyGoals,
  listSectionLearnerGoals,
  setGoal,
  setGoalStatus,
  setSectionGoal,
} from "../learnerGoals";
import { CourseAuthzError } from "../authz";
import { BEFORE, makeUser, setup, type Setup } from "./meetingFixture";

const NOW = BEFORE; // 2026-10-23 10:00 giờ VN
const HSK3 = { framework: "HSK", targetLevel: "HSK 3", targetDate: "2027-06-30", hoursPerWeek: 4 } as const;

/** Người chỉ dạy (non-editing-teacher), có thể được xếp vào lớp. */
async function teachOnly(s: Setup, tag: string, assigned: boolean) {
  const u = await makeUser(`lg-${tag}@e.com`, ["center_teacher"]);
  await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: u, role: "non-editing-teacher" } });
  if (assigned) await prisma.classMeeting.updateMany({ where: { sectionId: s.sectionId }, data: { plannedTeacherId: u } });
  return u;
}

describe("danh sách cấp độ chuẩn (C6.2)", () => {
  it("HSK 1–6, IELTS 4.0–9.0 bước 0,5, TOEIC 400–900 bước 100, CEFR A1–C2", () => {
    expect(GOAL_LEVELS.HSK).toEqual(["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"]);
    expect(GOAL_LEVELS.IELTS).toHaveLength(11);
    expect(GOAL_LEVELS.IELTS[0]).toBe("IELTS 4.0");
    expect(GOAL_LEVELS.IELTS[1]).toBe("IELTS 4.5");
    expect(GOAL_LEVELS.IELTS.at(-1)).toBe("IELTS 9.0");
    expect(GOAL_LEVELS.TOEIC).toEqual(["TOEIC 400", "TOEIC 500", "TOEIC 600", "TOEIC 700", "TOEIC 800", "TOEIC 900"]);
    expect(GOAL_LEVELS.CEFR).toEqual(["CEFR A1", "CEFR A2", "CEFR B1", "CEFR B2", "CEFR C1", "CEFR C2"]);
    expect(goalLevelOptions("custom")).toEqual([]);
  });

  it("khung chuẩn chỉ nhận cấp độ trong danh sách; custom nhận nhãn 1–60 ký tự", () => {
    expect(isValidGoalLevel("HSK", "HSK 3")).toBe(true);
    expect(isValidGoalLevel("HSK", "HSK 7")).toBe(false);
    expect(isValidGoalLevel("HSK", "IELTS 6.0")).toBe(false);
    expect(isValidGoalLevel("IELTS", "IELTS 6.5")).toBe(true);
    expect(isValidGoalLevel("custom", "Giao tiếp du lịch")).toBe(true);
    expect(isValidGoalLevel("custom", "   ")).toBe(false);
    expect(isValidGoalLevel("custom", "x".repeat(61))).toBe(false);
  });
});

describe("setGoal — đặt mục tiêu (C6.1)", () => {
  it("học viên tự đặt: lưu, phát goal.set với chủ thể là học viên và ghi người đặt", async () => {
    const s = await setup("lg-set");
    const g = await setGoal(s.learners[0]!, { courseId: s.courseId, ...HSK3 }, NOW);
    expect(g).toMatchObject({ userId: s.learners[0], courseId: s.courseId, framework: "HSK", targetLevel: "HSK 3", targetDate: "2027-06-30", hoursPerWeek: 4, status: "active", setById: s.learners[0] });

    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.GoalSet } });
    expect(ev.userId).toBe(s.learners[0]);
    expect(ev.payload).toMatchObject({ goalId: g.id, setById: s.learners[0], fromSection: false, targetLevel: "HSK 3" });
    expect(ev.courseId).toBe(s.courseId);
  });

  it("giáo viên quản khoá đặt hộ: chủ thể vẫn là học viên, người đặt là giáo viên", async () => {
    const s = await setup("lg-by-teacher");
    const g = await setGoal(s.teacher, { userId: s.learners[0]!, courseId: s.courseId, ...HSK3 }, NOW);
    expect(g).toMatchObject({ userId: s.learners[0], setById: s.teacher });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.GoalSet } });
    expect(ev.userId).toBe(s.learners[0]);
    expect(ev.payload).toMatchObject({ setById: s.teacher });
  });

  it("mục tiêu chung không gắn khoá; chỉ chính học viên đặt được", async () => {
    const s = await setup("lg-general");
    const g = await setGoal(s.learners[0]!, { framework: "IELTS", targetLevel: "IELTS 6.5", targetDate: "2027-03-01" }, NOW);
    expect(g.courseId).toBeNull();
    await expect(setGoal(s.teacher, { userId: s.learners[0]!, framework: "IELTS", targetLevel: "IELTS 6.0", targetDate: "2027-03-01" }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("kiểm giá trị: cấp độ ngoài danh sách, hạn trong quá khứ hoặc quá 10 năm, giờ/tuần ngoài 0,5–60", async () => {
    const s = await setup("lg-valid");
    const me = s.learners[0]!;
    const base = { courseId: s.courseId, ...HSK3 };
    await expect(setGoal(me, { ...base, targetLevel: "HSK 9" }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setGoal(me, { ...base, targetDate: "2026-10-23" }, NOW)).rejects.toMatchObject({ code: "validation_failed" }); // phải sau hôm nay
    await expect(setGoal(me, { ...base, targetDate: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setGoal(me, { ...base, targetDate: "2037-01-01" }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setGoal(me, { ...base, targetDate: "2027-02-30" }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setGoal(me, { ...base, hoursPerWeek: 0.2 }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setGoal(me, { ...base, hoursPerWeek: 61 }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setGoal(me, { ...base, targetDate: "2026-10-24", hoursPerWeek: 0.5 }, NOW)).resolves.toMatchObject({ hoursPerWeek: 0.5 });
  });

  it("không đặt số giờ/tuần cũng được; custom nhận nhãn tự do", async () => {
    const s = await setup("lg-custom");
    const g = await setGoal(s.learners[0]!, { courseId: s.courseId, framework: "custom", targetLevel: "Đọc được truyện thiếu nhi", targetDate: "2027-01-31" }, NOW);
    expect(g).toMatchObject({ framework: "custom", targetLevel: "Đọc được truyện thiếu nhi", hoursPerWeek: null });
  });

  it("mỗi học viên một mục tiêu đang theo đuổi cho mỗi khoá (và một chung)", async () => {
    const s = await setup("lg-one");
    const me = s.learners[0]!;
    await setGoal(me, { courseId: s.courseId, ...HSK3 }, NOW);
    await expect(setGoal(me, { courseId: s.courseId, ...HSK3 }, NOW)).rejects.toMatchObject({ code: "goal_exists" });
    // mục tiêu chung vẫn đặt được, và người khác đặt được cho khoá đó
    await expect(setGoal(me, { framework: "TOEIC", targetLevel: "TOEIC 700", targetDate: "2027-05-01" }, NOW)).resolves.toMatchObject({ courseId: null });
    await expect(setGoal(s.learners[1]!, { courseId: s.courseId, ...HSK3 }, NOW)).resolves.toBeTruthy();
  });

  it("chỉ đặt cho khoá mình đang học; người lạ và giáo viên của khoá khác bị từ chối", async () => {
    const s = await setup("lg-enroll");
    const other = await setup("lg-enroll-other");
    await expect(setGoal(s.learners[0]!, { courseId: other.courseId, ...HSK3 }, NOW)).rejects.toMatchObject({ code: "not_enrolled" });
    await expect(setGoal(other.teacher, { userId: s.learners[0]!, courseId: s.courseId, ...HSK3 }, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(setGoal(s.learners[1]!, { userId: s.learners[0]!, courseId: s.courseId, ...HSK3 }, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("giáo viên chỉ dạy: đặt hộ được khi được xếp vào lớp của học viên, không được khi không", async () => {
    const s = await setup("lg-teach");
    const yes = await teachOnly(s, "lg-teach-yes", true);
    const no = await teachOnly(s, "lg-teach-no", false);
    await expect(setGoal(no, { userId: s.learners[0]!, courseId: s.courseId, ...HSK3 }, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(setGoal(yes, { userId: s.learners[0]!, courseId: s.courseId, ...HSK3 }, NOW)).resolves.toMatchObject({ setById: yes });
  });
});

describe("changeGoal và setGoalStatus — lịch sử, không ghi đè âm thầm (C6.7)", () => {
  it("đổi mục tiêu phát goal.changed với giá trị cũ và mới từng trường; không đổi gì thì không phát", async () => {
    const s = await setup("lg-change");
    const me = s.learners[0]!;
    const g = await setGoal(me, { courseId: s.courseId, ...HSK3 }, NOW);
    const same = await changeGoal(me, g.id, { targetLevel: "HSK 3" }, NOW);
    expect(same.updatedAt).toBe(g.updatedAt);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.GoalChanged } })).toBe(0);

    const changed = await changeGoal(me, g.id, { targetLevel: "HSK 4", targetDate: "2027-12-31", hoursPerWeek: null }, NOW);
    expect(changed).toMatchObject({ targetLevel: "HSK 4", targetDate: "2027-12-31", hoursPerWeek: null });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.GoalChanged } });
    expect(ev.payload).toMatchObject({
      goalId: g.id,
      changedById: me,
      changes: { targetLevel: { from: "HSK 3", to: "HSK 4" }, targetDate: { from: "2027-06-30", to: "2027-12-31" }, hoursPerWeek: { from: 4, to: null } },
    });
  });

  it("đổi sang khung khác phải kèm cấp độ hợp lệ của khung đó", async () => {
    const s = await setup("lg-fw");
    const me = s.learners[0]!;
    const g = await setGoal(me, { courseId: s.courseId, ...HSK3 }, NOW);
    await expect(changeGoal(me, g.id, { framework: "IELTS" }, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(changeGoal(me, g.id, { framework: "IELTS", targetLevel: "IELTS 6.0" }, NOW)).resolves.toMatchObject({ framework: "IELTS" });
  });

  it("đổi trạng thái: phát goal.status_changed; theo đuổi lại bị chặn nếu đã có mục tiêu đang theo đuổi khác; mục tiêu đã đóng không sửa được", async () => {
    const s = await setup("lg-status");
    const me = s.learners[0]!;
    const g1 = await setGoal(me, { courseId: s.courseId, ...HSK3 }, NOW);
    await setGoalStatus(me, g1.id, "achieved");
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.GoalStatusChanged } });
    expect(ev.payload).toMatchObject({ goalId: g1.id, from: "active", to: "achieved", changedById: me });
    await expect(changeGoal(me, g1.id, { targetLevel: "HSK 4" }, NOW)).rejects.toMatchObject({ code: "goal_not_active" });

    const g2 = await setGoal(me, { courseId: s.courseId, framework: "HSK", targetLevel: "HSK 4", targetDate: "2028-01-01" }, NOW);
    await expect(setGoalStatus(me, g1.id, "active")).rejects.toMatchObject({ code: "goal_exists" });
    await setGoalStatus(me, g2.id, "archived");
    await expect(setGoalStatus(me, g1.id, "active")).resolves.toMatchObject({ status: "active" });
    // đặt cùng trạng thái: không phát thêm
    const n = await prisma.learningEvent.count({ where: { eventType: LearningEventType.GoalStatusChanged } });
    await setGoalStatus(me, g1.id, "active");
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.GoalStatusChanged } })).toBe(n);
  });

  it("getGoalHistory trả đủ các lần đặt, đổi và đổi trạng thái theo thời gian", async () => {
    const s = await setup("lg-history");
    const me = s.learners[0]!;
    const g = await setGoal(s.teacher, { userId: me, courseId: s.courseId, ...HSK3 }, NOW);
    await changeGoal(me, g.id, { hoursPerWeek: 6 }, NOW);
    await setGoalStatus(me, g.id, "achieved");
    const h = await getGoalHistory(me, g.id);
    expect(h.map((x) => x.kind)).toEqual(["set", "changed", "status_changed"]);
    expect(h[0]).toMatchObject({ byId: s.teacher });
    expect(h[1]!.changes).toEqual({ hoursPerWeek: { from: 4, to: 6 } });
    expect(h[2]).toMatchObject({ from: "active", to: "achieved" });
    // học viên khác không xem được lịch sử
    await expect(getGoalHistory(s.learners[1]!, g.id)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("người khác (học viên cùng lớp) không sửa hay đổi trạng thái được; giáo viên quản khoá được", async () => {
    const s = await setup("lg-authz");
    const g = await setGoal(s.learners[0]!, { courseId: s.courseId, ...HSK3 }, NOW);
    await expect(changeGoal(s.learners[1]!, g.id, { hoursPerWeek: 2 }, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(setGoalStatus(s.learners[1]!, g.id, "archived")).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(changeGoal(s.teacher, g.id, { hoursPerWeek: 2 }, NOW)).resolves.toMatchObject({ hoursPerWeek: 2 });
    await expect(changeGoal(s.learners[0]!, "no-such", {}, NOW)).rejects.toBeInstanceOf(GoalError);
  });
});

describe("xem mục tiêu — chỉ học viên và giáo viên của lớp (C6.6)", () => {
  it("listMyGoals chỉ trả của chính mình; giáo viên xem theo khoá; học viên khác thì không", async () => {
    const s = await setup("lg-view");
    await setGoal(s.learners[0]!, { courseId: s.courseId, ...HSK3 }, NOW);
    await setGoal(s.learners[0]!, { framework: "TOEIC", targetLevel: "TOEIC 700", targetDate: "2027-05-01" }, NOW); // chung
    await setGoal(s.learners[1]!, { courseId: s.courseId, ...HSK3 }, NOW);

    const mine = await listMyGoals(s.learners[0]!);
    expect(mine).toHaveLength(2);
    expect(mine.every((g) => g.userId === s.learners[0])).toBe(true);

    // giáo viên chỉ thấy mục tiêu gắn khoá của mình; mục tiêu chung là riêng của học viên
    const seen = await listLearnerGoals(s.teacher, s.learners[0]!, s.courseId);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.courseId).toBe(s.courseId);
    await expect(listLearnerGoals(s.learners[1]!, s.learners[0]!, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
    const stranger = await makeUser("lg-view-x@e.com", ["instructor"]);
    await expect(listLearnerGoals(stranger, s.learners[0]!, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("giáo viên chỉ dạy chỉ xem được học viên của lớp được xếp", async () => {
    const s = await setup("lg-view-teach");
    await setGoal(s.learners[0]!, { courseId: s.courseId, ...HSK3 }, NOW);
    const yes = await teachOnly(s, "lg-vt-yes", true);
    const no = await teachOnly(s, "lg-vt-no", false);
    await expect(listLearnerGoals(yes, s.learners[0]!, s.courseId)).resolves.toHaveLength(1);
    await expect(listLearnerGoals(no, s.learners[0]!, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("mục tiêu của lớp (C6.4)", () => {
  it("giáo viên quản khoá đặt, đổi, bỏ; phát goal.section_set; người chỉ dạy và học viên không đặt được", async () => {
    const s = await setup("lg-sec");
    const set = await setSectionGoal(s.teacher, s.sectionId, { framework: "HSK", targetLevel: "HSK 1", targetDate: "2027-01-31", hoursPerWeek: 3 }, NOW);
    expect(set).toMatchObject({ sectionId: s.sectionId, targetLevel: "HSK 1", targetDate: "2027-01-31", hoursPerWeek: 3 });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.GoalSectionSet } });
    expect(ev.userId).toBe(s.teacher);
    expect(ev.payload).toMatchObject({ sectionId: s.sectionId, targetLevel: "HSK 1" });

    await expect(setSectionGoal(s.learners[0]!, s.sectionId, { framework: "HSK", targetLevel: "HSK 2" }, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    const teach = await teachOnly(s, "lg-sec-teach", true);
    await expect(setSectionGoal(teach, s.sectionId, { framework: "HSK", targetLevel: "HSK 2" }, NOW)).rejects.toBeInstanceOf(CourseAuthzError);

    expect(await setSectionGoal(s.teacher, s.sectionId, null, NOW)).toBeNull();
    expect(await prisma.sectionGoal.count({ where: { sectionId: s.sectionId } })).toBe(0);
  });

  it("học viên mới vào lớp thấy mục tiêu lớp làm gợi ý; chưa có mục tiêu riêng thì mục tiêu hiệu lực là của lớp", async () => {
    const s = await setup("lg-sec-eff");
    await setSectionGoal(s.teacher, s.sectionId, { framework: "HSK", targetLevel: "HSK 1", targetDate: "2027-01-31", hoursPerWeek: 3 }, NOW);
    const eff = await getEffectiveGoal(s.learners[0]!, s.courseId);
    expect(eff).toMatchObject({ source: "section", goal: { framework: "HSK", targetLevel: "HSK 1", targetDate: "2027-01-31", hoursPerWeek: 3 } });

    const late = await makeUser("lg-sec-eff-late@e.com");
    await prisma.enrollment.create({ data: { userId: late, courseId: s.courseId, sectionId: s.sectionId, courseVersion: 1 } });
    expect((await getEffectiveGoal(late, s.courseId)).source).toBe("section");
  });

  it("dùng mục tiêu lớp thành mục tiêu riêng (người đặt là học viên); mục tiêu riêng thắng; đặt lại mục tiêu lớp không đổi mục tiêu riêng", async () => {
    const s = await setup("lg-sec-adopt");
    const me = s.learners[0]!;
    await setSectionGoal(s.teacher, s.sectionId, { framework: "HSK", targetLevel: "HSK 1", targetDate: "2027-01-31", hoursPerWeek: 3 }, NOW);
    const mine = await adoptSectionGoal(me, s.courseId, {}, NOW);
    expect(mine).toMatchObject({ userId: me, setById: me, targetLevel: "HSK 1", targetDate: "2027-01-31", hoursPerWeek: 3 });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.GoalSet } });
    expect(ev.payload).toMatchObject({ fromSection: true });

    await setSectionGoal(s.teacher, s.sectionId, { framework: "HSK", targetLevel: "HSK 2", targetDate: "2027-06-30" }, NOW);
    const eff = await getEffectiveGoal(me, s.courseId);
    expect(eff).toMatchObject({ source: "personal", goal: { targetLevel: "HSK 1" } });
    await expect(adoptSectionGoal(me, s.courseId, {}, NOW)).rejects.toMatchObject({ code: "goal_exists" });
  });

  it("mục tiêu lớp không có hạn thì khi dùng phải nhập hạn; chưa có mục tiêu lớp thì báo no_section_goal", async () => {
    const s = await setup("lg-sec-nodate");
    await expect(adoptSectionGoal(s.learners[0]!, s.courseId, {}, NOW)).rejects.toMatchObject({ code: "no_section_goal" });
    await setSectionGoal(s.teacher, s.sectionId, { framework: "CEFR", targetLevel: "CEFR A2" }, NOW);
    await expect(adoptSectionGoal(s.learners[0]!, s.courseId, {}, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(adoptSectionGoal(s.learners[0]!, s.courseId, { targetDate: "2027-05-01" }, NOW)).resolves.toMatchObject({ targetLevel: "CEFR A2", targetDate: "2027-05-01" });
  });

  it("listSectionLearnerGoals: giáo viên thấy từng học viên kèm mục tiêu riêng đang theo đuổi", async () => {
    const s = await setup("lg-sec-list");
    await setGoal(s.learners[0]!, { courseId: s.courseId, ...HSK3 }, NOW);
    const rows = await listSectionLearnerGoals(s.teacher, s.sectionId);
    expect(rows).toHaveLength(3);
    const byId = new Map(rows.map((r) => [r.userId, r]));
    expect(byId.get(s.learners[0]!)!.goal).toMatchObject({ targetLevel: "HSK 3" });
    expect(byId.get(s.learners[1]!)!.goal).toBeNull();
    const stranger = await makeUser("lg-sec-list-x@e.com", ["instructor"]);
    await expect(listSectionLearnerGoals(stranger, s.sectionId)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});
