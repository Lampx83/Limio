import { describe, expect, it } from "vitest";
import { aiSuggestErrorText } from "./aiErrorText";

describe("aiSuggestErrorText", () => {
  it.each(["no_token_budget", "global_token_cap", "daily_token_cap", "rate_limited", "openai_not_configured"])(
    "%s có câu tiếng Việt, không lộ mã thô",
    (code) => {
      const t = aiSuggestErrorText(code);
      expect(t).toBeTruthy();
      expect(t).not.toContain(code);
    },
  );
  it("ví hết: nhắc vẫn chấm tay được", () => {
    expect(aiSuggestErrorText("no_token_budget")).toContain("bằng tay");
  });
  it("mã lạ trả null", () => {
    expect(aiSuggestErrorText("whatever")).toBeNull();
  });
});
