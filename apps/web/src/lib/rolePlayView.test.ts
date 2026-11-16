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

describe("compareSpoken — câu mẫu tiếng Trung (so từng chữ Hán, bỏ pinyin và dấu câu khi chấm)", () => {
  const exp = "我的行李怎么还没出来？是不是丢了？";

  it("nói đúng hết thì khớp mọi chữ Hán", () => {
    const r = compareSpoken(exp, "我的行李怎么还没出来是不是丢了");
    expect(r.okCount).toBe(r.total);
    expect(r.total).toBe(15);
    expect(r.extra).toEqual([]);
  });

  it("máy nghe nhầm một chữ (掉 thay 丢) thì chỉ chữ đó bị đánh dấu thiếu", () => {
    const r = compareSpoken(exp, "我的行李怎么还没出来是不是掉了");
    expect(r.okCount).toBe(14);
    expect(r.words.filter((w) => w.scored && !w.ok).map((w) => w.text)).toEqual(["丢"]);
    expect(r.extra).toEqual(["掉"]);
  });

  it("pinyin giáo viên ghi kèm trong câu mẫu không tính điểm và vẫn hiện", () => {
    const withPinyin = `${exp} Wǒ de xínglǐ zěnme hái méi chūlái? Shì bùshì diūle`;
    const r = compareSpoken(withPinyin, "我的行李怎么还没出来是不是丢了");
    expect(r.total).toBe(15);
    expect(r.okCount).toBe(15);
    expect(r.words.some((w) => w.text === "Wǒ" && w.scored === false && w.ok)).toBe(true);
  });

  it("hiển thị lại câu mẫu đúng như đã soạn: chữ Hán liền nhau, dấu cách chỉ ở chỗ có trong câu mẫu", () => {
    const r = compareSpoken("你好吗？ Nǐ hǎo ma?", "");
    expect(r.words.map((w) => w.text + (w.sep ?? " ")).join("")).toBe("你好吗？ Nǐ hǎo ma?");
  });

  it("câu mẫu không có chữ Hán giữ cách so cũ (theo từ, bỏ dấu)", () => {
    const r = compareSpoken("Hello there", "hello THERE");
    expect(r.okCount).toBe(2);
  });
});

describe("compareSpoken — máy trả chữ phồn thể, câu mẫu giản thể", () => {
  const exp = "这是杨同乐吗？他怎么跟白家月在一起？";

  it("chữ phồn thể cùng nghĩa khớp với giản thể", () => {
    const r = compareSpoken(exp, "這是楊同樂嗎?他怎麼跟白家月在一起?");
    expect(r.okCount).toBe(r.total);
    expect(r.extra).toEqual([]);
  });

  it("chỉ chữ nghe nhầm thật mới bị đánh dấu; phần thừa giữ nguyên dạng nghe được", () => {
    const r = compareSpoken(exp, "這是楊同樂嗎?他怎麼跟白兆越在一起?");
    expect(r.total).toBe(16);
    expect(r.okCount).toBe(14);
    expect(r.words.filter((w) => w.scored && !w.ok).map((w) => w.text)).toEqual(["家", "月"]);
    expect(r.extra).toEqual(["兆", "越"]);
  });

  it("câu mẫu viết phồn thể thì nói giản thể cũng khớp", () => {
    const r = compareSpoken("你好嗎？", "你好吗");
    expect(r.okCount).toBe(r.total);
  });
});
