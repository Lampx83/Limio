import { describe, expect, it } from "vitest";
import { CHECKIN_FLAG_LABEL, CHECKIN_STATE_LABEL, checkInDetail } from "./checkInLabels";

describe("nhãn đối chiếu lịch dạy (C5.4, C5.9)", () => {
  it("năm nhãn đúng theo tiêu chí", () => {
    expect(CHECKIN_FLAG_LABEL).toEqual({
      on_time: "Đúng giờ",
      late: "Trễ",
      early_end: "Kết thúc sớm",
      substitute: "Dạy thay",
      no_check_in: "Không check-in",
    });
  });

  it("không dùng ngôn ngữ chấm công hay phạt", () => {
    const all = [...Object.values(CHECKIN_FLAG_LABEL), ...Object.values(CHECKIN_STATE_LABEL)].join(" ").toLowerCase();
    for (const bad of ["chấm công", "phạt", "vi phạm", "kỷ luật", "trừ lương"]) expect(all).not.toContain(bad);
  });

  it("dòng giải thích nêu số phút khi trễ hoặc kết thúc sớm", () => {
    expect(checkInDetail({ flags: ["late"], minutesAfterStart: 20, minutesBeforeEnd: null })).toBe("vào sau giờ bắt đầu 20 phút");
    expect(checkInDetail({ flags: ["on_time", "early_end"], minutesAfterStart: 0, minutesBeforeEnd: 16 })).toBe("kết thúc sớm 16 phút");
    expect(checkInDetail({ flags: ["late", "early_end"], minutesAfterStart: 20, minutesBeforeEnd: 30 })).toBe("vào sau giờ bắt đầu 20 phút; kết thúc sớm 30 phút");
    expect(checkInDetail({ flags: ["on_time"], minutesAfterStart: 0, minutesBeforeEnd: null })).toBeNull();
  });
});
