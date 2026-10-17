import { describe, expect, it } from "vitest";
import { planSync, syncIsNoop, syncSummary, type ExistingSlide } from "./limioLiveSync";
import type { OutlineSlide } from "./limioLiveOutline";

const row = (id: string): OutlineSlide => ({ id, kind: "content", layout: "image", title: id, points: [] });
const ai = (id: string, outlineId: string, extra: Record<string, unknown> = {}): ExistingSlide => ({ id, type: "content", config: { outlineId, aiGenerated: true, ...extra } });
const manual = (id: string): ExistingSlide => ({ id, type: "content", config: { title: id } });

describe("planSync", () => {
  it("dàn ý không đổi: không có gì để làm, thứ tự giữ nguyên", () => {
    const outline = [row("a"), row("b"), row("c")];
    const slides = [ai("s1", "a"), ai("s2", "b"), ai("s3", "c")];
    const plan = planSync(outline, slides);
    expect(plan.regenerate).toHaveLength(3);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.order.map((e) => (e.kind === "slide" ? e.id : "new"))).toEqual(["s1", "s2", "s3"]);
  });

  it("slide đã sửa tay được giữ nguyên, chỉ slide chưa sửa bị viết lại", () => {
    const plan = planSync([row("a"), row("b")], [ai("s1", "a", { editedByUser: true }), ai("s2", "b")]);
    expect(plan.keep).toEqual(["s1"]);
    expect(plan.regenerate).toEqual([{ slideId: "s2", outlineId: "b" }]);
    expect(syncSummary(plan)).toEqual({ rewrite: 1, add: 0, remove: 0, keep: 1 });
  });

  it("dòng dàn ý mới thì tạo slide mới đúng vị trí", () => {
    const plan = planSync([row("a"), row("x"), row("b")], [ai("s1", "a"), ai("s2", "b")]);
    expect(plan.create).toEqual(["x"]);
    expect(plan.order).toEqual([
      { kind: "slide", id: "s1" },
      { kind: "new", outlineId: "x" },
      { kind: "slide", id: "s2" },
    ]);
  });

  it("dòng dàn ý bị xoá: slide chưa sửa bị xoá, slide đã sửa tay ở lại (mồ côi)", () => {
    const plan = planSync([row("a")], [ai("s1", "a"), ai("s2", "b"), ai("s3", "c", { editedByUser: true })]);
    expect(plan.remove).toEqual(["s2"]);
    expect(plan.orphans).toEqual(["s3"]);
    expect(plan.order.map((e) => (e.kind === "slide" ? e.id : "new"))).toEqual(["s1", "s3"]);
  });

  it("slide tự thêm ở lại sau slide gắn dàn ý đứng trước nó; kéo đổi dàn ý thì slide đi theo", () => {
    const slides = [ai("s1", "a"), manual("m1"), ai("s2", "b"), ai("s3", "c")];
    const swapped = planSync([row("c"), row("a"), row("b")], slides);
    expect(swapped.order.map((e) => (e.kind === "slide" ? e.id : "new"))).toEqual(["s3", "s1", "m1", "s2"]);
  });

  it("slide tự thêm ở đầu bài giữ ở đầu bài", () => {
    const plan = planSync([row("a")], [manual("m0"), ai("s1", "a")]);
    expect(plan.order.map((e) => (e.kind === "slide" ? e.id : "new"))).toEqual(["m0", "s1"]);
    expect(plan.orphans).toEqual(["m0"]);
  });

  it("slide soạn tay có outlineId nhưng không phải AI sinh thì được giữ, không bị xoá", () => {
    const plan = planSync([row("a")], [{ id: "x", type: "content", config: { outlineId: "gone" } }]);
    expect(plan.remove).toEqual([]);
    expect(plan.orphans).toEqual(["x"]);
  });

  it("hai slide cùng outlineId (trùng): chỉ slide đầu tính là gắn dàn ý, slide còn lại là mồ côi/xoá theo cờ", () => {
    const plan = planSync([row("a")], [ai("s1", "a"), ai("s2", "a")]);
    expect(plan.regenerate).toEqual([{ slideId: "s1", outlineId: "a" }]);
    expect(plan.remove).toEqual(["s2"]);
  });

  it("syncIsNoop chỉ đúng khi không viết lại, tạo, xoá và thứ tự không đổi", () => {
    const plan = planSync([row("a")], [ai("s1", "a", { editedByUser: true })]);
    expect(syncIsNoop(plan, ["s1"])).toBe(true);
    expect(syncIsNoop(planSync([row("a")], [ai("s1", "a")]), ["s1"])).toBe(false);
  });
});
