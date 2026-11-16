import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  COURSE_PLAN_MAX_SESSIONS,
  clearCourseSessionPlan,
  getCourseSessionPlan,
  saveCourseSessionPlan,
} from "../courseSessionPlan";
import { MEETING_PLAN_MAX_LESSONS, resetMeetingPlan, setMeetingPlan } from "../meetingPlan";
import { cancelMeeting, listLearnerMeetings, listTeacherMeetings } from "../classSchedule";
import { closeMeeting } from "../meetingSummary";
import { duplicateCourse } from "../courses";
import { deleteLesson } from "../lessons";
import { CourseAuthzError } from "../authz";
import { isLearnerActivityType } from "../../learning/activity";
import { AFTER_M1, makeUser, setup, type Setup } from "./meetingFixture";

/**
 * CENTER K — Phân phối chương trình (docs/CENTER-schedule-attendance-AC.md, mục K). Khoá mẫu: 3 chương gắn buổi 1..3, mỗi
 * chương 2 bài (lessons[0..5]); lớp 3 buổi.
 */
const RANGE = { from: "2026-11-01", to: "2026-12-31" };

const teacherPlan = async (s: Setup, i: number) => (await listTeacherMeetings(s.teacher, RANGE)).find((m) => m.id === s.meetings[i]!.id)!.plan;
const lessonIds = (p: { lessons: Array<{ id: string }> } | null | undefined) => p?.lessons.map((l) => l.id) ?? null;

async function teachOnly(s: Setup, tag: string) {
  const u = await makeUser(`csp-${tag}@e.com`, ["center_teacher"]);
  await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: u, role: "non-editing-teacher" } });
  await prisma.classMeeting.updateMany({ where: { sectionId: s.sectionId }, data: { plannedTeacherId: u } });
  return u;
}

describe("xem bảng khi khoá chưa có phân phối", () => {
  it("khoá có chương đánh số: trả giáo án theo chương, chủ đề là tên chương; khoá không có gì: trống", async () => {
    const s = await setup("csp-view");
    const v = await getCourseSessionPlan(s.teacher, s.courseId);
    expect(v).toMatchObject({ source: "chapters", editable: true, unplannedLessons: 0 });
    expect(v.sessions.map((x) => [x.sessionNo, x.topic, x.lessons.length])).toEqual([
      [1, "Buổi 1: Chủ đề 1", 2],
      [2, "Buổi 2: Chủ đề 2", 2],
      [3, "Buổi 3: Chủ đề 3", 2],
    ]);
    const empty = await setup("csp-view-none", { withPlan: false });
    expect(await getCourseSessionPlan(empty.teacher, empty.courseId)).toMatchObject({ source: "none", sessions: [] });
  });
});

