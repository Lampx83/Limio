import { describe, expect, it } from "vitest";
import { hasSeenHelpTour, markHelpTourSeen } from "./helpTour";

describe("hasSeenHelpTour", () => {
  it("returns false when map is null/undefined", () => {
    expect(hasSeenHelpTour(null, "learner")).toBe(false);
    expect(hasSeenHelpTour(undefined, "learner")).toBe(false);
  });

  it("returns false when role key is missing", () => {
    expect(hasSeenHelpTour({ instructor: "2026-01-01T00:00:00.000Z" }, "learner")).toBe(false);
  });

  it("returns true when role key is present", () => {
    expect(hasSeenHelpTour({ learner: "2026-01-01T00:00:00.000Z" }, "learner")).toBe(true);
  });
});

describe("markHelpTourSeen", () => {
  it("creates a map from null", () => {
    const at = new Date("2026-01-01T00:00:00.000Z");
    expect(markHelpTourSeen(null, "learner", at)).toEqual({
      learner: "2026-01-01T00:00:00.000Z",
    });
  });

  it("preserves other roles already marked", () => {
    const at = new Date("2026-01-02T00:00:00.000Z");
    const result = markHelpTourSeen(
      { instructor: "2025-12-31T00:00:00.000Z" },
      "learner",
      at,
    );
    expect(result).toEqual({
      instructor: "2025-12-31T00:00:00.000Z",
      learner: "2026-01-02T00:00:00.000Z",
    });
  });

  it("overwrites the same role idempotently", () => {
    const first = markHelpTourSeen(null, "learner", new Date("2026-01-01T00:00:00.000Z"));
    const second = markHelpTourSeen(first, "learner", new Date("2026-01-05T00:00:00.000Z"));
    expect(second).toEqual({ learner: "2026-01-05T00:00:00.000Z" });
  });
});
