import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  MEETING_PLAN_MAX_LESSONS,
  MEETING_PLAN_TOPIC_MAX,
  MeetingPlanError,
  addMeetingPlanLessons,
  getMeetingPlan,
  resetMeetingPlan,
  setMeetingPlan,
} from "../meetingPlan";
import { cancelMeeting, listLearnerMeetings, listTeacherMeetings } from "../classSchedule";
import { closeMeeting } from "../meetingSummary";
import { CourseAuthzError } from "../authz";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { AFTER_M1, BEFORE, makeUser, setup, type Setup } from "./meetingFixture";

const RANGE = { from: "2026-11-01", to: "2026-12-31" };

/** Người chỉ dạy (giảng viên trung tâm), có thể được xếp vào lớp. */
async function teachOnly(s: Setup, tag: string, assigned: boolean) {
  const u = await makeUser(`mp-${tag}@e.com`, ["center_teacher"]);
  await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: u, role: "non-editing-teacher" } });
  if (assigned) await prisma.classMeeting.updateMany({ where: { sectionId: s.sectionId }, data: { plannedTeacherId: u } });
  return u;
}

const titles = async (teacher: string, meetingId: string) => {
  const m = (await listTeacherMeetings(teacher, RANGE)).find((x) => x.id === meetingId)!;
  return { plan: m.plan, titles: m.plan?.lessons.map((l) => l.title) ?? null };
};

describe("kế hoạch mặc định theo giáo trình (J4 — trước khi tuỳ chỉnh)", () => {
  it("buổi chưa tuỳ chỉnh lấy bài của chương cùng số buổi và không đánh dấu tuỳ chỉnh", async () => {
    const s = await setup("mp-default");
    const v = await getMeetingPlan(s.teacher, s.meetings[0]!.id);
    expect(v).toMatchObject({ customized: false, topic: null, editable: true });
    expect(v.lessons.map((l) => l.title)).toEqual(["Từ vựng 1", "Hội thoại 1"]);
    expect(v.lessons[0]).toMatchObject({ moduleTitle: "Buổi 1: Chủ đề 1", hidden: false });
  });
});

describe("addMeetingPlanLessons — thêm bài vào buổi (J2, J3, J4)", () => {
  it("lần đầu sửa chép danh sách mặc định rồi thêm; chuyển sang 'đã tuỳ chỉnh'; thứ tự: cũ trước, mới sau", async () => {
    const s = await setup("mp-add");
    const view = await addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[2]!]);
    expect(view.customized).toBe(true);
    expect(view.lessons.map((l) => l.title)).toEqual(["Từ vựng 1", "Hội thoại 1", "Từ vựng 2"]);

    const { plan } = await titles(s.teacher, s.meetings[0]!.id);
    expect(plan).toMatchObject({ customized: true });
    expect(plan!.lessons.map((l) => l.id)).toEqual([s.lessons[0], s.lessons[1], s.lessons[2]]);
    expect(await prisma.classMeetingLesson.count({ where: { meetingId: s.meetings[0]!.id } })).toBe(3);
  });

  it("một bài chỉ một lần trong một buổi (thêm trùng bị bỏ qua); cùng bài được ở nhiều buổi", async () => {
    const s = await setup("mp-dup");
    await addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[2]!]);
    const again = await addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[2]!, s.lessons[0]!]);
    expect(again.lessons.map((l) => l.id)).toEqual([s.lessons[0], s.lessons[1], s.lessons[2]]);
    // buổi khác dùng lại bài 1 (ôn tập)
    const other = await addMeetingPlanLessons(s.teacher, s.meetings[1]!.id, [s.lessons[0]!]);
    expect(other.lessons.map((l) => l.id)).toContain(s.lessons[0]);
  });

  it("bài của khoá khác bị từ chối; bài ẩn thêm được nhưng học viên không thấy", async () => {
    const s = await setup("mp-scope");
    const other = await setup("mp-scope-other");
    await expect(addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [other.lessons[0]!])).rejects.toMatchObject({ code: "lesson_not_in_course" });
    await expect(addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, ["no-such-lesson"])).rejects.toMatchObject({ code: "lesson_not_in_course" });

    await prisma.lesson.update({ where: { id: s.lessons[4]! }, data: { isHidden: true } });
    const view = await addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[4]!]);
    expect(view.lessons.find((l) => l.id === s.lessons[4])).toMatchObject({ hidden: true });
    const mine = (await listLearnerMeetings(s.learners[0]!, RANGE)).find((m) => m.id === s.meetings[0]!.id)!;
    expect(mine.plan!.lessons.map((l) => l.id)).not.toContain(s.lessons[4]);
    expect(mine.plan!.lessons.map((l) => l.id)).toEqual([s.lessons[0], s.lessons[1]]);
  });

  it(`tối đa ${MEETING_PLAN_MAX_LESSONS} bài mỗi buổi`, async () => {
    const s = await setup("mp-max", { withPlan: false });
    const mod = await createModule(s.teacher, s.courseId, { title: "Chương lớn", orderIndex: 0 });
    const ids: string[] = [];
    for (let i = 0; i < MEETING_PLAN_MAX_LESSONS + 1; i++) ids.push((await createLesson(s.teacher, mod.moduleId, { title: `Bài ${i}`, orderIndex: i })).lessonId);
    await expect(setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: ids })).rejects.toMatchObject({ code: "too_many_lessons" });
    await expect(setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: ids.slice(0, MEETING_PLAN_MAX_LESSONS) })).resolves.toMatchObject({ customized: true });
    await expect(addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [ids[MEETING_PLAN_MAX_LESSONS]!])).rejects.toMatchObject({ code: "too_many_lessons" });
  });
});

