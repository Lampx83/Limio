import { describe, expect, it } from "vitest";
import { audioLimit, audioPlayView } from "@/lib/examAudio";

describe("audioLimit — khớp audioPlayLimit của máy chủ", () => {
  it("free không giới hạn; limited theo max; once đúng 1; dữ liệu hỏng thì thắt chặt", () => {
    expect(audioLimit("free_replay", null)).toBeNull();
    expect(audioLimit("limited_replay", 3)).toBe(3);
    expect(audioLimit("once_only", 9)).toBe(1);
    expect(audioLimit("limited_replay", null)).toBe(1);
    expect(audioLimit("limited_replay", 0)).toBe(1);
  });
});

describe("audioPlayView", () => {
  it("free: không giới hạn, luôn phát được, không có dòng nhắc", () => {
    expect(audioPlayView("free_replay", null, 7)).toMatchObject({ unlimited: true, canPlay: true, label: "" });
  });
  it("once_only chưa nghe: phát được và nói rõ luật", () => {
    const v = audioPlayView("once_only", null, 0);
    expect(v).toMatchObject({ unlimited: false, remaining: 1, canPlay: true });
    expect(v.label).toContain("1 lần");
  });
  it("once_only đã nghe: hết lượt, không phát được", () => {
    expect(audioPlayView("once_only", null, 1)).toMatchObject({ remaining: 0, canPlay: false, label: "Đã hết lượt nghe" });
  });
  it("limited 3 lượt đã dùng 1: còn 2; dùng 3 hoặc hơn: hết (không âm)", () => {
    expect(audioPlayView("limited_replay", 3, 1)).toMatchObject({ remaining: 2, canPlay: true });
    expect(audioPlayView("limited_replay", 3, 1).label).toContain("Còn 2 lượt");
    expect(audioPlayView("limited_replay", 3, 3)).toMatchObject({ remaining: 0, canPlay: false });
    expect(audioPlayView("limited_replay", 3, 5)).toMatchObject({ remaining: 0, canPlay: false });
  });
});
