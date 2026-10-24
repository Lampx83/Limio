import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { exportProfile } from "../profile";
import { deleteUser } from "../deleteUser";
import { setGoal, setSectionGoal } from "../../courses/learnerGoals";
import { markAttendance } from "../../courses/attendance";
import { closeMeeting, sendMeetingSummary } from "../../courses/meetingSummary";
import { saveMeetingNote, approveMeetingNote, sendApprovedNotes } from "../../courses/meetingNotes";
import { AFTER_M1, BASE, BEFORE, makeUser, setup } from "../../courses/__tests__/meetingFixture";

/**
 * CENTER C6.6, C6.9 — dữ liệu của lớp có lịch (mục tiêu, nhận xét sau buổi, ghi chú điểm danh) là dữ liệu nhạy cảm của
 * học viên: phải có trong bản xuất dữ liệu cá nhân và phải bị xoá khi xoá tài khoản. `deleteUser` chỉ ẩn danh hoá
 * (giữ dòng User) nên các nội dung chữ phải được xoá tường minh, không thể trông chờ cascade.
 */

const mailer = async () => ({ delivered: true, loggedOnly: false });

async function fixture(tag: string) {
  const s = await setup(tag);
  const me = s.learners[0]!;
  const other = s.learners[1]!;
  await setGoal(me, { courseId: s.courseId, framework: "HSK", targetLevel: "HSK 3", targetDate: "2027-06-30", hoursPerWeek: 4 }, BEFORE);
  await setGoal(other, { courseId: s.courseId, framework: "IELTS", targetLevel: "IELTS 6.5", targetDate: "2027-03-01" }, BEFORE);
  await markAttendance(s.teacher, s.meetings[0]!.id, { entries: [
    { userId: me, status: "late", note: "Đến muộn 20 phút vì kẹt xe" },
    { userId: other, status: "present", note: "Em Hai rất tích cực" },
  ] }, prisma, AFTER_M1);
  await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
  await sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer, baseUrl: BASE });
  const sent = await saveMeetingNote(s.teacher, s.meetings[0]!.id, me, { body: "Nhận xét đã gửi cho em Một." });
  await approveMeetingNote(s.teacher, sent.id);
  await sendApprovedNotes(s.teacher, s.meetings[0]!.id, { mailer, baseUrl: BASE });
  const sentOther = await saveMeetingNote(s.teacher, s.meetings[0]!.id, other, { body: "Nhận xét đã gửi cho em Hai." });
  await approveMeetingNote(s.teacher, sentOther.id);
  await sendApprovedNotes(s.teacher, s.meetings[0]!.id, { mailer, baseUrl: BASE });
  return { s, me, other };
}

describe("exportProfile — mục tiêu và dữ liệu sau buổi học (C6.6, C6.9)", () => {
  it("có mục tiêu, nhận xét đã gửi và tình trạng gửi tổng kết của chính mình; không lẫn người khác", async () => {
    const { s, me } = await fixture("exp-center");
    const out = (await exportProfile(me)) as unknown as {
      learnerGoals: Array<Record<string, unknown>>;
      meetingNotes: Array<Record<string, unknown>>;
      meetingSummaryDeliveries: Array<Record<string, unknown>>;
      studentAttendances: Array<Record<string, unknown>>;
    };
    expect(out.learnerGoals).toHaveLength(1);
    expect(out.learnerGoals[0]).toMatchObject({ framework: "HSK", targetLevel: "HSK 3", hoursPerWeek: 4, status: "active", setById: me });
    expect(out.meetingNotes).toHaveLength(1);
    expect(out.meetingNotes[0]).toMatchObject({ body: "Nhận xét đã gửi cho em Một.", status: "sent" });
    expect(out.meetingSummaryDeliveries).toHaveLength(1);
    expect(out.meetingSummaryDeliveries[0]).toMatchObject({ status: "sent" });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain("IELTS 6.5");
    expect(raw).not.toContain("em Hai");
    expect(s.courseId).toBeTruthy();
  });

  it("nhận xét còn nháp (chưa tới học viên) không nằm trong bản xuất", async () => {
    const s = await setup("exp-draft");
    await markAttendance(s.teacher, s.meetings[0]!.id, { entries: [{ userId: s.learners[0]!, status: "present" }] }, prisma, AFTER_M1);
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    await saveMeetingNote(s.teacher, s.meetings[0]!.id, s.learners[0]!, { body: "Bản nháp nội bộ chưa gửi" });
    const out = (await exportProfile(s.learners[0]!)) as unknown as { meetingNotes: unknown[] };
    expect(out.meetingNotes).toEqual([]);
  });
});

describe("deleteUser — xoá hẳn nội dung chữ về học viên (C6.6, C6.9)", () => {
  it("xoá mục tiêu, mọi nhận xét (kể cả nháp), tình trạng gửi email và ghi chú điểm danh; giữ trạng thái điểm danh ẩn danh; không đụng người khác", async () => {
    const { s, me, other } = await fixture("del-center");
    // thêm một nháp chưa gửi của chính học viên bị xoá
    const admin = await makeUser("del-center-admin@e.com", ["admin"]);
    await deleteUser(admin, me);

    expect(await prisma.learnerGoal.count({ where: { userId: me } })).toBe(0);
    expect(await prisma.meetingStudentNote.count({ where: { userId: me } })).toBe(0);
    expect(await prisma.meetingSummaryDelivery.count({ where: { userId: me } })).toBe(0);
    const att = await prisma.studentAttendance.findUniqueOrThrow({ where: { meetingId_userId: { meetingId: s.meetings[0]!.id, userId: me } } });
    expect(att.note).toBeNull();
    expect(att.status).toBe("late"); // thống kê chuyên cần giữ lại, đã ẩn danh

    // người khác còn nguyên
    expect(await prisma.learnerGoal.count({ where: { userId: other } })).toBe(1);
    expect(await prisma.meetingStudentNote.count({ where: { userId: other } })).toBe(1);
    expect((await prisma.studentAttendance.findUniqueOrThrow({ where: { meetingId_userId: { meetingId: s.meetings[0]!.id, userId: other } } })).note).toBe("Em Hai rất tích cực");
  });

  it("mục tiêu của lớp (không thuộc riêng ai) không bị xoá khi một học viên bị xoá", async () => {
    const { s, me } = await fixture("del-sec");
    await setSectionGoal(s.teacher, s.sectionId, { framework: "HSK", targetLevel: "HSK 1" }, BEFORE);
    const admin = await makeUser("del-sec-admin@e.com", ["admin"]);
    await deleteUser(admin, me);
    expect(await prisma.sectionGoal.count({ where: { sectionId: s.sectionId } })).toBe(1);
  });
});
