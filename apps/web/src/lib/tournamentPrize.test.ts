import { describe, expect, it } from "vitest";
import { buildPrizePayload, PRIZE_PRESETS, prizeRows, validatePrize } from "./tournamentPrize";

describe("validatePrize", () => {
  it("không thưởng (0 XP) thì không cần chia", () => {
    expect(validatePrize("0", [])).toEqual({});
    expect(validatePrize("0", ["50", "50"])).toEqual({});
  });

  it("XP phải là số nguyên không âm", () => {
    expect(validatePrize("-5", ["100"]).prizeXp).toBeTruthy();
    expect(validatePrize("abc", ["100"]).prizeXp).toBeTruthy();
    expect(validatePrize("1.5", ["100"]).prizeXp).toBeTruthy();
    expect(validatePrize("", ["100"]).prizeXp).toBeTruthy();
  });

  it("có XP thì tổng tỷ lệ phải đúng 100%", () => {
    expect(validatePrize("500", ["50", "30"]).distribution).toMatch(/đủ 100%/i);
    expect(validatePrize("500", ["60", "50"]).distribution).toMatch(/vượt/i);
    expect(validatePrize("500", ["50", "30", "20"])).toEqual({});
    expect(validatePrize("500", ["33.3", "33.3", "33.4"])).toEqual({});
  });

  it("mỗi hạng phải là số từ 0 đến 100", () => {
    expect(validatePrize("500", ["150"]).distribution).toBeTruthy();
    expect(validatePrize("500", ["-10", "110"]).distribution).toBeTruthy();
  });
});

describe("buildPrizePayload", () => {
  it("bỏ hạng 0%, đánh số theo thứ tự hạng", () => {
    expect(buildPrizePayload("500", ["50", "0", "50"])).toEqual({ prizeXp: 500, prizeDistribution: { "1": 50, "3": 50 } });
  });

  it("0 XP thì xoá phân phối", () => {
    expect(buildPrizePayload("0", ["50", "50"])).toEqual({ prizeXp: 0, prizeDistribution: null });
  });
});

describe("prizeRows", () => {
  it("XP mỗi hạng làm tròn xuống, khớp với máy chủ", () => {
    expect(prizeRows(101, ["50", "50"])).toEqual([
      { rank: 1, percent: 50, xp: 50 },
      { rank: 2, percent: 50, xp: 50 },
    ]);
  });
});

describe("PRIZE_PRESETS", () => {
  it("mọi mẫu cộng đúng 100%", () => {
    for (const p of PRIZE_PRESETS) expect(p.percents.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