describe("saveCourseSessionPlan — mọi lớp theo bảng (K1, K4)", () => {
  it("buổi số N của lớp hiện bài của dòng N; tên giáo án là chủ đề; khoá có bảng thì không dùng chương", async () => {
    const s = await setup("csp-save");
    const L = s.lessons;
    const v = await saveCourseSessionPlan(s.teacher, s.courseId, {
      sessions: [{ topic: "  Chào hỏi ", lessonIds: [L[0], L[2]] }, { lessonIds: [L[1]] }],
    });
    expect(v).toMatchObject({ source: "plan", unplannedLessons: 3 });
    expect(v.sessions[0]).toMatchObject({ sessionNo: 1, topic: "Chào hỏi" });
    expect(v.sessions[1]).toMatchObject({ sessionNo: 2, topic: null });

    expect(await teacherPlan(s, 0)).toMatchObject({ title: "Chào hỏi", customized: false, sessionNo: 1 });
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([L[0], L[2]]);
    expect(lessonIds(await teacherPlan(s, 1))).toEqual([L[1]]);
    // Buổi 3: bảng chỉ có 2 dòng → không có giáo án, KHÔNG rơi về chương 3.
    expect(await teacherPlan(s, 2)).toBeNull();
  });

  it("học viên không thấy bài hoặc chương ẩn; giáo viên thấy", async () => {
    const s = await setup("csp-hidden");
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0], s.lessons[4]] }] });
    await prisma.lesson.update({ where: { id: s.lessons[4]! }, data: { isHidden: true } });
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([s.lessons[0], s.lessons[4]]);
    const mine = (await listLearnerMeetings(s.learners[0]!, RANGE)).find((m) => m.id === s.meetings[0]!.id)!;
    expect(lessonIds(mine.plan)).toEqual([s.lessons[0]]);
    const view = await getCourseSessionPlan(s.teacher, s.courseId);
    expect(view.sessions[0]!.lessons[1]).toMatchObject({ id: s.lessons[4], hidden: true });
  });

  it("huỷ buổi thì giáo án dịch theo số buổi", async () => {
    const s = await setup("csp-cancel");
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0]] }, { lessonIds: [s.lessons[1]] }] });
    await cancelMeeting(s.teacher, s.meetings[0]!.id, { reason: "Nghỉ lễ" });
    // Buổi thứ hai theo thời gian giờ là buổi số 1.
    expect(lessonIds(await teacherPlan(s, 1))).toEqual([s.lessons[0]]);
  });

  it("lưu lại thì thay toàn bộ bảng", async () => {
    const s = await setup("csp-replace");
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0]] }, { lessonIds: [s.lessons[1]] }] });
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[5]] }] });
    expect(await prisma.courseSession.count({ where: { courseId: s.courseId } })).toBe(1);
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([s.lessons[5]]);
    expect(await teacherPlan(s, 1)).toBeNull();
  });
});

describe("kế hoạch riêng của buổi vẫn thắng (K5)", () => {
  it("buổi đã chỉnh riêng giữ bài đã chọn; 'Đặt lại' đưa buổi về bảng phân phối", async () => {
    const s = await setup("csp-custom");
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[3]!] });
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0], s.lessons[1]] }] });
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([s.lessons[3]]);
    const reset = await resetMeetingPlan(s.teacher, s.meetings[0]!.id);
    expect(reset.lessons.map((l) => l.id)).toEqual([s.lessons[0], s.lessons[1]]);
    expect(await teacherPlan(s, 0)).toMatchObject({ customized: false });
  });
});

describe("buổi đã kết thúc không đổi ngược (K6, K7)", () => {
  it("lưu bảng: buổi đã kết thúc còn theo mặc định được chụp lại giáo án cũ; buổi chưa kết thúc theo bảng mới", async () => {
    const s = await setup("csp-freeze");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[4]] }, { lessonIds: [s.lessons[5]] }] });

    // Buổi 1 đã kết thúc: vẫn là chương 1 (Từ vựng 1, Hội thoại 1), chủ đề cũ.
    expect(await teacherPlan(s, 0)).toMatchObject({ customized: true, title: "Buổi 1: Chủ đề 1" });
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([s.lessons[0], s.lessons[1]]);
    expect(lessonIds(await teacherPlan(s, 1))).toEqual([s.lessons[5]]);

    // Xoá bảng: buổi 1 vẫn giữ, buổi 2 quay về chương 2.
    const cleared = await clearCourseSessionPlan(s.teacher, s.courseId);
    expect(cleared.source).toBe("chapters");
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([s.lessons[0], s.lessons[1]]);
    expect(lessonIds(await teacherPlan(s, 1))).toEqual([s.lessons[2], s.lessons[3]]);
  });

  it("sự kiện course.session_plan.updated chỉ mang id và số đếm; không tính là hoạt động học", async () => {
    const s = await setup("csp-event");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ topic: "Bí mật", lessonIds: [s.lessons[0], s.lessons[1]] }, { lessonIds: [s.lessons[2]] }] });
    await clearCourseSessionPlan(s.teacher, s.courseId);
    await clearCourseSessionPlan(s.teacher, s.courseId); // không có bảng thì không phát thêm
    const evs = await prisma.learningEvent.findMany({
      where: { eventType: LearningEventType.CourseSessionPlanUpdated, courseId: s.courseId },
      orderBy: { id: "asc" },
    });
    expect(evs.map((e) => e.payload)).toEqual([
      { courseId: s.courseId, sessions: 2, lessons: 3, frozenMeetings: 1, cleared: false },
      { courseId: s.courseId, sessions: 0, lessons: 0, frozenMeetings: 0, cleared: true },
    ]);
    expect(JSON.stringify(evs.map((e) => e.payload))).not.toContain("Bí mật");
    expect(isLearnerActivityType(LearningEventType.CourseSessionPlanUpdated)).toBe(false);
  });
});

