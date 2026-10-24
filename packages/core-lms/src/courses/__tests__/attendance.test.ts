import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  AttendanceError,
  getMeetingAttendance,
  getMyAttendanceSummary,
  getSectionAttendanceSummary,
  listMyAttendance,
  markAllPresent,
  markAttendance,
} from "../attendance";
import { cancelMeeting, setClassSchedule } from "../classSchedule";
import { vnDateTime } from "../classScheduleCalc";
import { CourseAuthzError } from "../authz";
import { createCourse, publishCourse } from "../courses";
import { createCourseSection, transferEnrollmentSection } from "../sections";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createSkill, tagLessonSkill } from "../skills";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { exportProfile } from "../../auth/profile";

const BASE = "http://localhost:3000";
// Lịch thứ ba 03/11/2026 18:30–20:30 (giờ Việt Nam).
const PLAN = {
  startDate: "2026-11-03",
  totalMeetings: 4,
  slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" }],
};
const SETUP_NOW = new Date("2026-10-23T03:00:00.000Z");
/** 15 phút trước buổi đầu: cửa sổ điểm danh đang mở. */
const OPEN_NOW = vnDateTime("2026-11-03", "18:15");

async function makeUser(email: string, name?: string) {
  const r = await registerUser({ email, password: "password1234", displayName: name ?? email }, BASE);
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

async function addLearner(owner: string, courseId: string, sectionId: string, email: string, name: string) {
  const userId = await makeUser(email, name);
  await enrollInCourse(userId, courseId);
  const enr = await prisma.enrollment.findFirstOrThrow({ where: { userId, courseId } });
  await transferEnrollmentSection(owner, enr.id, sectionId, prisma);
  return userId;
}

/** Lớp có lịch 4 buổi thứ ba và 3 học viên (An, Bình, Chi — tên sắp theo thứ tự chữ cái). */
async function setup(tag: string) {
  const owner = await makeUser(`at-${tag}-o@e.com`);
  const courseId = await publishedCourse(owner, `at-${tag}`);
  const section = await createCourseSection(owner, courseId, { name: "Lớp A" });
  await setClassSchedule(owner, section.id, PLAN, prisma, SETUP_NOW);
  const meetings = await prisma.classMeeting.findMany({ where: { sectionId: section.id }, orderBy: { startsAt: "asc" } });
  const an = await addLearner(owner, courseId, section.id, `at-${tag}-an@e.com`, "An");
  const binh = await addLearner(owner, courseId, section.id, `at-${tag}-binh@e.com`, "Bình");
  const chi = await addLearner(owner, courseId, section.id, `at-${tag}-chi@e.com`, "Chi");
  return { owner, courseId, sectionId: section.id, meetings, an, binh, chi };
}

const rowsOf = (meetingId: string) => prisma.studentAttendance.findMany({ where: { meetingId }, orderBy: { userId: "asc" } });

describe("getMeetingAttendance — danh sách lớp (C2.1, C2.6)", () => {
  it("giáo viên thấy toàn bộ học viên của lớp, chưa ai được đánh dấu, cửa sổ đang mở", async () => {
    const t = await setup("get");
    const view = await getMeetingAttendance(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);

    expect(view.window.state).toBe("open");
    expect(view.entries.map((e) => e.displayName)).toEqual(["An", "Bình", "Chi"]);
    expect(view.entries.every((e) => e.status === null && e.inRoster)).toBe(true);
    expect(view.meeting).toMatchObject({ id: t.meetings[0]!.id, seq: 1, room: "B2", status: "planned" });
  });

  it("trước giờ mở (hơn 30 phút) vẫn xem được danh sách nhưng cửa sổ báo chưa mở", async () => {
    const t = await setup("get-early");
    const view = await getMeetingAttendance(t.owner, t.meetings[0]!.id, prisma, vnDateTime("2026-11-03", "17:59"));
    expect(view.window.state).toBe("not_open");
    expect(view.entries).toHaveLength(3);
  });

  it("học viên ghi danh sau khi buổi đã mở xuất hiện khi tải lại, chưa đánh dấu", async () => {
    const t = await setup("late-enroll");
    await markAllPresent(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);
    const dung = await addLearner(t.owner, t.courseId, t.sectionId, "at-late-enroll-dung@e.com", "Dũng");

    const view = await getMeetingAttendance(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);
    const entry = view.entries.find((e) => e.userId === dung);
    expect(entry).toMatchObject({ status: null, inRoster: true });
  });

  it("học viên đã rời lớp vẫn hiện ở buổi đã điểm danh nhưng không hiện ở buổi chưa có dòng nào (C2.7)", async () => {
    const t = await setup("left");
    await markAttendance(t.owner, t.meetings[0]!.id, { entries: [{ userId: t.an, status: "present" }] }, prisma, OPEN_NOW);
    await prisma.enrollment.updateMany({ where: { userId: t.an, courseId: t.courseId }, data: { status: "dropped" } });

    const first = await getMeetingAttendance(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);
    expect(first.entries.find((e) => e.userId === t.an)).toMatchObject({ status: "present", inRoster: false });

    const second = await getMeetingAttendance(t.owner, t.meetings[1]!.id, prisma, OPEN_NOW);
    expect(second.entries.some((e) => e.userId === t.an)).toBe(false);
    await expect(
      markAttendance(t.owner, t.meetings[1]!.id, { entries: [{ userId: t.an, status: "present" }] }, prisma, vnDateTime("2026-11-10", "18:15")),
    ).rejects.toMatchObject({ code: "not_in_roster" });
  });
});

describe("markAttendance (C2.3, C2.4, C2.8)", () => {
  it("lưu trạng thái và ghi chú, phát event có trạng thái cũ = null và subject là học viên", async () => {
    const t = await setup("mark");
    const res = await markAttendance(
      t.owner,
      t.meetings[0]!.id,
      { entries: [{ userId: t.an, status: "late", note: "Kẹt xe" }, { userId: t.binh, status: "absent" }] },
      prisma,
      OPEN_NOW,
    );
    expect(res.changed).toBe(2);

    const rows = await rowsOf(t.meetings[0]!.id);
    expect(rows.find((r) => r.userId === t.an)).toMatchObject({ status: "late", note: "Kẹt xe", markedById: t.owner });
    expect(rows.find((r) => r.userId === t.binh)).toMatchObject({ status: "absent", note: null });

    const ev = await prisma.learningEvent.findFirst({ where: { eventType: "attendance.student.marked", userId: t.an } });
    expect(ev!.courseId).toBe(t.courseId);
    expect(ev!.payload).toMatchObject({
      meetingId: t.meetings[0]!.id,
      sectionId: t.sectionId,
      status: "late",
      previousStatus: null,
      markedById: t.owner,
    });
    // Payload không mang chữ ghi chú.
    expect(JSON.stringify(ev!.payload)).not.toContain("Kẹt xe");
  });

  it("sửa lại: cập nhật dòng hiện tại, phát event mới có trạng thái cũ → mới, không nhân đôi dòng", async () => {
    const t = await setup("edit");
    const id = t.meetings[0]!.id;
    await markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "absent" }] }, prisma, OPEN_NOW);
    await markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "excused" }] }, prisma, vnDateTime("2026-11-05", "09:00"));

    expect(await prisma.studentAttendance.count({ where: { meetingId: id, userId: t.an } })).toBe(1);
    const events = await prisma.learningEvent.findMany({ where: { eventType: "attendance.student.marked", userId: t.an }, orderBy: { id: "asc" } });
    expect(events.map((e) => (e.payload as { status: string; previousStatus: string | null }).previousStatus)).toEqual([null, "absent"]);
    expect(events.map((e) => (e.payload as { status: string }).status)).toEqual(["absent", "excused"]);
  });

  it("lưu lại đúng trạng thái cũ thì không phát event; chỉ đổi ghi chú thì cập nhật ghi chú, không phát event", async () => {
    const t = await setup("noop");
    const id = t.meetings[0]!.id;
    await markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "present" }] }, prisma, OPEN_NOW);
    const again = await markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "present" }] }, prisma, OPEN_NOW);
    expect(again.changed).toBe(0);

    await markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "present", note: "Ngồi bàn đầu" }] }, prisma, OPEN_NOW);
    expect((await rowsOf(id))[0]!.note).toBe("Ngồi bàn đầu");
    expect(await prisma.learningEvent.count({ where: { eventType: "attendance.student.marked", userId: t.an } })).toBe(1);
  });

  it("cửa sổ: chưa mở (trước 30 phút) và đã đóng (sau 7 ngày kể từ lúc hết buổi) đều bị từ chối; đúng biên thì được", async () => {
    const t = await setup("window");
    const id = t.meetings[0]!.id;
    const entry = { entries: [{ userId: t.an, status: "present" as const }] };

    await expect(markAttendance(t.owner, id, entry, prisma, vnDateTime("2026-11-03", "17:59"))).rejects.toMatchObject({ code: "attendance_not_open" });
    await expect(markAttendance(t.owner, id, entry, prisma, vnDateTime("2026-11-03", "18:00"))).resolves.toMatchObject({ changed: 1 });
    // Buổi kết thúc 20:30 ngày 03/11 → đóng lúc 20:30 ngày 10/11.
    await expect(
      markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "late" }] }, prisma, vnDateTime("2026-11-10", "20:30")),
    ).resolves.toMatchObject({ changed: 1 });
    await expect(
      markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "absent" }] }, prisma, vnDateTime("2026-11-10", "20:31")),
    ).rejects.toMatchObject({ code: "attendance_closed" });
  });

  it("buổi đã huỷ thì không điểm danh được (C2.5)", async () => {
    const t = await setup("cancelled");
    await cancelMeeting(t.owner, t.meetings[0]!.id, { reason: "Nghỉ" }, prisma);
    await expect(
      markAttendance(t.owner, t.meetings[0]!.id, { entries: [{ userId: t.an, status: "present" }] }, prisma, OPEN_NOW),
    ).rejects.toMatchObject({ code: "meeting_cancelled" });
    await expect(markAllPresent(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW)).rejects.toMatchObject({ code: "meeting_cancelled" });
  });

  it("người không học lớp này không điểm danh được", async () => {
    const t = await setup("stranger");
    const stranger = await makeUser("at-stranger-x@e.com");
    await expect(
      markAttendance(t.owner, t.meetings[0]!.id, { entries: [{ userId: stranger, status: "present" }] }, prisma, OPEN_NOW),
    ).rejects.toMatchObject({ code: "not_in_roster" });
    expect(await prisma.studentAttendance.count()).toBe(0);
  });

  it("một lô có người sai thì cả lô không được lưu", async () => {
    const t = await setup("atomic");
    const stranger = await makeUser("at-atomic-x@e.com");
    await expect(
      markAttendance(
        t.owner,
        t.meetings[0]!.id,
        { entries: [{ userId: t.an, status: "present" }, { userId: stranger, status: "present" }] },
        prisma,
        OPEN_NOW,
      ),
    ).rejects.toBeInstanceOf(AttendanceError);
    expect(await prisma.studentAttendance.count()).toBe(0);
  });

  it.each([
    ["trạng thái lạ", { entries: [{ userId: "x", status: "sleeping" }] }],
    ["không có dòng nào", { entries: [] }],
    ["ghi chú quá 200 ký tự", { entries: [{ userId: "x", status: "present", note: "a".repeat(201) }] }],
    ["trùng học viên trong một lô", { entries: [{ userId: "x", status: "present" }, { userId: "x", status: "late" }] }],
    ["quá 300 dòng", { entries: Array.from({ length: 301 }, (_, i) => ({ userId: `u${i}`, status: "present" })) }],
  ])("đầu vào sai (%s) bị từ chối", async (_n, input) => {
    const t = await setup(`val-${_n.length}`);
    await expect(markAttendance(t.owner, t.meetings[0]!.id, input, prisma, OPEN_NOW)).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("markAllPresent (C2.2)", () => {
  it("chỉ đánh dấu những người chưa có dòng; người đã vắng/muộn giữ nguyên", async () => {
    const t = await setup("all");
    const id = t.meetings[0]!.id;
    await markAttendance(t.owner, id, { entries: [{ userId: t.an, status: "absent" }, { userId: t.binh, status: "late" }] }, prisma, OPEN_NOW);

    const res = await markAllPresent(t.owner, id, prisma, OPEN_NOW);
    expect(res.marked).toBe(1);

    const rows = await rowsOf(id);
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.status]))).toEqual({
      [t.an]: "absent",
      [t.binh]: "late",
      [t.chi]: "present",
    });
    // Mỗi người chỉ có một event: An, Bình từ lần trước, Chi từ lần này.
    expect(await prisma.learningEvent.count({ where: { eventType: "attendance.student.marked" } })).toBe(3);
  });

  it("gọi lần hai không làm gì thêm", async () => {
    const t = await setup("all-twice");
    await markAllPresent(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);
    const again = await markAllPresent(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);
    expect(again.marked).toBe(0);
    expect(await prisma.studentAttendance.count()).toBe(3);
  });
});

