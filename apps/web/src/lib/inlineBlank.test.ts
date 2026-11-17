import { describe, expect, it } from "vitest";
import { splitSingleBlank } from "./inlineBlank";

describe("splitSingleBlank", () => {
  it("một chỗ trống: tách phần trước và sau", () => {
    expect(splitSingleBlank("你______，好好休息一下吧。")).toEqual({ before: "你", after: "，好好休息一下吧。" });
    expect(splitSingleBlank("我也不知道，我去_______。（谁）")).toEqual({ before: "我也不知道，我去", after: "。（谁）" });
    expect(splitSingleBlank("你好嗎＿＿＿")).toEqual({ before: "你好嗎", after: "" });
  });
  it("không có / nhiều chỗ trống, nhiều dòng, có thẻ HTML, hoặc gạch dưới ngắn: không nhận", () => {
    expect(splitSingleBlank("没有空")).toBeNull();
    expect(splitSingleBlank("A ___ B ___ C")).toBeNull();
    expect(splitSingleBlank("dòng một\nA ___ B")).toBeNull();
    expect(splitSingleBlank("<b>x</b> ___")).toBeNull();
    expect(splitSingleBlank("a __ b")).toBeNull();
  });
});