describe("khoá tự tạo (không có chương đánh số buổi) — lý do có chức năng này", () => {
  it("kế hoạch mặc định trống; thêm bài thì buổi có giáo án", async () => {
    const s = await setup("mp-own", { withPlan: false });
    const mod = await createModule(s.teacher, s.courseId, { title: "Chương tự tạo", orderIndex: 0 });
    const l = await createLesson(s.teacher, mod.moduleId, { title: "Bài tự soạn", orderIndex: 0 });
    expect((await titles(s.teacher, s.meetings[0]!.id)).plan).toBeNull();
    await addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [l.lessonId]);
    expect((await titles(s.teacher, s.meetings[0]!.id)).titles).toEqual(["Bài tự soạn"]);
  });
});

describe("setMeetingPlan — thay thế, đổi thứ tự, bỏ bài, chủ đề (J2, J4)", () => {
  it("thay danh sách đúng thứ tự; bỏ hết bài thì buổi trống và KHÔNG quay về giáo trình", async () => {
    const s = await setup("mp-set");
    const v = await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[3]!, s.lessons[0]!], topic: "  Ôn tập giữa kỳ " });
    expect(v).toMatchObject({ customized: true, topic: "Ôn tập giữa kỳ" });
    expect(v.lessons.map((l) => l.id)).toEqual([s.lessons[3], s.lessons[0]]);

    const empty = await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [] });
    expect(empty).toMatchObject({ customized: true, topic: null });
    expect(empty.lessons).toEqual([]);
    const { plan } = await titles(s.teacher, s.meetings[0]!.id);
    expect(plan).toMatchObject({ customized: true, lessons: [] }); // không rơi về chương 1
  });

  it("kiểm giá trị: trùng bài trong danh sách, chủ đề quá dài", async () => {
    const s = await setup("mp-valid");
    await expect(setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[0]!, s.lessons[0]!] })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [], topic: "x".repeat(MEETING_PLAN_TOPIC_MAX + 1) })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: "nope" } as never)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("chủ đề trở thành tên giáo án của buổi", async () => {
    const s = await setup("mp-topic");
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[0]!], topic: "Chào hỏi nâng cao" });
    expect((await titles(s.teacher, s.meetings[0]!.id)).plan!.title).toBe("Chào hỏi nâng cao");
  });
});

describe("resetMeetingPlan — đặt lại theo giáo trình", () => {
  it("xoá danh sách riêng và chủ đề, quay về chương cùng số buổi", async () => {
    const s = await setup("mp-reset");
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[5]!], topic: "Khác" });
    const v = await resetMeetingPlan(s.teacher, s.meetings[0]!.id);
    expect(v).toMatchObject({ customized: false, topic: null });
    expect(v.lessons.map((l) => l.title)).toEqual(["Từ vựng 1", "Hội thoại 1"]);
    expect(await prisma.classMeetingLesson.count({ where: { meetingId: s.meetings[0]!.id } })).toBe(0);
  });
});

