import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  TeacherCheckInError,
  checkInToMeeting,
  editTeacherCheckIn,
  getMeetingCheckIn,
  getOrgReconciliation,
  listMyCheckIns,
} from "../teacherCheckIn";
import { closeMeeting } from "../meetingSummary";
import { markAttendance } from "../attendance";
import { cancelMeeting } from "../classSchedule";
import { setOrgCheckinThreshold } from "../../org/centerAccess";
import { CourseAuthzError } from "../authz";
import { makeUser, setup, type Setup } from "./meetingFixture";

// Buổi 1: thứ ba 03/11/2026 18:30–20:30 giờ VN (11:30–13:30 UTC).
const START = new Date("2026-11-03T11:30:00.000Z");
const at = (m: number) => new Date(START.getTime() + m * 60_000);
const WEEK = { from: "2026-11-02", to: "2026-11-08" };

let n = 0;
/** Gắn khoá vào một trường (có quản trị trường) và đặt giáo viên dự kiến của mọi buổi. */
async function center(s: Setup, opts: { threshold?: number; planned?: boolean } = {}) {
  const org = await prisma.organization.create({
    data: { code: `ci-${Date.now()}-${++n}`, name: "Trung tâm thử", ...(opts.threshold ? { checkinThresholdMin: opts.threshold } : {}) },
  });
  await prisma.course.update({ where: { id: s.courseId }, data: { organizationId: org.id } });
  const admin = await makeUser(`ci-admin-${org.code}@e.com`);
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: admin } });
  // giáo viên dạy chính của lớp: người chỉ dạy được xếp vào mọi buổi
  const planned = await makeUser(`ci-planned-${org.code}@e.com`, ["center_teacher"]);
  await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: planned, role: "non-editing-teacher" } });
  if (opts.planned !== false) await prisma.classMeeting.updateMany({ where: { sectionId: s.sectionId }, data: { plannedTeacherId: planned } });
  return { org, admin, planned };
}

describe("checkInToMeeting — bấm 'Bắt đầu buổi' (C5.1, C5.2, C5.8)", () => {
  it("giáo viên dự kiến bấm trong cửa sổ: ghi giờ vào, đúng giờ, phát attendance.teacher.checked_in; bấm lần hai không ghi đè", async () => {
    const s = await setup("ci-basic");
    const c = await center(s);
    const v1 = await checkInToMeeting(c.planned, s.meetings[0]!.id, at(2));
    expect(v1).toMatchObject({ state: "checked_in", flags: ["on_time"], checkIn: { teacherId: c.planned, method: "self" } });
    expect(v1.checkIn!.checkedInAt).toBe(at(2).toISOString());

    const v2 = await checkInToMeeting(c.planned, s.meetings[0]!.id, at(50));
    expect(v2.checkIn!.checkedInAt).toBe(at(2).toISOString()); // không ghi đè
    expect(await prisma.teacherCheckIn.count({ where: { meetingId: s.meetings[0]!.id } })).toBe(1);

    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.TeacherCheckedIn } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.userId).toBe(c.planned);
    expect(ev[0]!.payload).toMatchObject({ meetingId: s.meetings[0]!.id, sectionId: s.sectionId, courseId: s.courseId, substitute: false, plannedTeacherId: c.planned });
  });

  it("cửa sổ: trước 30 phút thì chưa mở, đúng 30 phút trước thì mở, sau giờ kết thúc thì đóng", async () => {
    const s = await setup("ci-window");
    const c = await center(s);
    const id = s.meetings[0]!.id;
    await expect(checkInToMeeting(c.planned, id, at(-31))).rejects.toMatchObject({ code: "check_in_not_open" });
    await expect(checkInToMeeting(c.planned, id, at(121))).rejects.toMatchObject({ code: "check_in_closed" });
    expect(await prisma.teacherCheckIn.count()).toBe(0);
    await expect(checkInToMeeting(c.planned, id, at(-30))).resolves.toMatchObject({ state: "checked_in" });
  });

  it("buổi đã huỷ thì không bấm được", async () => {
    const s = await setup("ci-cancel");
    const c = await center(s);
    await cancelMeeting(s.teacher, s.meetings[2]!.id, { reason: "Nghỉ" }, prisma);
    await expect(checkInToMeeting(c.planned, s.meetings[2]!.id, new Date("2026-11-17T11:30:00.000Z"))).rejects.toMatchObject({ code: "meeting_cancelled" });
  });

  it("dạy thay: người khác giáo viên dự kiến nhưng có tên trong khoá bấm thì ghi là dạy thay; người lạ và học viên bị từ chối", async () => {
    const s = await setup("ci-sub");
    const c = await center(s);
    const id = s.meetings[0]!.id;
    const stranger = await makeUser("ci-sub-x@e.com", ["instructor"]);
    await expect(checkInToMeeting(stranger, id, at(0))).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(checkInToMeeting(s.learners[0]!, id, at(0))).rejects.toBeInstanceOf(CourseAuthzError);

    const v = await checkInToMeeting(s.teacher, id, at(0)); // chủ khoá dạy thay cho giáo viên dự kiến
    expect(v.flags).toEqual(["on_time", "substitute"]);
    expect(v.checkIn).toMatchObject({ teacherId: s.teacher });
    expect(v.expectedTeacher).toMatchObject({ id: c.planned });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.TeacherCheckedIn } });
    expect(ev.userId).toBe(s.teacher);
    expect(ev.payload).toMatchObject({ substitute: true, plannedTeacherId: c.planned });
  });

  it("buổi chưa xếp giáo viên: chủ khoá bấm là bình thường, không phải dạy thay", async () => {
    const s = await setup("ci-unassigned");
    await center(s, { planned: false });
    const v = await checkInToMeeting(s.teacher, s.meetings[0]!.id, at(0));
    expect(v.flags).toEqual(["on_time"]);
  });
});

