import { describe, expect, it } from "vitest";
import { BLANK_SEP, joinBlankAnswers, parsePassageBlanks, splitBlankAnswers } from "./passageBlanks";

const doc = {
  content: [
    { type: "image", attrs: { src: "/api/exam-assets/x.jpg", alt: "Hai cô gái" } },
    { type: "paragraph", content: [{ type: "text", text: "A：照片上的这个人是你男朋友吗？" }] },
    { type: "paragraph", content: [{ type: "text", text: "A：我______他是你男朋友。我好像______。" }] },
    { type: "paragraph", content: [{ type: "text", text: "B：你应该没见过。他今天来北京，下午我去机场______。" }] },
  ],
};

describe("parsePassageBlanks", () => {
  it("đếm đúng 3 chỗ trống theo thứ tự, tách chữ và chỗ trống từng dòng", () => {
    const r = parsePassageBlanks(doc)!;
    expect(r.count).toBe(3);
    expect(r.nodes[0]).toEqual({ kind: "image", src: "/api/exam-assets/x.jpg", alt: "Hai cô gái" });
    expect(r.nodes[2]).toEqual({ kind: "line", parts: [{ text: "A：我" }, { blank: 0 }, { text: "他是你男朋友。我好像" }, { blank: 1 }, { text: "。" }] });
    expect(r.nodes[3]).toEqual({ kind: "line", parts: [{ text: "B：你应该没见过。他今天来北京，下午我去机场" }, { blank: 2 }, { text: "。" }] });
  });
  it("không nhận: không chỗ trống, có khối lạ, ảnh ngoài hệ thống, rỗng", () => {
    expect(parsePassageBlanks({ content: [{ type: "paragraph", content: [{ type: "text", text: "không có" }] }] })).toBeNull();
    expect(parsePassageBlanks({ content: [{ type: "table" }, { type: "paragraph", content: [{ type: "text", text: "a ____ b" }] }] })).toBeNull();
    expect(parsePassageBlanks({ content: [{ type: "image", attrs: { src: "https://evil/x.jpg" } }, { type: "paragraph", content: [{ type: "text", text: "a ____ b" }] }] })).toBeNull();
    expect(parsePassageBlanks({ content: [{ type: "paragraph", content: [{ type: "audio" }, { type: "text", text: "a ____" }] }] })).toBeNull();
    expect(parsePassageBlanks({ content: [] })).toBeNull();
    expect(parsePassageBlanks(null)).toBeNull();
  });
});

describe("joinBlankAnswers / splitBlankAnswers", () => {
  it("gộp theo thứ tự chỗ trống; chưa gõ gì thì rỗng", () => {
    expect(joinBlankAnswers(["以为", "在哪儿见过他", "接他"])).toBe(`以为${BLANK_SEP}在哪儿见过他${BLANK_SEP}接他`);
    expect(joinBlankAnswers(["", " ", ""])).toBe("");
    expect(joinBlankAnswers(["以为", "", ""])).toBe(`以为${BLANK_SEP}${BLANK_SEP}`);
  });
  it("tách lại đúng từng ô (kể cả ô trống ở giữa); đáp án cũ không theo khuôn dồn vào ô đầu", () => {
    expect(splitBlankAnswers(joinBlankAnswers(["以为", "", "接他"]), 3)).toEqual(["以为", "", "接他"]);
    expect(splitBlankAnswers("", 3)).toEqual(["", "", ""]);
    expect(splitBlankAnswers("我以为他是你男朋友", 3)).toEqual(["我以为他是你男朋友", "", ""]);
  });
});