describe("quyền (J1)", () => {
  it("người quản khoá sửa; người chỉ dạy xem được buổi của mình nhưng không sửa; học viên và người lạ không sửa", async () => {
    const s = await setup("mp-authz");
    const yes = await teachOnly(s, "yes", true);
    const no = await teachOnly(s, "no", false);
    const stranger = await makeUser("mp-authz-x@e.com", ["instructor"]);
    const mid = s.meetings[0]!.id;

    await expect(getMeetingPlan(yes, mid)).resolves.toMatchObject({ editable: false });
    await expect(getMeetingPlan(no, mid)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getMeetingPlan(stranger, mid)).rejects.toBeInstanceOf(CourseAuthzError);
    for (const who of [yes, no, stranger, s.learners[0]!]) {
      await expect(addMeetingPlanLessons(who, mid, [s.lessons[2]!])).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(setMeetingPlan(who, mid, { lessonIds: [] })).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(resetMeetingPlan(who, mid)).rejects.toBeInstanceOf(CourseAuthzError);
    }
    expect(await prisma.classMeeting.findUniqueOrThrow({ where: { id: mid } })).toMatchObject({ planCustomized: false });
    await expect(getMeetingPlan(s.teacher, "no-such")).rejects.toMatchObject({ code: "meeting_not_found" });
  });
});

describe("khoá sau khi kết thúc hoặc huỷ (J6)", () => {
  it("đã kết thúc → meeting_locked; đã huỷ → meeting_locked; qua giờ nhưng chưa kết thúc vẫn sửa được", async () => {
    const s = await setup("mp-lock");
    // buổi 1 đã qua giờ nhưng chưa kết thúc: vẫn sửa
    await expect(addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[2]!])).resolves.toMatchObject({ customized: true });
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    for (const op of [
      () => addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[3]!]),
      () => setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [] }),
      () => resetMeetingPlan(s.teacher, s.meetings[0]!.id),
    ]) await expect(op()).rejects.toMatchObject({ code: "meeting_locked" });
    // vẫn xem được
    await expect(getMeetingPlan(s.teacher, s.meetings[0]!.id)).resolves.toMatchObject({ editable: false });

    await cancelMeeting(s.teacher, s.meetings[2]!.id, { reason: "Nghỉ lễ" }, prisma);
    await expect(addMeetingPlanLessons(s.teacher, s.meetings[2]!.id, [s.lessons[0]!])).rejects.toMatchObject({ code: "meeting_locked" });
  });
});

describe("buổi dạy bù (J5)", () => {
  it("buổi chưa có số thứ tự cũng có kế hoạch riêng", async () => {
    const s = await setup("mp-makeup");
    const mk = await prisma.classMeeting.create({
      data: { sectionId: s.sectionId, seq: null, startsAt: new Date("2026-11-21T11:30:00.000Z"), endsAt: new Date("2026-11-21T13:30:00.000Z"), locked: true },
    });
    expect((await getMeetingPlan(s.teacher, mk.id)).lessons).toEqual([]);
    await addMeetingPlanLessons(s.teacher, mk.id, [s.lessons[1]!]);
    expect((await titles(s.teacher, mk.id)).titles).toEqual(["Hội thoại 1"]);
  });
});

describe("huỷ buổi không làm lệch (J8)", () => {
  it("buổi đã tuỳ chỉnh giữ nguyên bài khi số buổi đổi; buổi theo giáo trình dịch theo số", async () => {
    const s = await setup("mp-shift");
    await setMeetingPlan(s.teacher, s.meetings[1]!.id, { lessonIds: [s.lessons[5]!] }); // buổi 2 tuỳ chỉnh
    await cancelMeeting(s.teacher, s.meetings[0]!.id, { reason: "Nghỉ" }, prisma); // buổi 2 thành số 1

    const ms = (await listTeacherMeetings(s.teacher, RANGE)).filter((m) => m.status !== "cancelled");
    expect(ms.map((m) => m.seq)).toEqual([1, 2]);
    expect(ms[0]!.id).toBe(s.meetings[1]!.id);
    expect(ms[0]!.plan!.lessons.map((l) => l.id)).toEqual([s.lessons[5]]); // giữ nguyên bài đã chọn
    expect(ms[1]!.id).toBe(s.meetings[2]!.id);
    expect(ms[1]!.plan!.lessons.map((l) => l.title)).toEqual(["Từ vựng 2", "Hội thoại 2"]); // theo giáo trình: dịch theo số
  });
});

