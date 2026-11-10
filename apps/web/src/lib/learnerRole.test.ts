import { describe, expect, it } from "vitest";
import { isLearnerRole } from "./learnerRole";

describe("isLearnerRole", () => {
  it("học viên: true; giảng viên và admin: false", () => {
    expect(isLearnerRole("learner")).toBe(true);
    expect(isLearnerRole("instructor")).toBe(false);
    expect(isLearnerRole("admin")).toBe(false);
  });
});
