import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getSectionScheduleSummaries, summarizeSchedule } from "../scheduleSummary";
import { createCourseSection } from "../sections";
import { setClassSchedule } from "../classSchedule";
import { CourseAuthzError } from "../authz";
import { BEFORE, makeUser, setup } from "./meetingFixture";

const slot = (weekday: number, startTime = "18:30") => ({ weekday, startTime });
const NEXT = new Date("2026-10-27T11:30:00.000Z"); // 18:30 thứ ba 27/10 giờ VN

describe("summarizeSchedule — một dòng trên thẻ lớp", () => {
  it("nhiều buổi, hai thứ cùng giờ, có buổi tới", () => {
    expect(summarizeSchedule({ meetings: 24, slots: [slot(2), slot(4)], nextStartsAt: NEXT })).toBe(
      "24 buổi, thứ ba và thứ năm 18:30, buổi tới 27/10",
    );
  });

  it("ba thứ trở lên cùng giờ: liệt kê bằng dấu phẩy, 'và' trước thứ cuối; sắp theo thứ trong tuần", () => {
    expect(summarizeSchedule({ meetings: 36, slots: [slot(5), slot(1), slot(3)], nextStartsAt: NEXT })).toBe(
      "36 buổi, thứ hai, thứ tư và thứ sáu 18:30, buổi tới 27/10",
    );
  });

  it("giờ khác nhau thì ghi giờ cho từng thứ; chủ nhật gọi là 'chủ nhật'", () => {
    expect(summarizeSchedule({ meetings: 10, slots: [slot(7, "09:00"), slot(2)], nextStartsAt: NEXT })).toBe(
      "10 buổi, thứ ba 18:30 và chủ nhật 09:00, buổi tới 27/10",
    );
  });

  it("khung trùng nhau chỉ tính một lần", () => {
    expect(summarizeSchedule({ meetings: 5, slots: [slot(2), slot(2)], nextStartsAt: NEXT })).toBe("5 buổi, thứ ba 18:30, buổi tới 27/10");
  });

  it("ngày của buổi tới tính theo giờ Việt Nam (17:30 UTC đã là 00:30 hôm sau)", () => {
    expect(summarizeSchedule({ meetings: 2, slots: [], nextStartsAt: new Date("2026-10-27T17:30:00.000Z") })).toBe("2 buổi, buổi tới 28/10");
  });

  it("không còn buổi sắp tới thì nói rõ, không bỏ lửng", () => {
    expect(summarizeSchedule({ meetings: 24, slots: [slot(2)], nextStartsAt: null })).toBe("24 buổi, thứ ba 18:30, không còn buổi sắp tới");
  });

  it("chưa có buổi nào: mời đặt lịch", () => {
    expect(summarizeSchedule({ meetings: 0, slots: [], nextStartsAt: null })).toBe("Chưa có lịch, đặt lịch ngay");
    expect(summarizeSchedule({ meetings: 0, slots: [slot(2)], nextStartsAt: null })).toBe("Chưa có lịch, đặt lịch ngay");
  });
});

describe("getSectionScheduleSummaries — theo từng lớp của khoá", () => {
  it("lớp có lịch: tóm tắt đúng, đếm không tính buổi huỷ; lớp chưa có lịch: mời đặt lịch", async () => {
    const s = await setup("ss-a"); // lớp A: 3 buổi, thứ ba 18:30, từ 03/11/2026
    const b = await createCourseSection(s.teacher, s.courseId, { name: "Lớp B" });
    await prisma.classMeeting.update({ where: { id: s.meetings[2]!.id }, data: { status: "cancelled" } });

    const res = await getSectionScheduleSummaries(s.teacher, s.courseId, BEFORE);
    expect(res[s.sectionId]).toMatchObject({ hasSchedule: true, meetings: 2, text: "2 buổi, thứ ba 18:30, buổi tới 03/11" });
    expect(res[b.id]).toEqual({ hasSchedule: false, meetings: 0, text: "Chưa có lịch, đặt lịch ngay" });
  });

  it("chỉ tính buổi từ lúc 'bây giờ': buổi đã qua không phải 'buổi tới'", async () => {
    const s = await setup("ss-b");
    const res = await getSectionScheduleSummaries(s.teacher, s.courseId, new Date("2026-11-04T00:00:00.000Z"));
    expect(res[s.sectionId]!.text).toBe("3 buổi, thứ ba 18:30, buổi tới 10/11");
    const after = await getSectionScheduleSummaries(s.teacher, s.courseId, new Date("2027-01-01T00:00:00.000Z"));
    expect(after[s.sectionId]!.text).toBe("3 buổi, thứ ba 18:30, không còn buổi sắp tới");
  });

  it("buổi dạy bù (không thuộc khung giờ nào) vẫn được đếm", async () => {
    const s = await setup("ss-c");
    await setClassSchedule(s.teacher, s.sectionId, { startDate: "2026-11-03", totalMeetings: 3, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120 }] }, prisma, BEFORE);
    const res = await getSectionScheduleSummaries(s.teacher, s.courseId, BEFORE);
    expect(res[s.sectionId]!.meetings).toBe(3);
  });

  it("chỉ người xem được các lớp của khoá mới gọi được", async () => {
    const s = await setup("ss-d");
    const stranger = await makeUser("ss-d-x@e.com", ["instructor"]);
    await expect(getSectionScheduleSummaries(stranger, s.courseId, BEFORE)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});