describe("ràng buộc (K3)", () => {
  it("bài phải thuộc khoá; một bài một lần mỗi buổi nhưng được ở nhiều buổi; giới hạn số bài và số buổi", async () => {
    const s = await setup("csp-valid");
    const other = await setup("csp-valid-other");
    await expect(saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [other.lessons[0]] }] })).rejects.toMatchObject({ code: "lesson_not_in_course" });
    await expect(saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0], s.lessons[0]] }] })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [] })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ topic: "x".repeat(121), lessonIds: [] }] })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: Array.from({ length: MEETING_PLAN_MAX_LESSONS + 1 }, (_, i) => `x${i}`) }] }),
    ).rejects.toMatchObject({ code: "too_many_lessons" });
    await expect(
      saveCourseSessionPlan(s.teacher, s.courseId, { sessions: Array.from({ length: COURSE_PLAN_MAX_SESSIONS + 1 }, () => ({ lessonIds: [] })) }),
    ).rejects.toMatchObject({ code: "too_many_sessions" });
    const ok = await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0]] }, { lessonIds: [s.lessons[0]] }, { lessonIds: [] }] });
    expect(ok.sessions.map((x) => x.lessons.length)).toEqual([1, 1, 0]);
  });
});

describe("quyền (K8)", () => {
  it("người chỉ dạy xem được (không sửa được); người lạ và học viên bị chặn", async () => {
    const s = await setup("csp-authz");
    const t = await teachOnly(s, "authz-t");
    expect(await getCourseSessionPlan(t, s.courseId)).toMatchObject({ editable: false, source: "chapters" });
    await expect(saveCourseSessionPlan(t, s.courseId, { sessions: [{ lessonIds: [] }] })).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(clearCourseSessionPlan(t, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
    const stranger = await makeUser("csp-authz-x@e.com", ["instructor"]);
    await expect(getCourseSessionPlan(stranger, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getCourseSessionPlan(s.learners[0]!, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
    expect(await prisma.courseSession.count({ where: { courseId: s.courseId } })).toBe(0);
  });
});

describe("sao khoá và xoá bài (K9)", () => {
  it("Duplicate mang bảng sang bản sao, trỏ đúng bài của bản sao", async () => {
    const s = await setup("csp-dup");
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ topic: "Mở đầu", lessonIds: [s.lessons[2], s.lessons[0]] }, { lessonIds: [] }] });
    const { courseId } = await duplicateCourse(s.teacher, s.courseId);
    const v = await getCourseSessionPlan(s.teacher, courseId);
    expect(v.source).toBe("plan");
    expect(v.sessions.map((x) => [x.topic, x.lessons.map((l) => l.title)])).toEqual([
      ["Mở đầu", ["Từ vựng 2", "Từ vựng 1"]],
      [null, []],
    ]);
    const copyLessons = await prisma.lesson.findMany({ where: { module: { courseId } }, select: { id: true } });
    expect(v.sessions[0]!.lessons.every((l) => copyLessons.some((c) => c.id === l.id))).toBe(true);
  });

  it("xoá bài khỏi khoá thì bài biến khỏi bảng", async () => {
    const s = await setup("csp-del");
    await saveCourseSessionPlan(s.teacher, s.courseId, { sessions: [{ lessonIds: [s.lessons[0], s.lessons[1]] }] });
    await deleteLesson(s.teacher, s.lessons[1]!);
    expect(lessonIds(await teacherPlan(s, 0))).toEqual([s.lessons[0]]);
  });
});
