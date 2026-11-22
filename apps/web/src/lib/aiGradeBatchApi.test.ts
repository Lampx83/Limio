import { describe, expect, it } from "vitest";
import { AiGradeBatchError } from "@feedbackme/core-lms";
import { mapAiGradeBatchError } from "./aiGradeBatchApi";

describe("mapAiGradeBatchError", () => {
  it.each([
    ["forbidden", 403],
    ["assignment_not_found", 404],
    ["batch_running", 409],
    ["nothing_to_grade", 409],
  ] as const)("%s → %i", async (code, status) => {
    const r = mapAiGradeBatchError(new AiGradeBatchError(code));
    expect(r?.status).toBe(status);
    expect(await r!.json()).toEqual({ error: code });
  });
  it("lỗi lạ trả null để tầng gọi ném tiếp", () => {
    expect(mapAiGradeBatchError(new Error("boom"))).toBeNull();
  });
});
