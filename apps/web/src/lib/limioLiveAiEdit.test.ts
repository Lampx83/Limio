import { describe, expect, it } from "vitest";
import { proposalFromDraft, type SlideDraft } from "./limioLiveGenerate";

/**
 * Nhờ AI sửa slide: với yêu cầu chỉ nhắm vào một phần (vd. "Sửa tiêu đề thành..."), mô hình hay chỉ trả trường được nhắc.
 * Đề xuất phải giữ phần còn lại của slide hiện tại thay vì báo "AI chưa viết lại được".
 */

const cards = {
  layout: "cards",
  title: "Thứ tự ưu tiên",
  items: [
    { heading: "Mục tiêu", body: "Người học biết cần đạt điều gì.", icon: "target" },
    { heading: "Hiện trạng", body: "Bài làm cho thấy mức đạt hiện tại.", icon: "compass" },
    { heading: "Bước tiếp", body: "Một việc cụ thể để tiến gần mục tiêu.", icon: "route" },
  ],
  outlineId: "o1",
  aiGenerated: true,
  presenterNote: "Ghi chú cũ.",
};
const current = { config: cards };
const titleOnly: SlideDraft = { index: 0, title: "Các khái niệm", items: [] };

describe("proposalFromDraft: bản nháp chỉ có phần được yêu cầu đổi", () => {
  it("nháp chỉ có tiêu đề mới: đề xuất có tiêu đề mới và giữ ba thẻ cũ", () => {
    const p = proposalFromDraft("custom", current, titleOnly);
    expect(p).not.toBeNull();
    expect(p!.config.title).toBe("Các khái niệm");
    expect((p!.config.items as Array<{ heading: string }>).map((i) => i.heading)).toEqual(["Mục tiêu", "Hiện trạng", "Bước tiếp"]);
    expect(p!.config).toMatchObject({ layout: "cards", outlineId: "o1", presenterNote: "Ghi chú cũ." });
  });

  it("mục để trống trong nháp (chuỗi rỗng) cũng được lấp từ slide hiện tại", () => {
    const p = proposalFromDraft("custom", current, { ...titleOnly, items: [{ heading: "", body: "", icon: "" }] });
    expect((p!.config.items as unknown[]).length).toBe(3);
  });

  it("áp cho viết ngắn hơn, thêm ví dụ, dễ hiểu hơn", () => {
    for (const a of ["shorter", "example", "simpler"] as const) expect(proposalFromDraft(a, current, titleOnly)?.config.title).toBe("Các khái niệm");
  });

  it("không áp cho viết lại từ dàn ý và đổi thành quiz", () => {
    expect(proposalFromDraft("rewrite", current, titleOnly)).toBeNull();
    expect(proposalFromDraft("to_quiz", current, titleOnly)).toBeNull();
  });

  it("nháp rỗng hoàn toàn hoặc không có nháp vẫn trả null (không đề xuất y hệt slide cũ)", () => {
    expect(proposalFromDraft("custom", current, { index: 0 })).toBeNull();
    expect(proposalFromDraft("custom", current, { index: 0, title: "  ", items: [], bullets: [] })).toBeNull();
    expect(proposalFromDraft("custom", current, undefined)).toBeNull();
  });

  it("bài có nguồn: chỉ đổi tiêu đề thì giữ dòng nguồn cũ; nháp có số nguồn mới thì thay", () => {
    const ctx = { sourceKind: "topic_web" as const, sourceText: "nguồn", refs: [{ n: 1, title: "A", url: "https://a.org" }, { n: 2, title: "B", url: "https://b.org" }] };
    const cited = { config: { ...cards, cite: "Nguồn: [1]" } };
    expect(proposalFromDraft("custom", cited, titleOnly, ctx)!.config.cite).toBe("Nguồn: [1]");
    const fresh = proposalFromDraft("custom", cited, { ...titleOnly, title: "Các khái niệm [2]" }, ctx)!;
    expect(fresh.config.title).toBe("Các khái niệm");
    expect(fresh.config.cite).toBe("Nguồn: [2]");
  });
});
