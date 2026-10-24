import { describe, expect, it } from "vitest";
import type { MeetingItem } from "@feedbackme/core-lms";
import { meetingToItem } from "./calendarData";

const base: MeetingItem = {
  id: "m1",
  sectionId: "s1",
  sectionName: "Lớp A",
  courseId: "c1",
  seq: 3,
  startsAt: "2026-11-03T11:30:00.000Z", // 18:30 giờ Việt Nam, thứ ba 03/11
  endsAt: "2026-11-03T13:30:00.000Z",
  room: "B2",
  plannedTeacherId: null,
  plannedTeacherName: null,
  status: "planned",
  cancelReason: null,
  makeupOfId: null,
  locked: false,
  plan: null,
};

describe("meetingToItem — buổi học thành mục của lịch", () => {
  it("không có giáo án: tên là 'Buổi N'; ngày giờ theo giờ Việt Nam; chi tiết có giờ và phòng", () => {
    const it = meetingToItem(base, "/x");
    expect(it).toMatchObject({
      id: "meeting:m1",
      title: "Buổi 3",
      courseTitle: "Lớp A",
      dueDay: "2026-11-03",
      dueTime: "18:30",
      state: "class",
      stateLabel: "Buổi học",
      kind: "meeting",
      detail: "18:30–20:30 · Phòng B2",
      href: "/x",
    });
  });

  it("có giáo án: tên là tên giáo án, số buổi chuyển xuống chi tiết", () => {
    const it = meetingToItem({ ...base, plan: { courseSlug: "k", sessionNo: 3, moduleId: "mo", title: "Buổi 3: Các con số", lessons: [] } }, "/x");
    expect(it.title).toBe("Buổi 3: Các con số");
    expect(it.detail).toBe("Buổi 3 · 18:30–20:30 · Phòng B2");
  });

  it("buổi dạy bù chưa có số thì gọi là 'Buổi dạy bù'; không phòng thì bỏ ô phòng", () => {
    const it = meetingToItem({ ...base, seq: null, room: null }, "/x");
    expect(it.title).toBe("Buổi dạy bù");
    expect(it.detail).toBe("18:30–20:30");
  });

  it("buổi đã huỷ: trạng thái đã đóng, nhãn 'Đã huỷ', bỏ qua điểm danh", () => {
    const it = meetingToItem({ ...base, status: "cancelled" }, "/x", "present");
    expect(it).toMatchObject({ state: "closed", stateLabel: "Đã huỷ" });
  });

  it.each([
    ["present", "graded", "Có mặt"],
    ["late", "todo", "Đi muộn"],
    ["absent", "overdue", "Vắng"],
    ["excused", "submitted", "Vắng có phép"],
  ] as const)("điểm danh của học viên (%s) hiện thành nhãn %s", (status, state, label) => {
    expect(meetingToItem(base, "/x", status)).toMatchObject({ state, stateLabel: label });
  });

  it("điểm danh chưa có (null) thì vẫn là buổi học", () => {
    expect(meetingToItem(base, "/x", null)).toMatchObject({ state: "class", stateLabel: "Buổi học" });
  });
});

describe("meetingToItem — bài của buổi (I1–I2)", () => {
  const plan = {
    courseSlug: "tieng-trung",
    sessionNo: 3,
    moduleId: "mo",
    title: "Buổi 3: Các con số",
    lessons: [
      { id: "l1", title: "Từ vựng — Các con số" },
      { id: "l2", title: "Hội thoại — Hỏi tuổi" },
    ],
  };

  it("có giáo án: mỗi bài thành một liên kết mở trang học của bài", () => {
    expect(meetingToItem({ ...base, plan }, "/x").lessons).toEqual([
      { id: "l1", title: "Từ vựng — Các con số", href: "/learn/tieng-trung/lessons/l1" },
      { id: "l2", title: "Hội thoại — Hỏi tuổi", href: "/learn/tieng-trung/lessons/l2" },
    ]);
  });

  it("không có giáo án, giáo án rỗng hoặc buổi đã huỷ: không có danh sách bài", () => {
    expect(meetingToItem(base, "/x").lessons).toBeUndefined();
    expect(meetingToItem({ ...base, plan: { ...plan, lessons: [] } }, "/x").lessons).toBeUndefined();
    expect(meetingToItem({ ...base, status: "cancelled", plan }, "/x").lessons).toBeUndefined();
  });
});
