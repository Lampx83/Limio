import { describe, expect, it } from "vitest";
import { computeLevel, levelName, MAX_LEVEL, nextLevelXp } from "../levels";

describe("levels — pure", () => {
  it("level 1 at 0-199 XP", () => {
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(199)).toBe(1);
  });

  it("AC-C1.9: level 2 at 200-499", () => {
    expect(computeLevel(200)).toBe(2);
    expect(computeLevel(350)).toBe(2);
    expect(computeLevel(499)).toBe(2);
  });

  it("level 5 (max) at >= 3500", () => {
    expect(computeLevel(3500)).toBe(MAX_LEVEL);
    expect(computeLevel(99_999)).toBe(MAX_LEVEL);
  });

  it("levelName matches spec tier names", () => {
    expect(levelName(1)).toBe("Newcomer");
    expect(levelName(2)).toBe("Engaged");
    expect(levelName(5)).toBe("Master");
  });

  it("nextLevelXp returns null at max level", () => {
    expect(nextLevelXp(MAX_LEVEL)).toBeNull();
    expect(nextLevelXp(1)).toBe(200);
    expect(nextLevelXp(4)).toBe(3500);
  });
});
