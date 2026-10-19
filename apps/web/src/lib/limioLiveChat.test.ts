import { describe, expect, it } from "vitest";
import { normalizeChatReply, relevantExcerpt, sanitizeChatHistory, CHAT_EXCERPT_CHARS } from "./limioLiveChat";

/** Hỏi đáp với AI về một slide — docs/tieu-chi/nho-ai-hoi-dap.md (K6–K9, K12, K18). */

const current = {
  config: {
    layout: "cards",
    title: "Thứ tự ưu tiên",
    items: [
      { heading: "Mục tiêu", body: "Người học biết cần đạt điều gì.", icon: "target" },
      { heading: "Hiện trạng", body: "Bài làm cho thấy mức đạt hiện tại.", icon: "compass" },
      { heading: "Bước tiếp", body: "Một việc cụ thể để tiến gần mục tiêu.", icon: "route" },
    ],
    outlineId: "o1",
  },
};
const opts = { current, layoutLabel: "Ba thẻ" };

describe("normalizeChatReply", () => {
  it("trả lời bằng lời: giữ câu trả lời và gợi ý sửa, bỏ emoji", () => {
    const r = normalizeChatReply({ kind: "answer", reply: "Ý thứ hai đúng ✅.", options: ["x"], suggestion: "Sửa thẻ hai thành: ...", draft: {} }, opts);
    expect(r).toEqual({ kind: "answer", reply: "Ý thứ hai đúng.", suggestion: "Sửa thẻ hai thành: ..." });
  });

  it("kiểu lạ coi như trả lời bằng lời", () => {
    expect(normalizeChatReply({ kind: "joke", reply: "Chào thầy.", options: [], suggestion: "", draft: {} }, opts).kind).toBe("answer");
  });

  it("hỏi lại: 2 đến 3 hướng, bỏ trùng và rỗng; dưới 2 hướng thì thành trả lời", () => {
    const r = normalizeChatReply({ kind: "clarify", reply: "Thầy/cô muốn theo hướng nào?", options: ["A.", "A.", "", "B.", "C.", "D."], suggestion: "", draft: {} }, opts);
    expect(r).toEqual({ kind: "clarify", reply: "Thầy/cô muốn theo hướng nào?", options: ["A.", "B.", "C."] });
    expect(normalizeChatReply({ kind: "clarify", reply: "Ý thầy/cô là gì?", options: ["A."], suggestion: "", draft: {} }, opts).kind).toBe("answer");
  });

  it("đề xuất: qua proposalFromDraft, lấp phần AI để trống bằng slide hiện tại (K9)", () => {
    const r = normalizeChatReply({ kind: "propose", reply: "Đã đổi tiêu đề.", options: [], suggestion: "", draft: { title: "Các khái niệm", items: [] } }, opts);
    expect(r.kind).toBe("propose");
    if (r.kind !== "propose") return;
    expect(r.proposal.config.title).toBe("Các khái niệm");
    expect((r.proposal.config.items as unknown[]).length).toBe(3);
  });

  it("đề xuất hỏng: nói rõ trong câu trả lời, không có đề xuất rỗng", () => {
    const r = normalizeChatReply({ kind: "propose", reply: "Đây là bản mới.", options: [], suggestion: "", draft: {} }, opts);
    expect(r.kind).toBe("answer");
    expect(r.reply).toContain("Ba thẻ");
  });

  it("bài từ mô tả chủ đề: đề xuất có con số bịa bị loại", () => {
    const r = normalizeChatReply(
      { kind: "propose", reply: "Đã thêm số liệu.", options: [], suggestion: "", draft: { title: "Có 45% giáo viên dùng phản hồi" } },
      { ...opts, ctx: { sourceKind: "topic", sourceText: "Bài về phản hồi." } },
    );
    expect(r.kind).toBe("answer");
  });

  it("câu trả lời rỗng được thay bằng câu báo lỗi", () => {
    expect(normalizeChatReply({ kind: "answer", reply: "  ", options: [], suggestion: "", draft: {} }, opts).reply.length).toBeGreaterThan(10);
  });
});

describe("sanitizeChatHistory", () => {
  it("chỉ nhận vai trò hợp lệ, chữ không rỗng, giữ 6 lượt cuối", () => {
    const raw = [
      { role: "system", text: "x" },
      { role: "user", text: "" },
      ...Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` })),
      "rác",
    ];
    const h = sanitizeChatHistory(raw);
    expect(h).toHaveLength(6);
    expect(h[0]!.text).toBe("t2");
    expect(h.every((t) => t.role === "user" || t.role === "assistant")).toBe(true);
  });
});

describe("relevantExcerpt (K12)", () => {
  it("tài liệu ngắn: giữ nguyên", () => {
    expect(relevantExcerpt("Ngắn.", "x", "document")).toBe("Ngắn.");
  });

  it("tài liệu dài: chọn các đoạn liên quan tới slide và câu hỏi, giữ thứ tự gốc, không quá giới hạn", () => {
    const filler = Array.from({ length: 60 }, (_, i) => `Đoạn ${i} nói về lịch sử giáo dục và các chủ đề không liên quan khác. `.repeat(3)).join("\n\n");
    const doc = `${filler}\n\nPhản hồi hiệu quả cho người học biết mức đạt hiện tại so với mục tiêu.\n\n${filler}`;
    const ex = relevantExcerpt(doc, "Hiện trạng: bài làm cho thấy mức đạt hiện tại so với mục tiêu", "document");
    expect(ex.length).toBeLessThanOrEqual(CHAT_EXCERPT_CHARS);
    expect(ex).toContain("Phản hồi hiệu quả cho người học biết mức đạt hiện tại so với mục tiêu.");
  });

  it("bài có nguồn internet: giữ nguyên dòng đầu [n] của từng nguồn được chọn", () => {
    const pages = Array.from({ length: 5 }, (_, i) => `[${i + 1}] Trang ${i + 1} (https://p${i}.org)\n${(i === 3 ? "Thực tế tăng cường chồng thông tin số lên cảnh thật. " : "Nội dung khác về chủ đề khác. ").repeat(60)}`).join("\n\n");
    const src = `Mô tả.\n\n# Nguồn tìm trên internet\n${pages}`;
    const ex = relevantExcerpt(src, "thực tế tăng cường cảnh thật", "topic_web");
    expect(ex.length).toBeLessThanOrEqual(CHAT_EXCERPT_CHARS);
    expect(ex).toContain("[4] Trang 4 (https://p3.org)");
    expect(ex.startsWith("Mô tả.")).toBe(true);
  });
});