describe("getMeetingCheckIn — thẻ trên trang buổi (C5.4)", () => {
  it("trước khi bấm: đang chờ, canCheckIn theo cửa sổ; sau khi bấm: không bấm lại được", async () => {
    const s = await setup("ci-view");
    const c = await center(s);
    const id = s.meetings[0]!.id;
    expect(await getMeetingCheckIn(s.teacher, id, at(-60))).toMatchObject({ state: "waiting", canCheckIn: false, window: { state: "not_open" } });
    expect(await getMeetingCheckIn(s.teacher, id, at(0))).toMatchObject({ state: "waiting", canCheckIn: true, window: { state: "open" }, thresholdMin: 15 });
    await checkInToMeeting(c.planned, id, at(0));
    expect(await getMeetingCheckIn(s.teacher, id, at(10))).toMatchObject({ canCheckIn: false, checkIn: { teacherName: expect.any(String) } });
    expect(await getMeetingCheckIn(s.teacher, id, at(500))).toMatchObject({ window: { state: "closed" } });
  });

  it("không ai bấm tới khi qua giờ kết thúc: 'không check-in'", async () => {
    const s = await setup("ci-none");
    await center(s);
    expect(await getMeetingCheckIn(s.teacher, s.meetings[0]!.id, at(200))).toMatchObject({ state: "no_check_in", flags: ["no_check_in"] });
  });

  it("trễ theo ngưỡng của TỔ CHỨC", async () => {
    const s = await setup("ci-threshold");
    const c = await center(s, { threshold: 5 });
    await checkInToMeeting(c.planned, s.meetings[0]!.id, at(10));
    expect((await getMeetingCheckIn(s.teacher, s.meetings[0]!.id, at(20))).flags).toEqual(["late"]);
    const s2 = await setup("ci-threshold2");
    const c2 = await center(s2); // mặc định 15
    await checkInToMeeting(c2.planned, s2.meetings[0]!.id, at(10));
    expect((await getMeetingCheckIn(s2.teacher, s2.meetings[0]!.id, at(20))).flags).toEqual(["on_time"]);
  });

  it("người ngoài khoá không xem được", async () => {
    const s = await setup("ci-view-authz");
    await center(s);
    const stranger = await makeUser("ci-view-x@e.com", ["instructor"]);
    await expect(getMeetingCheckIn(stranger, s.meetings[0]!.id, at(0))).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getMeetingCheckIn(s.teacher, "no-such", at(0))).rejects.toMatchObject({ code: "meeting_not_found" });
  });
});

