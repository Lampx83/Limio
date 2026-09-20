import { describe, it, expect } from "vitest";
import { parseTimeInput, formatCountdown, formatDurationLabel, MAX_COUNTDOWN_SECONDS } from "./countdownTime";

describe("parseTimeInput", () => {
  it("số trần = số phút", () => {
    expect(parseTimeInput("7")).toBe(420);
    expect(parseTimeInput(" 15 ")).toBe(900);
  });

  it("m:ss", () => {
    expect(parseTimeInput("12:30")).toBe(750);
    expect(parseTimeInput("0:45")).toBe(45);
  });

  it("h:mm:ss", () => {
    expect(parseTimeInput("1:00:00")).toBe(3600);
    expect(parseTimeInput("1:05:30")).toBe(3930);
  });

  it("từ chối chuỗi không hợp lệ", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("1:2:3:4")).toBeNull();
    expect(parseTimeInput("-5")).toBeNull();
    expect(parseTimeInput("1.5")).toBeNull();
  });

  it("từ chối giây/phút ≥ 60 và thời gian bằng 0", () => {
    expect(parseTimeInput("5:75")).toBeNull();
    expect(parseTimeInput("1:75:00")).toBeNull();
    expect(parseTimeInput("0")).toBeNull();
    expect(parseTimeInput("0:00")).toBeNull();
  });

  it("chặn quá 24 giờ", () => {
    expect(parseTimeInput("1440")).toBe(MAX_COUNTDOWN_SECONDS);
    expect(parseTimeInput("99999")).toBe(MAX_COUNTDOWN_SECONDS);
  });
});

describe("formatCountdown", () => {
  it("mm:ss khi dưới 1 giờ", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("h:mm:ss khi từ 1 giờ", () => {
    expect(formatCountdown(3600)).toBe("1:00:00");
    expect(formatCountdown(3930)).toBe("1:05:30");
  });
});

describe("formatDurationLabel", () => {
  it("gọn theo đơn vị lớn nhất", () => {
    expect(formatDurationLabel(600)).toBe("10 phút");
    expect(formatDurationLabel(90)).toBe("1 phút 30 giây");
    expect(formatDurationLabel(45)).toBe("45 giây");
    expect(formatDurationLabel(3600)).toBe("1 giờ");
    expect(formatDurationLabel(0)).toBe("0 giây");
  });
});