describe("mọi nơi dùng kế hoạch hiệu lực (J7)", () => {
  it("tổng kết khi kết thúc buổi lấy bài, từ vựng, bài tập của kế hoạch tuỳ chỉnh; tên buổi theo chủ đề", async () => {
    const s = await setup("mp-summary");
    // thay bằng bài 1 của chương 3 (không có từ vựng/bài tập) → tổng kết không còn từ vựng/bài tập của chương 1
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[4]!], topic: "Ôn các con số" });
    const res = await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    expect(res.summary).toMatchObject({ planTitle: "Ôn các con số", lessons: [{ title: "Từ vựng 3" }], vocab: [], homework: [] });
  });

  it("kế hoạch tuỳ chỉnh mang từ vựng và bài tập của bài được chọn; buổi sau lấy đúng giáo án của nó", async () => {
    const s = await setup("mp-summary2");
    // buổi 2 chọn bài 1 của chương 1 (có từ vựng và bài tập về nhà)
    await setMeetingPlan(s.teacher, s.meetings[1]!.id, { lessonIds: [s.lessons[0]!] });
    const res = await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    // buổi sau đã tuỳ chỉnh và không đặt chủ đề thì chưa có tên giáo án (không mượn tên chương của giáo trình)
    expect(res.summary.next).toMatchObject({ seq: 2, planTitle: null });
    const closed2 = await closeMeeting(s.teacher, s.meetings[1]!.id, new Date("2026-11-10T14:00:00.000Z"));
    expect(closed2.summary.vocab.map((v) => v.term)).toEqual(["你好", "谢谢"]);
    expect(closed2.summary.homework.map((h) => h.title)).toEqual(["Viết 5 câu chào hỏi"]);
  });

  it("học viên chỉ thấy tên và id bài đã lọc ẩn; chương ẩn cũng bị lọc", async () => {
    const s = await setup("mp-learner");
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[2]!, s.lessons[4]!] });
    await prisma.module.updateMany({ where: { courseId: s.courseId, sessionNo: 3 }, data: { isHidden: true } });
    const mine = (await listLearnerMeetings(s.learners[0]!, RANGE)).find((m) => m.id === s.meetings[0]!.id)!;
    expect(mine.plan!.lessons).toEqual([{ id: s.lessons[2], title: "Từ vựng 2" }]);
    expect(JSON.stringify(mine)).not.toContain("payload");
  });
});

describe("xoá bài khỏi khoá (J10)", () => {
  it("bài bị xoá tự biến khỏi kế hoạch của mọi buổi", async () => {
    const s = await setup("mp-delete");
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[2]!, s.lessons[3]!] });
    await prisma.lesson.delete({ where: { id: s.lessons[2]! } });
    expect((await getMeetingPlan(s.teacher, s.meetings[0]!.id)).lessons.map((l) => l.id)).toEqual([s.lessons[3]]);
  });
});

describe("sự kiện class.plan.changed (J11)", () => {
  it("mang id và số lượng thêm/bỏ, không mang tên bài hay chủ đề; đặt lại có reset = true", async () => {
    const s = await setup("mp-event");
    await addMeetingPlanLessons(s.teacher, s.meetings[0]!.id, [s.lessons[2]!]);
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[2]!], topic: "Chủ đề riêng tư" });
    await resetMeetingPlan(s.teacher, s.meetings[0]!.id);
    const evs = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.ClassPlanChanged, userId: s.teacher }, orderBy: { id: "asc" } });
    expect(evs.map((e) => e.payload)).toEqual([
      { meetingId: s.meetings[0]!.id, sectionId: s.sectionId, courseId: s.courseId, added: 1, removed: 0, reset: false },
      { meetingId: s.meetings[0]!.id, sectionId: s.sectionId, courseId: s.courseId, added: 0, removed: 2, reset: false },
      { meetingId: s.meetings[0]!.id, sectionId: s.sectionId, courseId: s.courseId, added: 2, removed: 1, reset: true },
    ]);
    expect(JSON.stringify(evs.map((e) => e.payload))).not.toContain("riêng tư");
  });

  it("không đổi gì thì không phát sự kiện", async () => {
    const s = await setup("mp-noop");
    await setMeetingPlan(s.teacher, s.meetings[0]!.id, { lessonIds: [s.lessons[0]!, s.lessons[1]!] }); // đúng bằng mặc định
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.ClassPlanChanged } })).toBe(0);
  });
});

it("MeetingPlanError là lỗi có mã", () => {
  expect(new MeetingPlanError("meeting_locked").code).toBe("meeting_locked");
});