describe("Kết thúc buổi ghi giờ ra (C5.3)", () => {
  it("ghi checkedOutAt nếu có check-in và chưa có giờ ra; phát checked_out một lần; ra sớm quá ngưỡng thì 'kết thúc sớm'", async () => {
    const s = await setup("ci-out");
    const c = await center(s);
    await checkInToMeeting(c.planned, s.meetings[0]!.id, at(0));
    await closeMeeting(s.teacher, s.meetings[0]!.id, at(60)); // đóng lúc +60, buổi dài 120 → sớm 60 phút
    const row = await prisma.teacherCheckIn.findUniqueOrThrow({ where: { meetingId: s.meetings[0]!.id } });
    expect(row.checkedOutAt).toEqual(at(60));
    const v = await getMeetingCheckIn(s.teacher, s.meetings[0]!.id, at(70));
    expect(v.flags).toEqual(["on_time", "early_end"]);
    expect(v.minutesBeforeEnd).toBe(60);
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.TeacherCheckedOut } })).toBe(1);
    await closeMeeting(s.teacher, s.meetings[0]!.id, at(90)); // đóng lại: không ghi đè, không phát thêm
    expect((await prisma.teacherCheckIn.findUniqueOrThrow({ where: { meetingId: s.meetings[0]!.id } })).checkedOutAt).toEqual(at(60));
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.TeacherCheckedOut } })).toBe(1);
  });

  it("đóng buổi mà chưa ai bấm 'Bắt đầu buổi': không tự tạo dòng check-in (giáo viên quên bấm thì quản trị sửa sau)", async () => {
    const s = await setup("ci-out-none");
    await center(s);
    await closeMeeting(s.teacher, s.meetings[0]!.id, at(125));
    expect(await prisma.teacherCheckIn.count()).toBe(0);
  });
});

describe("listMyCheckIns — giáo viên chỉ xem của mình (C5.7)", () => {
  it("gồm buổi được xếp cho mình và buổi mình đã dạy thay; không có buổi của người khác", async () => {
    const s = await setup("ci-mine");
    const c = await center(s);
    // buổi 2 giao cho người khác; chủ khoá dạy thay buổi 3
    const other = await makeUser("ci-mine-other@e.com", ["center_teacher"]);
    await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: other, role: "non-editing-teacher" } });
    await prisma.classMeeting.update({ where: { id: s.meetings[1]!.id }, data: { plannedTeacherId: other } });
    await checkInToMeeting(s.teacher, s.meetings[2]!.id, new Date("2026-11-17T11:30:00.000Z")); // dạy thay buổi 3 (phạm vi tuần 17/11)

    const week1 = await listMyCheckIns(c.planned, WEEK, at(300));
    expect(week1.map((r) => r.meetingId)).toEqual([s.meetings[0]!.id]);
    expect(week1[0]).toMatchObject({ state: "no_check_in", seq: 1 });

    const mineOther = await listMyCheckIns(other, { from: "2026-11-09", to: "2026-11-15" }, at(300 + 7 * 1440));
    expect(mineOther.map((r) => r.meetingId)).toEqual([s.meetings[1]!.id]);

    const tail = await listMyCheckIns(s.teacher, { from: "2026-11-16", to: "2026-11-22" }, new Date("2026-11-18T00:00:00.000Z"));
    expect(tail.map((r) => r.meetingId)).toEqual([s.meetings[2]!.id]);
    expect(tail[0]!.flags).toContain("substitute");
  });
});

