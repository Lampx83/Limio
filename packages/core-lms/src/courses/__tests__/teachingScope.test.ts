import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  addMakeupMeeting,
  cancelMeeting,
  getClassSchedule,
  listTeacherMeetings,
  setClassSchedule,
  updateMeeting,
} from "../classSchedule";
import {
  getMeetingAttendance,
  getSectionAttendanceSummary,
  markAllPresent,
  markAttendance,
} from "../attendance";
import { getCoursePlan } from "../coursePacks";
import { getTeachingScope } from "../teachingScope";
import { CourseAuthzError } from "../authz";
import { createCourse } from "../courses";
import { createCourseSection } from "../sections";
import { vnDateTime } from "../classScheduleCalc";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";
const SETUP_NOW = new Date("2026-10-23T03:00:00.000Z");
const RANGE = { from: "2026-11-01", to: "2026-12-31" };

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function addToCourse(courseId: string, userId: string, role: string) {
  await prisma.courseInstructor.create({ data: { courseId, userId, role } });
}

/**
 * Khoá của `owner` với:
 *  - lớp A: 4 buổi thứ ba/thứ năm; thứ ba do T dạy, thứ năm do U dạy → buổi 1, 3 của T; buổi 2, 4 của U;
 *  - lớp B: chỉ U dạy (T không liên quan);
 *  - lớp C: không gán giáo viên cho buổi nào nhưng T là giáo viên phụ trách lớp.
 */
async function setup(tag: string) {
  const owner = await makeUser(`ts-${tag}-o@e.com`);
  const coEditor = await makeUser(`ts-${tag}-co@e.com`);
  const T = await makeUser(`ts-${tag}-t@e.com`);
  const U = await makeUser(`ts-${tag}-u@e.com`);
  const assistant = await makeUser(`ts-${tag}-ta@e.com`);
  const stranger = await makeUser(`ts-${tag}-x@e.com`);
  const admin = await makeUser(`ts-${tag}-admin@e.com`);
  await grantRole(admin, { targetUserId: admin, roleName: "admin" });

  const { courseId } = await createCourse(owner, { title: `Khoá ${tag}`, description: "d", slug: `ts-${tag}` });
  await addToCourse(courseId, coEditor, "co-instructor");
  await addToCourse(courseId, T, "non-editing-teacher");
  await addToCourse(courseId, U, "non-editing-teacher");
  await addToCourse(courseId, assistant, "teaching-assistant");

  const A = await createCourseSection(owner, courseId, { name: "Lớp A" });
  const B = await createCourseSection(owner, courseId, { name: "Lớp B" });
  const C = await createCourseSection(owner, courseId, { name: "Lớp C" });
  await setClassSchedule(
    owner,
    A.id,
    {
      startDate: "2026-11-03",
      totalMeetings: 4,
      slots: [
        { weekday: 2, startTime: "18:30", durationMin: 120, plannedTeacherId: T },
        { weekday: 4, startTime: "18:30", durationMin: 120, plannedTeacherId: U },
      ],
    },
    prisma,
    SETUP_NOW,
  );
  await setClassSchedule(
    owner,
    B.id,
    { startDate: "2026-11-03", totalMeetings: 2, slots: [{ weekday: 3, startTime: "09:00", durationMin: 90, plannedTeacherId: U }] },
    prisma,
    SETUP_NOW,
  );
  await setClassSchedule(
    owner,
    C.id,
    { startDate: "2026-11-03", totalMeetings: 2, slots: [{ weekday: 5, startTime: "14:00", durationMin: 90 }] },
    prisma,
    SETUP_NOW,
  );
  await prisma.courseSection.update({ where: { id: C.id }, data: { instructorId: T } });

  const mA = await prisma.classMeeting.findMany({ where: { sectionId: A.id }, orderBy: { startsAt: "asc" } });
  const learner = await makeUser(`ts-${tag}-l@e.com`);
  await prisma.enrollment.create({ data: { userId: learner, courseId, sectionId: A.id, courseVersion: 1 } });

  return { owner, coEditor, T, U, assistant, stranger, admin, courseId, A: A.id, B: B.id, C: C.id, mA, learner };
}