describe("phân quyền (C2.9)", () => {
  it("người ngoài khoá và cả học viên của lớp đều không xem hay ghi điểm danh của lớp được", async () => {
    const t = await setup("authz");
    const outsider = await makeUser("at-authz-x@e.com");
    for (const who of [outsider, t.an]) {
      await expect(getMeetingAttendance(who, t.meetings[0]!.id, prisma, OPEN_NOW)).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(
        markAttendance(who, t.meetings[0]!.id, { entries: [{ userId: t.an, status: "present" }] }, prisma, OPEN_NOW),
      ).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(markAllPresent(who, t.meetings[0]!.id, prisma, OPEN_NOW)).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(getSectionAttendanceSummary(who, t.sectionId, prisma, OPEN_NOW)).rejects.toBeInstanceOf(CourseAuthzError);
    }
    expect(await prisma.studentAttendance.count()).toBe(0);
  });

  it("buổi không tồn tại → meeting_not_found", async () => {
    const owner = await makeUser("at-nf-o@e.com");
    await expect(getMeetingAttendance(owner, "no-such", prisma, OPEN_NOW)).rejects.toMatchObject({ code: "meeting_not_found" });
  });
});

describe("tổng hợp theo lớp (C2.10)", () => {
  /** Bốn buổi thứ ba liên tiếp nhưng ta dùng lịch hằng ngày để còn nằm trong cửa sổ điểm danh 7 ngày. */
  async function weekdaySetup(tag: string) {
    const owner = await makeUser(`at-${tag}-o@e.com`);
    const courseId = await publishedCourse(owner, `at-${tag}`);
    const section = await createCourseSection(owner, courseId, { name: "Lớp tuần" });
    await setClassSchedule(
      owner,
      section.id,
      { startDate: "2026-11-02", totalMeetings: 5, slots: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "18:30", durationMin: 120 })) },
      prisma,
      SETUP_NOW,
    );
    const meetings = await prisma.classMeeting.findMany({ where: { sectionId: section.id }, orderBy: { startsAt: "asc" } });
    const an = await addLearner(owner, courseId, section.id, `at-${tag}-an@e.com`, "An");
    const binh = await addLearner(owner, courseId, section.id, `at-${tag}-binh@e.com`, "Bình");
    const chi = await addLearner(owner, courseId, section.id, `at-${tag}-chi@e.com`, "Chi");
    return { owner, sectionId: section.id, meetings, an, binh, chi };
  }

  it("tính tỉ lệ có mặt (có mặt + muộn) / (có mặt + muộn + vắng), bỏ có phép; đếm vắng liên tiếp từ buổi gần nhất", async () => {
    const t = await weekdaySetup("sum");
    const now = vnDateTime("2026-11-06", "21:00"); // sau buổi thứ sáu
    const mark = (i: number, entries: Array<{ userId: string; status: "present" | "late" | "absent" | "excused" }>) =>
      markAttendance(t.owner, t.meetings[i]!.id, { entries }, prisma, now);

    // An: có mặt, vắng, vắng, vắng, vắng (4 buổi vắng cuối)
    // Bình: có mặt, vắng, có mặt, có phép, muộn
    // Chi: không buổi nào được đánh dấu
    await mark(0, [{ userId: t.an, status: "present" }, { userId: t.binh, status: "present" }]);
    await mark(1, [{ userId: t.an, status: "absent" }, { userId: t.binh, status: "absent" }]);
    await mark(2, [{ userId: t.an, status: "absent" }, { userId: t.binh, status: "present" }]);
    await mark(3, [{ userId: t.an, status: "absent" }, { userId: t.binh, status: "excused" }]);
    await mark(4, [{ userId: t.an, status: "absent" }, { userId: t.binh, status: "late" }]);

    const sum = await getSectionAttendanceSummary(t.owner, t.sectionId, prisma, now);
    expect(sum.meetingsHeld).toBe(5);
    const by = Object.fromEntries(sum.learners.map((l) => [l.userId, l]));

    expect(by[t.an]).toMatchObject({ present: 1, late: 0, absent: 4, excused: 0, consecutiveAbsent: 4, needsAttention: true });
    expect(by[t.an]!.attendedRate).toBeCloseTo(1 / 5);

    expect(by[t.binh]).toMatchObject({ present: 2, late: 1, absent: 1, excused: 1, consecutiveAbsent: 0, needsAttention: false });
    expect(by[t.binh]!.attendedRate).toBeCloseTo(3 / 4);

    expect(by[t.chi]).toMatchObject({ present: 0, absent: 0, attendedRate: null, consecutiveAbsent: 0, needsAttention: false });
  });

  it("vắng đúng một buổi gần nhất thì chưa cần chú ý; vắng hai buổi gần nhất thì có; có phép cắt chuỗi", async () => {
    const t = await weekdaySetup("streak");
    const now = vnDateTime("2026-11-06", "21:00");
    const mark = (i: number, userId: string, status: "present" | "absent" | "excused") =>
      markAttendance(t.owner, t.meetings[i]!.id, { entries: [{ userId, status }] }, prisma, now);

    await mark(3, t.an, "absent");
    await mark(4, t.an, "absent");
    await mark(3, t.binh, "present");
    await mark(4, t.binh, "absent");
    await mark(3, t.chi, "absent");
    await mark(4, t.chi, "excused");

    const sum = await getSectionAttendanceSummary(t.owner, t.sectionId, prisma, now);
    const by = Object.fromEntries(sum.learners.map((l) => [l.userId, l]));
    expect(by[t.an]).toMatchObject({ consecutiveAbsent: 2, needsAttention: true });
    expect(by[t.binh]).toMatchObject({ consecutiveAbsent: 1, needsAttention: false });
    expect(by[t.chi]).toMatchObject({ consecutiveAbsent: 0, needsAttention: false });
  });

  it("buổi chưa diễn ra và buổi huỷ không tính vào số buổi đã học", async () => {
    const t = await weekdaySetup("held");
    await cancelMeeting(t.owner, t.meetings[0]!.id, { reason: "Nghỉ" }, prisma);
    const sum = await getSectionAttendanceSummary(t.owner, t.sectionId, prisma, vnDateTime("2026-11-04", "21:00"));
    // Còn buổi 03/11 và 04/11 đã diễn ra (buổi 02/11 bị huỷ; 05/11 trở đi chưa tới).
    expect(sum.meetingsHeld).toBe(2);
  });
});

