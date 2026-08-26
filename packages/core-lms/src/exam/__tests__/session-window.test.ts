import { describe, expect, it } from "vitest";
import {
  isSessionOpen,
  sessionOpenState,
  type SessionWindowInput,
} from "../session-window";

const NOW = new Date("2026-08-26T10:00:00.000Z");

function scheduled(over: Partial<SessionWindowInput> = {}): SessionWindowInput {
  return {
    timingMode: "scheduled",
    status: "draft",
    opensAt: new Date("2026-08-26T09:00:00.000Z"),
    closesAt: new Date("2026-08-26T11:00:00.000Z"),
    ...over,
  };
}

function manual(over: Partial<SessionWindowInput> = {}): SessionWindowInput {
  return {
    timingMode: "manual",
    status: "open",
    opensAt: new Date("2026-08-26T09:00:00.000Z"),
    closesAt: null,
    ...over,
  };
}

describe("ca hẹn giờ — hành vi cũ không được đổi", () => {
  it("mở khi đang trong cửa sổ", () => {
    expect(sessionOpenState(scheduled(), NOW)).toBe("open");
  });

  it("chưa tới giờ khi trước opensAt", () => {
    const s = scheduled({ opensAt: new Date("2026-08-26T10:30:00.000Z") });
    expect(sessionOpenState(s, NOW)).toBe("not_yet");
  });

  it("đã đóng khi qua closesAt", () => {
    const s = scheduled({ closesAt: new Date("2026-08-26T09:30:00.000Z") });
    expect(sessionOpenState(s, NOW)).toBe("closed");
  });

  it("KHÔNG quan tâm status — ca draft vẫn mở, đúng như trước đây", () => {
    expect(sessionOpenState(scheduled({ status: "draft" }), NOW)).toBe("open");
    expect(sessionOpenState(scheduled({ status: "closed" }), NOW)).toBe("open");
  });

  it("coi như đóng nếu thiếu closesAt — không mở vô hạn vì dữ liệu hỏng", () => {
    expect(sessionOpenState(scheduled({ closesAt: null }), NOW)).toBe("closed");
  });

  it("biên: đúng giây opensAt là mở, đúng giây closesAt là đóng", () => {
    const opensAt = new Date("2026-08-26T10:00:00.000Z");
    expect(sessionOpenState(scheduled({ opensAt }), NOW)).toBe("open");
    const closesAt = new Date("2026-08-26T10:00:00.000Z");
    expect(sessionOpenState(scheduled({ closesAt }), NOW)).toBe("closed");
  });
});

describe("ca thủ công — status là nguồn sự thật", () => {
  it("status=open thì mở", () => {
    expect(sessionOpenState(manual(), NOW)).toBe("open");
    expect(isSessionOpen(manual(), NOW)).toBe(true);
  });

  it("status=closed thì đóng", () => {
    expect(sessionOpenState(manual({ status: "closed" }), NOW)).toBe("closed");
  });

  it("status=draft là chưa mở", () => {
    expect(sessionOpenState(manual({ status: "draft" }), NOW)).toBe("not_yet");
  });

  it("status=archived là đóng", () => {
    expect(sessionOpenState(manual({ status: "archived" }), NOW)).toBe("closed");
  });

  it("bỏ qua hoàn toàn opensAt/closesAt", () => {
    // Mốc giờ nằm tít trong quá khứ nhưng vẫn mở vì status=open.
    const s = manual({
      opensAt: new Date("2020-01-01T00:00:00.000Z"),
      closesAt: new Date("2020-01-02T00:00:00.000Z"),
    });
    expect(sessionOpenState(s, NOW)).toBe("open");

    // Và ngược lại: mốc giờ tương lai vẫn đóng vì GV đã bấm đóng.
    const t = manual({
      status: "closed",
      opensAt: new Date("2020-01-01T00:00:00.000Z"),
      closesAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    expect(sessionOpenState(t, NOW)).toBe("closed");
  });
});