describe("getTeachingScope (H3)", () => {
  it("chủ khoá, đồng giảng viên, Platform Admin → manage; non-editing và trợ giảng → teach; người ngoài → null", async () => {
    const s = await setup("scope");
    expect(await getTeachingScope(s.owner, s.courseId)).toBe("manage");
    expect(await getTeachingScope(s.coEditor, s.courseId)).toBe("manage");
    expect(await getTeachingScope(s.admin, s.courseId)).toBe("manage");
    expect(await getTeachingScope(s.T, s.courseId)).toBe("teach");
    expect(await getTeachingScope(s.assistant, s.courseId)).toBe("teach");
    expect(await getTeachingScope(s.stranger, s.courseId)).toBeNull();
    expect(await getTeachingScope(s.learner, s.courseId)).toBeNull();
  });

  it("khoá không tồn tại → null, không báo lỗi", async () => {
    const s = await setup("scope-nf");
    expect(await getTeachingScope(s.owner, "no-such-course")).toBeNull();
  });
});

describe("quyền quản lịch chỉ dành cho manage (H4)", () => {
  it("người chỉ được dạy (teach) không đặt, huỷ, dạy bù hay sửa buổi được; dữ liệu không đổi", async () => {
    const s = await setup("h4");
    const before = await prisma.classMeeting.findMany({ where: { sectionId: s.A }, orderBy: { startsAt: "asc" } });

    for (const who of [s.T, s.assistant]) {
      await expect(
        setClassSchedule(who, s.A, { startDate: "2026-11-03", totalMeetings: 8, slots: [{ weekday: 1, startTime: "08:00", durationMin: 60 }] }, prisma, SETUP_NOW),
      ).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(cancelMeeting(who, s.mA[0]!.id, { reason: "x" })).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(updateMeeting(who, s.mA[0]!.id, { room: "Z" })).rejects.toBeInstanceOf(CourseAuthzError);
      await expect(
        addMakeupMeeting(who, s.A, { startsAt: vnDateTime("2026-11-07", "10:00").toISOString(), durationMin: 60 }),
      ).rejects.toBeInstanceOf(CourseAuthzError);
    }
    const after = await prisma.classMeeting.findMany({ where: { sectionId: s.A }, orderBy: { startsAt: "asc" } });
    expect(after.map((m) => [m.id, m.status, m.room, m.startsAt.getTime()])).toEqual(
      before.map((m) => [m.id, m.status, m.room, m.startsAt.getTime()]),
    );
  });

  it("chủ khoá và đồng giảng viên vẫn quản lịch bình thường", async () => {
    const s = await setup("h4ok");
    await expect(updateMeeting(s.owner, s.mA[0]!.id, { room: "B9" })).resolves.toBeTruthy();
    await expect(updateMeeting(s.coEditor, s.mA[1]!.id, { room: "B8" })).resolves.toBeTruthy();
  });
});

