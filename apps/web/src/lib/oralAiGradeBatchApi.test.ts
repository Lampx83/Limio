import { describe, expect, it } from "vitest";
import { OralAiGradeBatchError } from "@feedbackme/core-lms";
import { mapOralAiGradeBatchError } from "./oralAiGradeBatchApi";

describe("mapOralAiGradeBatchError", () => {
  it.each([
    ["forbidden", 403],
    ["exam_not_found", 404],
    ["exam_not_oral", 409],
    ["batch_running", 409],
    ["nothing_to_grade", 409],
  ] as const)("%s → %i", async (code, status) => {
    const r = mapOralAiGradeBatchError(new OralAiGradeBatchError(code));
    expect(r?.status).toBe(status);
    expect(await r!.json()).toEqual({ error: code });
  });
  it("lỗi lạ trả null để tầng gọi ném tiếp", () => {
    expect(mapOralAiGradeBatchError(new Error("boom"))).toBeNull();
  });
});
