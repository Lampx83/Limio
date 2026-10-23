import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  addMakeupMeeting,
  cancelMeeting,
  ClassScheduleError,
  getClassSchedule,
  listLearnerMeetings,
  listTeacherMeetings,
  setClassSchedule,
  updateMeeting,
} from "../classSchedule";
import { vnDateTime, vnDayKey } from "../classScheduleCalc";
import { createCourseSection } from "../sections";
import { transferEnrollmentSection } from "../sections";
import { CourseAuthzError } from "../authz";
import { createCourse, publishCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createSkill, tagLessonSkill } from "../skills";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";

const BASE = "http://localhost:3000";
// Cố định "bây giờ" để test không phụ thuộc ngày chạy.
const NOW = new Date("2026-10-23T03:00:00.000Z");

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

async function setup(tag: string) {
  const owner = await makeUser(`cs-${tag}-o@e.com`);
  const courseId = await publishedCourse(owner, `cs-${tag}`);
  const section = await createCourseSection(owner, courseId, { name: "Lớp A" });
  return { owner, courseId, sectionId: section.id };
}

const TUE_THU = {
  startDate: "2026-11-03",
  totalMeetings: 24,
  slots: [
    { weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" },
    { weekday: 4, startTime: "18:30", durationMin: 120, room: "B2" },
  ],
};

async function meetingsOf(sectionId: string) {
  return prisma.classMeeting.findMany({ where: { sectionId }, orderBy: { startsAt: "asc" } });
}

describe("setClassSchedule — sinh buổi (C1.1, C1.2, C1.11)", () => {
  it("T3+T5 18:30, 24 buổi: sinh đúng 24 buổi theo thứ tự thời gian, seq 1..24", async () => {
    const { owner, sectionId } = await setup("gen");
    const res = await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    expect(res.created).toBe(24);

    const ms = await meetingsOf(sectionId);
    expect(ms).toHaveLength(24);
    expect(ms.map((m) => m.seq)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(ms[0]!.startsAt.toISOString()).toBe("2026-11-03T11:30:00.000Z");
    expect(vnDayKey(ms[23]!.startsAt)).toBe("2027-01-21");
    expect(ms.every((m) => m.status === "planned" && m.room === "B2")).toBe(true);
  });

  it("hai khung khác giờ trong cùng một tuần: seq vẫn tăng theo thời gian thực", async () => {
    const { owner, sectionId } = await setup("two");
    await setClassSchedule(
      owner,
      sectionId,
      {
        startDate: "2026-11-02",
        totalMeetings: 6,
        slots: [
          { weekday: 5, startTime: "09:00", durationMin: 90 },
          { weekday: 1, startTime: "19:00", durationMin: 90 },
        ],
      },
      prisma,
      NOW,
    );
    const ms = await meetingsOf(sectionId);
    expect(ms.map((m) => vnDayKey(m.startsAt))).toEqual([
      "2026-11-02",
      "2026-11-06",
      "2026-11-09",
      "2026-11-13",
      "2026-11-16",
      "2026-11-20",
    ]);
    expect(ms.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("áp dụng hai lần cùng kế hoạch không tạo trùng và giữ nguyên id buổi (C1.11)", async () => {
    const { owner, sectionId } = await setup("idem");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const before = await meetingsOf(sectionId);
    const again = await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const after = await meetingsOf(sectionId);

    expect(again.created).toBe(0);
    expect(again.removed).toBe(0);
    expect(after.map((m) => m.id)).toEqual(before.map((m) => m.id));
    expect(await prisma.classSchedule.count({ where: { sectionId } })).toBe(1);
  });

  it("phát event class.schedule.set với số liệu, không mang tên học viên", async () => {
    const { owner, sectionId } = await setup("evt");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ev = await prisma.learningEvent.findFirst({ where: { eventType: "class.schedule.set", userId: owner } });
    expect(ev).not.toBeNull();
    expect(ev!.payload).toMatchObject({ sectionId, totalMeetings: 24, slotCount: 2, created: 24 });
  });
});

describe("setClassSchedule — đổi kế hoạch (C1.3)", () => {
  it("chỉ sinh lại buổi chưa diễn ra; buổi đã dạy và buổi quá khứ giữ nguyên", async () => {
    const { owner, sectionId } = await setup("regen");
    const plan = {
      startDate: "2026-01-06", // thứ ba
      totalMeetings: 8,
      slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" }],
    };
    // "Bây giờ" là 2026-01-27 12:00 VN: buổi 1..3 (06, 13, 20/01) đã qua, buổi 4 (27/01 18:30) chưa.
    const now = vnDateTime("2026-01-27", "12:00");
    await setClassSchedule(owner, sectionId, plan, prisma, now);
    const before = await meetingsOf(sectionId);
    expect(before).toHaveLength(8);

    // Buổi 2 đã dạy xong.
    await prisma.classMeeting.update({ where: { id: before[1]!.id }, data: { status: "held" } });

    // Đổi sang thứ năm 19:00, phòng C3.
    await setClassSchedule(
      owner,
      sectionId,
      { ...plan, slots: [{ weekday: 4, startTime: "19:00", durationMin: 90, room: "C3" }] },
      prisma,
      now,
    );
    const after = await meetingsOf(sectionId);

    // 3 buổi đã qua (06, 13, 20/01) giữ nguyên thứ ba, phòng B2.
    const past = after.slice(0, 3);
    expect(past.map((m) => vnDayKey(m.startsAt))).toEqual(["2026-01-06", "2026-01-13", "2026-01-20"]);
    expect(past.every((m) => m.room === "B2")).toBe(true);
    expect(past[1]!.status).toBe("held");
    expect(past.map((m) => m.id)).toEqual(before.slice(0, 3).map((m) => m.id));

    // Phần còn lại chuyển sang thứ năm 19:00 phòng C3, đủ tổng 8 buổi.
    const future = after.slice(3);
    expect(future).toHaveLength(5);
    expect(future.every((m) => m.room === "C3" && isoThu(m.startsAt))).toBe(true);
    expect(after.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

function isoThu(d: Date) {
  return new Date(`${vnDayKey(d)}T00:00:00Z`).getUTCDay() === 4;
}

describe("huỷ buổi và dạy bù (C1.4, C1.5)", () => {
  it("huỷ một buổi: status cancelled, seq null, các buổi sau lùi số, buổi vẫn hiện, có event", async () => {
    const { owner, sectionId } = await setup("cancel");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);

    await cancelMeeting(owner, ms[4]!.id, { reason: "Giáo viên ốm" }, prisma);

    const after = await meetingsOf(sectionId);
    expect(after).toHaveLength(24);
    const cancelled = after.find((m) => m.id === ms[4]!.id)!;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.seq).toBeNull();
    expect(cancelled.cancelReason).toBe("Giáo viên ốm");
    // Buổi liền sau (trước đó là 6) giờ là buổi 5; buổi cuối còn 23.
    expect(after[5]!.seq).toBe(5);
    expect(Math.max(...after.map((m) => m.seq ?? 0))).toBe(23);

    const ev = await prisma.learningEvent.findFirst({ where: { eventType: "class.meeting.cancelled" } });
    expect(ev!.payload).toMatchObject({ meetingId: ms[4]!.id, sectionId });
    // Payload không mang chữ lý do.
    expect(JSON.stringify(ev!.payload)).not.toContain("ốm");
  });

  it("lý do trống thì bị từ chối", async () => {
    const { owner, sectionId } = await setup("cancel-empty");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const [first] = await meetingsOf(sectionId);
    await expect(cancelMeeting(owner, first!.id, { reason: "   " }, prisma)).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("huỷ lại buổi đã huỷ, hoặc huỷ buổi đã dạy, đều bị từ chối", async () => {
    const { owner, sectionId } = await setup("cancel-twice");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    await cancelMeeting(owner, ms[0]!.id, { reason: "Nghỉ" }, prisma);
    await expect(cancelMeeting(owner, ms[0]!.id, { reason: "Nghỉ" }, prisma)).rejects.toMatchObject({
      code: "already_cancelled",
    });
    await prisma.classMeeting.update({ where: { id: ms[1]!.id }, data: { status: "held" } });
    await expect(cancelMeeting(owner, ms[1]!.id, { reason: "Nghỉ" }, prisma)).rejects.toMatchObject({
      code: "meeting_not_editable",
    });
  });

  it("buổi dạy bù chen vào đúng vị trí theo thời gian và nhận số thứ tự tương ứng", async () => {
    const { owner, sectionId } = await setup("makeup");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    await cancelMeeting(owner, ms[1]!.id, { reason: "Mưa bão" }, prisma); // thứ năm 05/11

    // Dạy bù vào thứ bảy 07/11 10:00 — nằm giữa buổi cũ thứ 1 (03/11) và buổi 10/11.
    const { meeting } = await addMakeupMeeting(
      owner,
      sectionId,
      { startsAt: vnDateTime("2026-11-07", "10:00").toISOString(), durationMin: 120, room: "B2", makeupOfId: ms[1]!.id },
      prisma,
    );
    expect(meeting.makeupOfId).toBe(ms[1]!.id);
    expect(meeting.locked).toBe(true);
    expect(meeting.seq).toBe(2); // ngay sau buổi 03/11

    const after = await meetingsOf(sectionId);
    expect(after).toHaveLength(25);
    expect(Math.max(...after.map((m) => m.seq ?? 0))).toBe(24); // đủ 24 buổi học thật

    const ev = await prisma.learningEvent.findFirst({ where: { eventType: "class.meeting.makeup_added" } });
    expect(ev!.payload).toMatchObject({ meetingId: meeting.id, makeupOfId: ms[1]!.id });
  });

  it("dạy bù cho buổi chưa huỷ, hoặc buổi của lớp khác, bị từ chối", async () => {
    const { owner, courseId, sectionId } = await setup("makeup-bad");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    const when = vnDateTime("2026-11-07", "10:00").toISOString();

    await expect(
      addMakeupMeeting(owner, sectionId, { startsAt: when, durationMin: 60, makeupOfId: ms[0]!.id }, prisma),
    ).rejects.toMatchObject({ code: "makeup_of_invalid" });

    const other = await createCourseSection(owner, courseId, { name: "Lớp B" });
    await setClassSchedule(owner, other.id, TUE_THU, prisma, NOW);
    const otherMs = await meetingsOf(other.id);
    await cancelMeeting(owner, otherMs[0]!.id, { reason: "Nghỉ" }, prisma);
    await expect(
      addMakeupMeeting(owner, sectionId, { startsAt: when, durationMin: 60, makeupOfId: otherMs[0]!.id }, prisma),
    ).rejects.toMatchObject({ code: "makeup_of_invalid" });
  });

  it("áp lại kế hoạch sau khi huỷ giữ buổi huỷ và dạy bù, và bù đủ tổng số buổi ở cuối", async () => {
    const { owner, sectionId } = await setup("regen-cancel");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    await cancelMeeting(owner, ms[3]!.id, { reason: "Nghỉ lễ" }, prisma);

    const res = await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    expect(res.created).toBe(1); // một buổi thay thế ở cuối

    const after = await meetingsOf(sectionId);
    expect(after.filter((m) => m.status === "cancelled")).toHaveLength(1);
    expect(after.filter((m) => m.status !== "cancelled")).toHaveLength(24);
    expect(Math.max(...after.map((m) => m.seq ?? 0))).toBe(24);
  });
});

describe("sửa một buổi lẻ (C1.6, C1.8)", () => {
  it("đổi phòng/giờ chỉ đổi buổi đó, khoá nó, và áp lại kế hoạch không ghi đè", async () => {
    const { owner, sectionId } = await setup("edit");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    const target = ms[2]!;

    const { meeting } = await updateMeeting(owner, target.id, { room: "Phòng đặc biệt" }, prisma);
    expect(meeting.room).toBe("Phòng đặc biệt");
    expect(meeting.locked).toBe(true);

    const others = (await meetingsOf(sectionId)).filter((m) => m.id !== target.id);
    expect(others.every((m) => m.room === "B2")).toBe(true);

    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const reread = await prisma.classMeeting.findUniqueOrThrow({ where: { id: target.id } });
    expect(reread.room).toBe("Phòng đặc biệt");

    const ev = await prisma.learningEvent.findFirst({ where: { eventType: "class.meeting.updated" } });
    expect(ev!.payload).toMatchObject({ meetingId: target.id, changed: ["room"] });
  });

  it("đổi giờ bắt đầu kéo theo giờ kết thúc theo thời lượng; số thứ tự tính lại theo thời gian", async () => {
    const { owner, sectionId } = await setup("edit-time");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    // Dời buổi 1 (03/11) sang sau buổi 2 (05/11).
    const to = vnDateTime("2026-11-06", "10:00");
    const { meeting } = await updateMeeting(owner, ms[0]!.id, { startsAt: to.toISOString(), durationMin: 60 }, prisma);
    expect(new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime()).toBe(60 * 60_000);
    expect(meeting.seq).toBe(2);
    const second = await prisma.classMeeting.findUniqueOrThrow({ where: { id: ms[1]!.id } });
    expect(second.seq).toBe(1);
  });

  it("đổi giáo viên dự kiến: chỉ nhận người thuộc khoá (C1.8)", async () => {
    const { owner, courseId, sectionId } = await setup("edit-teacher");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const [m] = await meetingsOf(sectionId);

    const co = await makeUser("cs-edit-teacher-co@e.com");
    const stranger = await makeUser("cs-edit-teacher-x@e.com");
    await prisma.courseInstructor.create({ data: { courseId, userId: co, role: "co-instructor" } });

    const ok = await updateMeeting(owner, m!.id, { plannedTeacherId: co }, prisma);
    expect(ok.meeting.plannedTeacherId).toBe(co);

    await expect(updateMeeting(owner, m!.id, { plannedTeacherId: stranger }, prisma)).rejects.toMatchObject({
      code: "teacher_not_in_course",
    });
  });

  it("không sửa được buổi đã huỷ hoặc đã dạy", async () => {
    const { owner, sectionId } = await setup("edit-locked");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const ms = await meetingsOf(sectionId);
    await cancelMeeting(owner, ms[0]!.id, { reason: "Nghỉ" }, prisma);
    await prisma.classMeeting.update({ where: { id: ms[1]!.id }, data: { status: "held" } });
    await expect(updateMeeting(owner, ms[0]!.id, { room: "X" }, prisma)).rejects.toMatchObject({ code: "meeting_not_editable" });
    await expect(updateMeeting(owner, ms[1]!.id, { room: "X" }, prisma)).rejects.toMatchObject({ code: "meeting_not_editable" });
  });
});

describe("cảnh báo trùng (C1.7) — cảnh báo, không chặn", () => {
  it("cùng giáo viên dạy hai lớp trùng giờ: lưu được và trả về cảnh báo teacher", async () => {
    const { owner, courseId, sectionId } = await setup("conf-t");
    const plan = {
      startDate: "2026-11-03",
      totalMeetings: 2,
      slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, plannedTeacherId: owner }],
    };
    await setClassSchedule(owner, sectionId, plan, prisma, NOW);

    const b = await createCourseSection(owner, courseId, { name: "Lớp B" });
    const res = await setClassSchedule(
      owner,
      b.id,
      { ...plan, slots: [{ weekday: 2, startTime: "19:00", durationMin: 60, plannedTeacherId: owner, room: "C1" }] },
      prisma,
      NOW,
    );
    expect(res.created).toBe(2);
    expect(res.conflicts.filter((c) => c.kind === "teacher")).toHaveLength(2);
    expect(res.conflicts[0]).toMatchObject({ otherSectionName: "Lớp A" });
  });

  it("cùng phòng chồng giờ: cảnh báo room; khác phòng thì không", async () => {
    const { owner, courseId, sectionId } = await setup("conf-r");
    const base = { startDate: "2026-11-03", totalMeetings: 1 };
    await setClassSchedule(owner, sectionId, { ...base, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" }] }, prisma, NOW);

    const b = await createCourseSection(owner, courseId, { name: "Lớp B" });
    const same = await setClassSchedule(owner, b.id, { ...base, slots: [{ weekday: 2, startTime: "19:00", durationMin: 60, room: " b2 " }] }, prisma, NOW);
    expect(same.conflicts.filter((c) => c.kind === "room")).toHaveLength(1);

    const c = await createCourseSection(owner, courseId, { name: "Lớp C" });
    const diff = await setClassSchedule(owner, c.id, { ...base, slots: [{ weekday: 2, startTime: "19:00", durationMin: 60, room: "A9" }] }, prisma, NOW);
    expect(diff.conflicts).toHaveLength(0);
  });

  it("buổi đã huỷ không gây xung đột", async () => {
    const { owner, courseId, sectionId } = await setup("conf-cancel");
    const plan = { startDate: "2026-11-03", totalMeetings: 1, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" }] };
    await setClassSchedule(owner, sectionId, plan, prisma, NOW);
    const [m] = await meetingsOf(sectionId);
    await cancelMeeting(owner, m!.id, { reason: "Nghỉ" }, prisma);

    const b = await createCourseSection(owner, courseId, { name: "Lớp B" });
    const res = await setClassSchedule(owner, b.id, plan, prisma, NOW);
    expect(res.conflicts).toHaveLength(0);
  });
});

describe("kiểm tra đầu vào và phân quyền", () => {
  it.each([
    ["thứ ngoài 1..7", { weekday: 8, startTime: "18:30", durationMin: 60 }],
    ["giờ sai định dạng", { weekday: 2, startTime: "6pm", durationMin: 60 }],
    ["giờ 25:00", { weekday: 2, startTime: "25:00", durationMin: 60 }],
    ["thời lượng quá ngắn", { weekday: 2, startTime: "18:30", durationMin: 5 }],
    ["thời lượng quá dài", { weekday: 2, startTime: "18:30", durationMin: 600 }],
  ])("khung giờ không hợp lệ (%s) bị từ chối", async (_name, slotInput) => {
    const { owner, sectionId } = await setup(`val-${_name.length}`);
    await expect(
      setClassSchedule(owner, sectionId, { startDate: "2026-11-03", totalMeetings: 4, slots: [slotInput] }, prisma, NOW),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("không có khung giờ, tổng buổi 0 hoặc quá 200, ngày sai, khung trùng nhau đều bị từ chối", async () => {
    const { owner, sectionId } = await setup("val-misc");
    const slot = { weekday: 2, startTime: "18:30", durationMin: 60 };
    const bad = [
      { startDate: "2026-11-03", totalMeetings: 4, slots: [] },
      { startDate: "2026-11-03", totalMeetings: 0, slots: [slot] },
      { startDate: "2026-11-03", totalMeetings: 201, slots: [slot] },
      { startDate: "03/11/2026", totalMeetings: 4, slots: [slot] },
      { startDate: "2026-11-03", totalMeetings: 4, slots: [slot, slot] },
    ];
    for (const input of bad) {
      await expect(setClassSchedule(owner, sectionId, input, prisma, NOW)).rejects.toMatchObject({ code: "validation_failed" });
    }
    expect(await prisma.classMeeting.count({ where: { sectionId } })).toBe(0);
  });

  it("giáo viên dự kiến của khung phải thuộc khoá", async () => {
    const { owner, sectionId } = await setup("val-teacher");
    const stranger = await makeUser("cs-val-teacher-x@e.com");
    await expect(
      setClassSchedule(
        owner,
        sectionId,
        { startDate: "2026-11-03", totalMeetings: 2, slots: [{ weekday: 2, startTime: "18:30", durationMin: 60, plannedTeacherId: stranger }] },
        prisma,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "teacher_not_in_course" });
  });

  it("lớp mặc định không có lịch", async () => {
    const { owner, courseId } = await setup("default");
    // Lớp mặc định chỉ sinh khi có người ghi danh; ở đây tạo thẳng để thử luật.
    const def = await prisma.courseSection.create({ data: { courseId, name: "Chưa gán lớp", isDefault: true } });
    await expect(setClassSchedule(owner, def.id, TUE_THU, prisma, NOW)).rejects.toMatchObject({ code: "default_section" });
  });

  it("lớp không tồn tại → section_not_found", async () => {
    const owner = await makeUser("cs-nf-o@e.com");
    await expect(setClassSchedule(owner, "no-such", TUE_THU, prisma, NOW)).rejects.toBeInstanceOf(ClassScheduleError);
  });

  it("người không phải giảng viên của khoá bị từ chối ở mọi thao tác ghi và đọc lịch quản lý", async () => {
    const { owner, sectionId } = await setup("authz");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const [m] = await meetingsOf(sectionId);
    const outsider = await makeUser("cs-authz-x@e.com");

    await expect(setClassSchedule(outsider, sectionId, TUE_THU, prisma, NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getClassSchedule(outsider, sectionId, prisma)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(cancelMeeting(outsider, m!.id, { reason: "x" }, prisma)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(updateMeeting(outsider, m!.id, { room: "x" }, prisma)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(
      addMakeupMeeting(outsider, sectionId, { startsAt: new Date().toISOString(), durationMin: 60 }, prisma),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("getClassSchedule", () => {
  it("lớp chưa có lịch: schedule null, không có buổi", async () => {
    const { owner, sectionId } = await setup("get-empty");
    const view = await getClassSchedule(owner, sectionId, prisma);
    expect(view.schedule).toBeNull();
    expect(view.meetings).toEqual([]);
  });

  it("trả kế hoạch, các buổi, và số buổi còn thiếu / dư so với kế hoạch", async () => {
    const { owner, sectionId } = await setup("get");
    await setClassSchedule(owner, sectionId, { ...TUE_THU, totalMeetings: 4 }, prisma, NOW);
    const [first] = await meetingsOf(sectionId);
    await cancelMeeting(owner, first!.id, { reason: "Nghỉ" }, prisma);

    const view = await getClassSchedule(owner, sectionId, prisma);
    expect(view.schedule).toMatchObject({ startDate: "2026-11-03", totalMeetings: 4 });
    expect(view.schedule!.slots).toHaveLength(2);
    expect(view.meetings).toHaveLength(4);
    expect(view.countedMeetings).toBe(3);
    expect(view.shortBy).toBe(1);
  });
});

describe("xem lịch (C1.9, C1.10)", () => {
  it("giảng viên thấy buổi của các lớp thuộc khoá mình, lọc theo khoảng ngày và theo lớp", async () => {
    const { owner, courseId, sectionId } = await setup("list-t");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    const b = await createCourseSection(owner, courseId, { name: "Lớp B" });
    await setClassSchedule(owner, b.id, { startDate: "2026-11-04", totalMeetings: 3, slots: [{ weekday: 3, startTime: "09:00", durationMin: 60 }] }, prisma, NOW);

    const all = await listTeacherMeetings(owner, { from: "2026-11-01", to: "2026-11-30" }, prisma);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((m) => m.startsAt >= "2026-10-31T17:00:00.000Z" && m.startsAt < "2026-11-30T17:00:00.000Z")).toBe(true);
    expect(all.map((m) => m.startsAt)).toEqual([...all.map((m) => m.startsAt)].sort());
    expect(new Set(all.map((m) => m.sectionName))).toEqual(new Set(["Lớp A", "Lớp B"]));

    const onlyB = await listTeacherMeetings(owner, { from: "2026-11-01", to: "2026-11-30", sectionId: b.id }, prisma);
    expect(onlyB.every((m) => m.sectionId === b.id)).toBe(true);
    expect(onlyB).toHaveLength(3);
  });

  it("giảng viên không thấy lịch của khoá mình không dạy", async () => {
    const a = await setup("list-iso-a");
    await setClassSchedule(a.owner, a.sectionId, TUE_THU, prisma, NOW);
    const other = await makeUser("cs-list-iso-b@e.com");
    const none = await listTeacherMeetings(other, { from: "2026-11-01", to: "2027-02-28" }, prisma);
    expect(none).toEqual([]);
  });

  it("học viên chỉ thấy buổi của lớp mình ghi danh, kể cả buổi đã huỷ", async () => {
    const { owner, courseId, sectionId } = await setup("list-l");
    const b = await createCourseSection(owner, courseId, { name: "Lớp B" });
    await setClassSchedule(owner, sectionId, { ...TUE_THU, totalMeetings: 4 }, prisma, NOW);
    await setClassSchedule(owner, b.id, { ...TUE_THU, totalMeetings: 4, startDate: "2026-11-10" }, prisma, NOW);
    const [first] = await meetingsOf(sectionId);
    await cancelMeeting(owner, first!.id, { reason: "Nghỉ" }, prisma);

    const student = await makeUser("cs-list-l-s@e.com");
    await enrollInCourse(student, courseId);
    const enr = await prisma.enrollment.findFirstOrThrow({ where: { userId: student, courseId } });
    await transferEnrollmentSection(owner, enr.id, sectionId, prisma);

    const mine = await listLearnerMeetings(student, { from: "2026-11-01", to: "2027-03-01" }, prisma);
    expect(mine).toHaveLength(4);
    expect(mine.every((m) => m.sectionId === sectionId)).toBe(true);
    expect(mine.some((m) => m.status === "cancelled")).toBe(true);

    const nobody = await makeUser("cs-list-l-n@e.com");
    expect(await listLearnerMeetings(nobody, { from: "2026-11-01", to: "2027-03-01" }, prisma)).toEqual([]);
  });

  it("khoảng ngày sai định dạng bị từ chối", async () => {
    const owner = await makeUser("cs-list-bad@e.com");
    await expect(listTeacherMeetings(owner, { from: "01/11/2026", to: "2026-11-30" }, prisma)).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("xoá lớp", () => {
  it("xoá lớp kéo theo kế hoạch, khung giờ và buổi (cascade)", async () => {
    const { owner, sectionId } = await setup("cascade");
    await setClassSchedule(owner, sectionId, TUE_THU, prisma, NOW);
    await prisma.courseSection.delete({ where: { id: sectionId } });
    expect(await prisma.classMeeting.count({ where: { sectionId } })).toBe(0);
    expect(await prisma.classSchedule.count({ where: { sectionId } })).toBe(0);
    expect(await prisma.classScheduleSlot.count()).toBe(0);
  });
});