describe("getOrgReconciliation — báo cáo tuần cho chủ trung tâm (C5.5–C5.7)", () => {
  it("đếm đúng giờ, trễ, dạy thay, không check-in và 'chưa điểm danh' theo từng giáo viên; chi tiết từng buổi", async () => {
    const s = await setup("ci-report");
    const c = await center(s);
    const t2 = await makeUser("ci-report-t2@e.com", ["center_teacher"]);
    await prisma.courseInstructor.create({ data: { courseId: s.courseId, userId: t2, role: "non-editing-teacher" } });
    // Tuần 1 có buổi 1 (03/11). Thêm hai buổi trong cùng tuần cho đủ trường hợp.
    const mk = (startIso: string) =>
      prisma.classMeeting.create({
        data: { sectionId: s.sectionId, seq: null, startsAt: new Date(startIso), endsAt: new Date(new Date(startIso).getTime() + 7_200_000), plannedTeacherId: c.planned, locked: true },
      });
    const m2 = await mk("2026-11-04T11:30:00.000Z"); // người dự kiến bị t2 dạy thay, vào trễ
    const m3 = await mk("2026-11-05T11:30:00.000Z"); // không ai bấm
    const now = new Date("2026-11-06T00:00:00.000Z");

    await checkInToMeeting(c.planned, s.meetings[0]!.id, at(0)); // đúng giờ
    await checkInToMeeting(t2, m2.id, new Date("2026-11-04T12:00:00.000Z")); // +30 phút: trễ và dạy thay
    // buổi 1 đã kết thúc và chưa điểm danh học viên nào
    await closeMeeting(s.teacher, s.meetings[0]!.id, at(125));

    const rep = await getOrgReconciliation(c.admin, c.org.id, WEEK, now);
    expect(rep.thresholdMin).toBe(15);
    const row = (id: string | null) => rep.teachers.find((t) => t.teacherId === id)!;
    expect(row(c.planned)).toMatchObject({ onTime: 1, late: 0, noCheckIn: 1, substitute: 0, attendanceMissing: 1 });
    expect(row(t2)).toMatchObject({ onTime: 0, late: 1, substitute: 1, noCheckIn: 0 });

    const byId = new Map(rep.meetings.map((m) => [m.meetingId, m]));
    expect(byId.get(m3.id)).toMatchObject({ state: "no_check_in", expectedTeacher: { id: c.planned } });
    expect(byId.get(m2.id)).toMatchObject({ actualTeacher: { id: t2 }, flags: ["late", "substitute"] });
    expect(byId.get(s.meetings[0]!.id)).toMatchObject({ attendanceMissing: true });
  });

  it("buổi đã điểm danh học viên thì không bị đánh dấu chưa điểm danh", async () => {
    const s = await setup("ci-report-att");
    const c = await center(s);
    await checkInToMeeting(c.planned, s.meetings[0]!.id, at(0));
    await markAttendance(s.teacher, s.meetings[0]!.id, { entries: [{ userId: s.learners[0]!, status: "present" }] }, prisma, at(10));
    await closeMeeting(s.teacher, s.meetings[0]!.id, at(125));
    const rep = await getOrgReconciliation(c.admin, c.org.id, WEEK, new Date("2026-11-06T00:00:00.000Z"));
    expect(rep.teachers.find((t) => t.teacherId === c.planned)!.attendanceMissing).toBe(0);
  });

  it("chỉ quản trị trường (và Platform Admin) xem được; giáo viên, học viên và quản trị trường khác bị từ chối", async () => {
    const s = await setup("ci-report-authz");
    const c = await center(s);
    const other = await prisma.organization.create({ data: { code: `ci-other-${Date.now()}`, name: "Trường khác" } });
    const otherAdmin = await makeUser("ci-report-oa@e.com");
    await prisma.organizationAdmin.create({ data: { organizationId: other.id, userId: otherAdmin } });
    const platform = await makeUser("ci-report-pa@e.com", ["admin"]);
    for (const who of [s.teacher, c.planned, s.learners[0]!, otherAdmin]) {
      await expect(getOrgReconciliation(who, c.org.id, WEEK, at(500))).rejects.toBeInstanceOf(CourseAuthzError);
    }
    await expect(getOrgReconciliation(platform, c.org.id, WEEK, at(500))).resolves.toBeTruthy();
    await expect(getOrgReconciliation(c.admin, c.org.id, WEEK, at(500))).resolves.toBeTruthy();
  });

  it("chỉ tính buổi của khoá thuộc trường đó, buổi huỷ không tính, buổi chưa tới không tính vào 'không check-in'", async () => {
    const s = await setup("ci-report-scope");
    const c = await center(s);
    const s2 = await setup("ci-report-scope-other"); // khoá không thuộc trường nào
    expect(s2.courseId).toBeTruthy();
    await cancelMeeting(s.teacher, s.meetings[0]!.id, { reason: "Nghỉ" }, prisma);
    const rep = await getOrgReconciliation(c.admin, c.org.id, WEEK, new Date("2026-11-02T00:00:00.000Z"));
    expect(rep.meetings).toEqual([]);
    expect(rep.teachers).toEqual([]);
  });
});