describe("xem lịch và chuyên cần theo lớp được xếp (H5)", () => {
  it("giảng viên chỉ xem được lớp mình được xếp; lớp khác bị từ chối", async () => {
    const s = await setup("h5");
    expect((await getClassSchedule(s.T, s.A)).meetings).toHaveLength(4); // có buổi của mình
    await expect(getClassSchedule(s.T, s.B)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getSectionAttendanceSummary(s.T, s.B)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(getSectionAttendanceSummary(s.T, s.A)).resolves.toBeTruthy();
  });

  it("giáo viên phụ trách lớp (instructorId) xem được lớp dù chưa gán buổi nào", async () => {
    const s = await setup("h5c");
    expect((await getClassSchedule(s.T, s.C)).meetings).toHaveLength(2);
    await expect(getClassSchedule(s.U, s.C)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("chủ khoá và Platform Admin xem mọi lớp; người ngoài khoá bị từ chối", async () => {
    const s = await setup("h5m");
    for (const sec of [s.A, s.B, s.C]) {
      await expect(getClassSchedule(s.owner, sec)).resolves.toBeTruthy();
      await expect(getClassSchedule(s.admin, sec)).resolves.toBeTruthy();
    }
    await expect(getClassSchedule(s.stranger, s.A)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("điểm danh chỉ cho buổi được xếp (H6)", () => {
  const T1_OPEN = vnDateTime("2026-11-03", "18:15"); // buổi 1 (của T)
  const U2_OPEN = vnDateTime("2026-11-05", "18:15"); // buổi 2 (của U)

  it("T điểm danh buổi của mình được; buổi của U bị từ chối ở cả ba thao tác và không ghi gì", async () => {
    const s = await setup("h6");
    await expect(getMeetingAttendance(s.T, s.mA[0]!.id, prisma, T1_OPEN)).resolves.toBeTruthy();
    await expect(
      markAttendance(s.T, s.mA[0]!.id, { entries: [{ userId: s.learner, status: "present" }] }, prisma, T1_OPEN),
    ).resolves.toMatchObject({ changed: 1 });

    await expect(getMeetingAttendance(s.T, s.mA[1]!.id, prisma, U2_OPEN)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(
      markAttendance(s.T, s.mA[1]!.id, { entries: [{ userId: s.learner, status: "present" }] }, prisma, U2_OPEN),
    ).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(markAllPresent(s.T, s.mA[1]!.id, prisma, U2_OPEN)).rejects.toBeInstanceOf(CourseAuthzError);
    expect(await prisma.studentAttendance.count({ where: { meetingId: s.mA[1]!.id } })).toBe(0);
  });

  it("chủ khoá điểm danh được buổi của bất kỳ giáo viên nào; trợ giảng chưa được xếp thì không", async () => {
    const s = await setup("h6m");
    await expect(markAllPresent(s.owner, s.mA[1]!.id, prisma, U2_OPEN)).resolves.toMatchObject({ marked: 1 });
    await expect(markAllPresent(s.assistant, s.mA[0]!.id, prisma, T1_OPEN)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("buổi chưa gán giáo viên của lớp T phụ trách: T điểm danh được", async () => {
    const s = await setup("h6c");
    const [c1] = await prisma.classMeeting.findMany({ where: { sectionId: s.C }, orderBy: { startsAt: "asc" } });
    await expect(getMeetingAttendance(s.T, c1!.id, prisma, vnDateTime("2026-11-07", "13:45"))).resolves.toBeTruthy();
    await expect(getMeetingAttendance(s.U, c1!.id, prisma, vnDateTime("2026-11-07", "13:45"))).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("danh sách buổi theo người xem (H7)", () => {
  it("người manage thấy mọi buổi của khoá; mỗi giáo viên chỉ thấy buổi của mình", async () => {
    const s = await setup("h7");
    const ids = async (u: string) => (await listTeacherMeetings(u, RANGE)).map((m) => m.id).sort();

    const all = await prisma.classMeeting.findMany({ where: { section: { courseId: s.courseId } } });
    expect(await ids(s.owner)).toEqual(all.map((m) => m.id).sort());

    const forT = await listTeacherMeetings(s.T, RANGE);
    // T: buổi 1 và 3 của lớp A + hai buổi chưa gán giáo viên của lớp C (T phụ trách).
    expect(forT.filter((m) => m.sectionId === s.A).map((m) => m.id).sort()).toEqual([s.mA[0]!.id, s.mA[2]!.id].sort());
    expect(forT.filter((m) => m.sectionId === s.C)).toHaveLength(2);
    expect(forT.some((m) => m.sectionId === s.B)).toBe(false);

    const forU = await listTeacherMeetings(s.U, RANGE);
    expect(forU.filter((m) => m.sectionId === s.A).map((m) => m.id).sort()).toEqual([s.mA[1]!.id, s.mA[3]!.id].sort());
    expect(forU.filter((m) => m.sectionId === s.B)).toHaveLength(2);
    expect(forU.some((m) => m.sectionId === s.C)).toBe(false);
  });

  it("T và U không thấy buổi của nhau; người ngoài không thấy gì", async () => {
    const s = await setup("h7x");
    const t = new Set((await listTeacherMeetings(s.T, RANGE)).map((m) => m.id));
    const u = new Set((await listTeacherMeetings(s.U, RANGE)).map((m) => m.id));
    for (const id of t) expect(u.has(id)).toBe(false);
    expect(await listTeacherMeetings(s.stranger, RANGE)).toEqual([]);
  });
});

describe("giáo án của khoá (H8)", () => {
  it("manage và teach đọc được; người ngoài bị từ chối", async () => {
    const s = await setup("h8");
    await expect(getCoursePlan(s.owner, s.courseId)).resolves.toBeTruthy();
    await expect(getCoursePlan(s.T, s.courseId)).resolves.toBeTruthy();
    await expect(getCoursePlan(s.stranger, s.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});
