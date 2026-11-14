import { describe, expect, it } from "vitest";
import { restoreSpoken, answerTextOf, compareSpoken, otherRole, parseRolePlay, parseScript, scriptTextOf, wordKey } from "./rolePlayView";

const cfg = {
  roleplay: {
    roles: { A: "Khách", B: "" },
    turns: [
      { speaker: "A", text: "Chocolate! It’s good for use energy.", audio: "/api/exam-assets/a1.m4a" },
      { speaker: "B", text: "I was thinking the same thing.", audio: "../hack.m4a" },
      { speaker: "C", text: "bỏ" },
      { speaker: "A", text: "   " },
      "rác",
    ],
  },
};

describe("parseRolePlay", () => {
  it("giữ lượt hợp lệ, bỏ lượt sai dạng và audio sai đường dẫn, tên vai rỗng thì dùng A/B", () => {
    const rp = parseRolePlay(cfg)!;
    expect(rp.turns).toEqual([
      { speaker: "A", text: "Chocolate! It’s good for use energy.", audio: "/api/exam-assets/a1.m4a" },
      { speaker: "B", text: "I was thinking the same thing." },
    ]);
    expect(rp.roles).toEqual({ A: "Khách", B: "B" });
  });
  it("ít hơn hai lượt hoặc không có roleplay thì null", () => {
    expect(parseRolePlay({})).toBeNull();
    expect(parseRolePlay({ roleplay: { turns: [{ speaker: "A", text: "x" }] } })).toBeNull();
    expect(parseRolePlay(null)).toBeNull();
  });
  it("otherRole", () => {
    expect(otherRole("A")).toBe("B");
    expect(otherRole("B")).toBe("A");
  });
});

describe("compareSpoken", () => {
  it("nói đúng hết: mọi từ ok, không có từ thừa; bỏ qua hoa thường, dấu câu và dấu nháy cong", () => {
    const r = compareSpoken("I’ve got that, too.", "i've got that too");
    expect(r.words.every((w) => w.ok)).toBe(true);
    expect(r).toMatchObject({ okCount: 4, total: 4, extra: [] });
  });
  it("thiếu từ thì từ đó không ok; các từ còn lại vẫn khớp đúng chỗ", () => {
    const r = compareSpoken("I was thinking the same thing", "I was thinking same thing");
    expect(r.words.map((w) => w.ok)).toEqual([true, true, true, false, true, true]);
    expect(r.okCount).toBe(5);
  });
  it("nói thừa hoặc nói khác: liệt kê từ thừa, từ mẫu bị thay thì không ok", () => {
    const r = compareSpoken("It is good for energy", "it is really good to energy");
    expect(r.words.map((w) => w.ok)).toEqual([true, true, true, false, true]);
    expect(r.extra).toEqual(["really", "to"]);
  });
  it("nói rỗng thì không từ nào ok", () => {
    expect(compareSpoken("Hello there", "").okCount).toBe(0);
  });
  it("wordKey bỏ dấu và dấu câu", () => {
    expect(wordKey("Café,")).toBe("cafe");
    expect(wordKey("don’t")).toBe("dont");
  });
});

describe("bản chữ và kịch bản", () => {
  const rp = parseRolePlay({
    roleplay: { turns: [{ speaker: "A", text: "Hi." }, { speaker: "B", text: "Hello." }, { speaker: "A", text: "Bye." }] },
  })!;
  it("answerTextOf chỉ gồm lượt của vai đã chọn và đã nói, theo thứ tự", () => {
    expect(answerTextOf("A", rp, { 0: "hi", 2: "bye", 1: "hello" })).toBe("[Role A]\n1. A: hi\n3. A: bye");
    expect(answerTextOf("B", rp, {})).toBe("");
  });
  it("scriptTextOf ghép cả hội thoại", () => {
    expect(scriptTextOf(rp)).toBe("A: Hi.\nB: Hello.\nA: Bye.");
  });
  it("parseScript đọc A:/B:, báo dòng sai", () => {
    expect(parseScript("A: Hi.\n\nb：Hello there\nxin chào\nA:")).toEqual({
      turns: [
        { speaker: "A", text: "Hi." },
        { speaker: "B", text: "Hello there" },
      ],
      badLines: [4, 5],
    });
  });
});

describe("restoreSpoken", () => {
  const rp = parseRolePlay({ roleplay: { turns: [{ speaker: "A", text: "Hi." }, { speaker: "B", text: "Hello." }, { speaker: "A", text: "Bye." }] } })!;
  it("đọc lại đúng vai và đúng lượt (khớp answerTextOf), kể cả khi bỏ qua lượt đầu", () => {
    expect(restoreSpoken(answerTextOf("A", rp, { 0: "hi there", 2: "bye" }), rp)).toEqual({ role: "A", spoken: { 0: "hi there", 2: "bye" } });
    expect(restoreSpoken(answerTextOf("A", rp, { 2: "bye" }), rp)).toEqual({ role: "A", spoken: { 2: "bye" } });
  });
  it("sai dạng, lượt không thuộc vai, hoặc rỗng thì null", () => {
    expect(restoreSpoken("xin chào", rp)).toBeNull();
    expect(restoreSpoken("[Role B]\n1. B: a", rp)).toBeNull();
    expect(restoreSpoken("[Role A]\n", rp)).toBeNull();
  });
});