describe("editTeacherCheckIn — quản trị sửa khi giáo viên quên bấm (C5.10)", () => {
  it("tạo hoặc sửa dòng check-in kèm lý do bắt buộc; ghi method admin, người sửa, phát attendance.teacher.edited không mang lý do", async () => {
    const s = await setup("ci-edit");
    const c = await center(s);
    const id = s.meetings[0]!.id;
    await expect(editTeacherCheckIn(c.admin, id, { teacherId: c.planned, checkedInAt: at(3).toISOString(), reason: "" })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(editTeacherCheckIn(c.admin, id, { teacherId: "no-such", checkedInAt: at(3).toISOString(), reason: "Quên bấm" })).rejects.toMatchObject({ code: "validation_failed" });

    const reason = "Cô quên bấm, đã xác nhận qua điện thoại";
    const v = await editTeacherCheckIn(c.admin, id, { teacherId: c.planned, checkedInAt: at(3).toISOString(), checkedOutAt: at(118).toISOString(), reason }, at(500));
    expect(v).toMatchObject({ state: "checked_in", flags: ["on_time"], checkIn: { method: "admin", teacherId: c.planned } });
    const row = await prisma.teacherCheckIn.findUniqueOrThrow({ where: { meetingId: id } });
    expect(row).toMatchObject({ editedById: c.admin, editReason: reason });

    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.TeacherCheckInEdited } });
    expect(ev.userId).toBe(c.admin);
    expect(ev.payload).toMatchObject({ meetingId: id, changed: ["teacherId", "checkedInAt", "checkedOutAt"], reasonLength: reason.length });
    expect(JSON.stringify(ev.payload)).not.toContain("quên bấm");

    // sửa lại: chỉ giờ vào đổi
    await editTeacherCheckIn(c.admin, id, { teacherId: c.planned, checkedInAt: at(40).toISOString(), checkedOutAt: at(118).toISOString(), reason: "Chỉnh giờ" }, at(500));
    const ev2 = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.TeacherCheckInEdited }, orderBy: { id: "desc" }, take: 1 });
    expect(ev2[0]!.payload).toMatchObject({ changed: ["checkedInAt"] });
  });

  it("giáo viên (kể cả chủ khoá), học viên và quản trị trường khác không sửa được", async () => {
    const s = await setup("ci-edit-authz");
    const c = await center(s);
    for (const who of [s.teacher, c.planned, s.learners[0]!]) {
      await expect(editTeacherCheckIn(who, s.meetings[0]!.id, { teacherId: c.planned, checkedInAt: at(0).toISOString(), reason: "x" })).rejects.toBeInstanceOf(CourseAuthzError);
    }
    expect(await prisma.teacherCheckIn.count()).toBe(0);
  });
});

describe("ngưỡng theo tổ chức (C5.4)", () => {
  it("quản trị trường đặt 5–120 phút, có nhật ký; người khác bị từ chối", async () => {
    const s = await setup("ci-thr");
    const c = await center(s);
    expect(await setOrgCheckinThreshold(c.admin, c.org.id, 10)).toEqual({ checkinThresholdMin: 10 });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: c.org.id } })).checkinThresholdMin).toBe(10);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "org.checkin_threshold_changed" } })).payload).toMatchObject({ from: 15, to: 10 });
    await expect(setOrgCheckinThreshold(c.admin, c.org.id, 2)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setOrgCheckinThreshold(c.admin, c.org.id, 121)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(setOrgCheckinThreshold(s.teacher, c.org.id, 20)).rejects.toMatchObject({ code: "forbidden" });
  });
});

it("TeacherCheckInError là lỗi có mã", () => {
  expect(new TeacherCheckInError("check_in_closed").code).toBe("check_in_closed");
});
