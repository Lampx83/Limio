import { describe, expect, it } from "vitest";
import {
  continueButtonText,
  describeLevel,
  gapText,
  gapToNextRank,
  levelNameVi,
  streakLabel,
} from "./courseHomeView";

describe("describeLevel", () => {
  it("viết thành câu tiếng Việt, không dùng mũi tên hay ký hiệu L2", () => {
    const s = describeLevel({ level: 1, levelName: "Newcomer", xpToNext: 140, isMaxLevel: false });
    expect(s).toBe("Cấp 1 · Người mới. Cần thêm 140 XP để lên cấp 2.");
    expect(s).not.toContain("→");
  });
  it("cấp cao nhất thì không nói về cấp kế tiếp", () => {
    expect(describeLevel({ level: 5, levelName: "Master", xpToNext: 0, isMaxLevel: true })).toBe(
      "Cấp 5 · Bậc thầy (cấp cao nhất)",
    );
  });
  it("không biết còn bao nhiêu XP thì chỉ nói cấp hiện tại", () => {
    expect(describeLevel({ level: 2, levelName: "Engaged", xpToNext: null, isMaxLevel: false })).toBe(
      "Cấp 2 · Chăm chỉ",
    );
  });
  it("tên cấp lạ giữ nguyên", () => {
    expect(levelNameVi("Legend")).toBe("Legend");
  });
});

describe("continueButtonText", () => {
  it("nói rõ tên bài", () => {
    expect(continueButtonText("continue", "Bài 1.2 · Quy trình thiết kế")).toBe(
      "Tiếp tục: Bài 1.2 · Quy trình thiết kế",
    );
    expect(continueButtonText("start", "Bài 1.1")).toBe("Bắt đầu: Bài 1.1");
  });
  it("không tìm được tên bài thì quay về câu chung", () => {
    expect(continueButtonText("continue", null)).toBe("Tiếp tục bài gần nhất");
    expect(continueButtonText("start", null)).toBe("Bắt đầu học");
  });
});

describe("streakLabel", () => {
  it("nói rõ chuỗi tính theo ngày học", () => {
    expect(streakLabel(3)).toBe("Học liên tục 3 ngày");
  });
});

describe("gapToNextRank", () => {
  const entries = [
    { rank: 1, xp: 300 },
    { rank: 2, xp: 220 },
    { rank: 3, xp: 150 },
  ];
  it("tính khoảng cách tới người ngay trên", () => {
    const g = gapToNextRank({ entries, me: { rank: 3, xp: 150 } });
    expect(g).toEqual({ aboveRank: 2, gapXp: 70 });
    expect(gapText(g!)).toBe("Còn cách hạng 2 70 XP.");
  });
  it("đứng đầu thì không có người trên", () => {
    expect(gapToNextRank({ entries, me: { rank: 1, xp: 300 } })).toBeNull();
  });
  it("người ngay trên không nằm trong danh sách đang hiện thì không đoán", () => {
    expect(gapToNextRank({ entries, me: { rank: 9, xp: 10 } })).toBeNull();
  });
  it("không có dữ liệu của mình thì không hiện", () => {
    expect(gapToNextRank({ entries, me: null })).toBeNull();
  });
  it("ngang điểm thì nói là ngang điểm", () => {
    expect(gapText({ aboveRank: 2, gapXp: 0 })).toBe("Bạn đang ngang điểm với hạng 2.");
  });
});
