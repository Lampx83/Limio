import { describe, expect, it } from "vitest";
import { splitPassageInstruction, type PassageDoc } from "./passageInstruction";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC2. */
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const doc = (...content: unknown[]): PassageDoc => ({ type: "doc", content });

describe("splitPassageInstruction — tách đề bài ra khỏi nội dung đoạn", () => {
  it("đoạn đầu là một câu thuần chữ: thành đề bài, phần còn lại giữ nguyên thứ tự", () => {
    const body1 = p(t("A", [{ type: "bold" }]), t(" ‘I take after my parents…’ (Jake)"));
    const body2 = p(t("B", [{ type: "bold" }]), t(" ‘I took over the family’s law business…’ (Suki)"));
    const r = splitPassageInstruction(doc(p(t("Find the ten multi-word verbs in the texts and complete each one to match its definition.")), body1, body2));
    expect(r.instruction).toBe("Find the ten multi-word verbs in the texts and complete each one to match its definition.");
    expect(r.rest.content).toEqual([body1, body2]);
  });

  it("đoạn chỉ có đề bài (phiếu bạn ảo): đề bài có, phần còn lại rỗng", () => {
    const r = splitPassageInstruction(doc(p(t("No partner? Practise with a virtual partner. You can type or speak."))));
    expect(r.instruction).toContain("No partner?");
    expect(r.rest.content).toEqual([]);
  });

  it("đoạn chỉ có MỘT câu thuần chữ mà không phải lời mời bạn ảo thì là nội dung (bài đọc ngắn), không phải đề bài", () => {
    const d = doc(p(t("Coffee was discovered in Ethiopia.")));
    const r = splitPassageInstruction(d);
    expect(r.instruction).toBeNull();
    expect(r.rest).toEqual(d);
  });

  it("đoạn đầu có chữ đậm hoặc nhiều đoạn chữ (ô trống, nhãn): không coi là đề bài, không mất chữ nào", () => {
    const labelled = doc(p(t("INTONATION: statement questions", [{ type: "bold" }])), p(t("Listen and repeat.")));
    const r1 = splitPassageInstruction(labelled);
    expect(r1.instruction).toBeNull();
    expect(r1.rest).toEqual(labelled);

    const gaps = doc(p(t("Complete the rules with "), t("have", [{ type: "bold" }]), t(" and the past participle.")));
    const r2 = splitPassageInstruction(gaps);
    expect(r2.instruction).toBeNull();
    expect(r2.rest).toEqual(gaps);
  });

  it("đoạn mở đầu bằng tiêu đề, ảnh hay bảng: không có đề bài", () => {
    for (const first of [{ type: "heading", attrs: { level: 2 }, content: [t("Lifestyle")] }, { type: "image", attrs: { src: "/x.png" } }]) {
      const d = doc(first, p(t("Read the text.")));
      const r = splitPassageInstruction(d);
      expect(r.instruction).toBeNull();
      expect(r.rest).toEqual(d);
    }
  });

  it("đoạn quá dài hoặc rỗng không phải đề bài", () => {
    expect(splitPassageInstruction(doc(p(t("x".repeat(301))))).instruction).toBeNull();
    expect(splitPassageInstruction(doc(p(t("   ")))).instruction).toBeNull();
    expect(splitPassageInstruction(doc()).instruction).toBeNull();
  });

  it("không đổi tài liệu gốc", () => {
    const d = doc(p(t("Read the text.")), p(t("Body.")));
    const copy = JSON.parse(JSON.stringify(d));
    splitPassageInstruction(d);
    expect(d).toEqual(copy);
  });
});