describe("học viên xem điểm danh của chính mình (C2.12)", () => {
  it("chỉ thấy trạng thái của mình, không thấy ghi chú, không thấy của bạn khác", async () => {
    const t = await setup("mine");
    await markAttendance(
      t.owner,
      t.meetings[0]!.id,
      { entries: [{ userId: t.an, status: "late", note: "Ghi chú nội bộ" }, { userId: t.binh, status: "absent" }] },
      prisma,
      OPEN_NOW,
    );
    const mine = await listMyAttendance(t.an, { from: "2026-11-01", to: "2026-11-30" }, prisma);
    expect(mine).toEqual([{ meetingId: t.meetings[0]!.id, sectionId: t.sectionId, status: "late" }]);
    expect(JSON.stringify(mine)).not.toContain("nội bộ");

    expect(await listMyAttendance(t.chi, { from: "2026-11-01", to: "2026-11-30" }, prisma)).toEqual([]);
  });

  it("tổng hợp theo lớp: số buổi có mặt/muộn/vắng/có phép của chính mình", async () => {
    const t = await setup("mine-sum");
    const now = vnDateTime("2026-11-10", "18:15");
    await markAttendance(t.owner, t.meetings[0]!.id, { entries: [{ userId: t.an, status: "present" }] }, prisma, vnDateTime("2026-11-03", "18:15"));
    await markAttendance(t.owner, t.meetings[1]!.id, { entries: [{ userId: t.an, status: "absent" }] }, prisma, now);

    const sums = await getMyAttendanceSummary(t.an, prisma);
    expect(sums).toHaveLength(1);
    expect(sums[0]).toMatchObject({ sectionId: t.sectionId, sectionName: "Lớp A", present: 1, late: 0, absent: 1, excused: 0 });
  });

  it("khoảng ngày sai định dạng bị từ chối", async () => {
    const t = await setup("mine-bad");
    await expect(listMyAttendance(t.an, { from: "01/11/2026", to: "2026-11-30" }, prisma)).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("tương tác với lịch lớp và dữ liệu cá nhân", () => {
  it("áp lại kế hoạch không xoá buổi đã có điểm danh dù buổi còn ở tương lai", async () => {
    const t = await setup("regen");
    const first = t.meetings[0]!;
    await markAttendance(t.owner, first.id, { entries: [{ userId: t.an, status: "present" }] }, prisma, OPEN_NOW);

    // Đổi kế hoạch sang thứ năm 19:00; "bây giờ" vẫn trước buổi đầu nên về nguyên tắc buổi đó thay được.
    await setClassSchedule(
      t.owner,
      t.sectionId,
      { ...PLAN, slots: [{ weekday: 4, startTime: "19:00", durationMin: 90 }] },
      prisma,
      OPEN_NOW,
    );
    const kept = await prisma.classMeeting.findUnique({ where: { id: first.id } });
    expect(kept).not.toBeNull();
    expect(await prisma.studentAttendance.count({ where: { meetingId: first.id } })).toBe(1);
  });

  it("xoá một buổi xoá luôn điểm danh của buổi đó (cascade)", async () => {
    const t = await setup("cascade");
    await markAllPresent(t.owner, t.meetings[0]!.id, prisma, OPEN_NOW);
    expect(await prisma.studentAttendance.count()).toBe(3);
    await prisma.classMeeting.delete({ where: { id: t.meetings[0]!.id } });
    expect(await prisma.studentAttendance.count()).toBe(0);
  });

  it("bản xuất dữ liệu cá nhân có điểm danh của chính học viên (kèm ghi chú), không có của người khác", async () => {
    const t = await setup("export");
    await markAttendance(
      t.owner,
      t.meetings[0]!.id,
      { entries: [{ userId: t.an, status: "late", note: "Kẹt xe" }, { userId: t.binh, status: "absent" }] },
      prisma,
      OPEN_NOW,
    );
    const data = await exportProfile(t.an);
    expect(data.studentAttendances).toHaveLength(1);
    expect(data.studentAttendances[0]).toMatchObject({ status: "late", note: "Kẹt xe" });
  });
});
