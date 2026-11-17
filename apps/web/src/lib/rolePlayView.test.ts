import { describe, expect, it } from "vitest";
import { restoreSpoken, answerTextOf, compareSpoken, otherRole, parseRolePlay, parseScript, scriptTextOf, splitReading, alignReading, pinyinSyllables, mainTextLang, wordKey } from "./rolePlayView";

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

describe("splitReading — tách chữ Hán và phiên âm để hiện hai dòng", () => {
  it("câu có pinyin đi sau: chữ Hán (kèm dấu câu) là phần chính, pinyin là dòng phiên âm", () => {
    expect(splitReading("这只小猫你们养了多久了?  Zhè zhī xiǎomāo nǐmen yǎng le duō jiǔ le?")).toEqual({
      main: "这只小猫你们养了多久了?",
      reading: "Zhè zhī xiǎomāo nǐmen yǎng le duō jiǔ le?",
    });
    expect(splitReading("已经一年多了。第一天看见它的时候，它又脏又小。 Yǐjīng yì nián duō le. Dìyī tiān kànjiàn tā.")).toEqual({
      main: "已经一年多了。第一天看见它的时候，它又脏又小。",
      reading: "Yǐjīng yì nián duō le. Dìyī tiān kànjiàn tā.",
    });
  });
  it("chữ Latin lẫn trong câu chữ Hán vẫn ở phần chính", () => {
    expect(splitReading("我用 App 学习。 Wǒ yòng App xuéxí.")).toEqual({ main: "我用 App 学习。", reading: "Wǒ yòng App xuéxí." });
  });
  it("tiếng Nhật: kana cũng là phần chính, romaji là phiên âm", () => {
    expect(splitReading("日本語です。 Nihongo desu.")).toEqual({ main: "日本語です。", reading: "Nihongo desu." });
  });
  it("không có phiên âm đi sau, hoặc câu không có chữ Hán, thì giữ nguyên", () => {
    expect(splitReading("你好吗？")).toEqual({ main: "你好吗？", reading: "" });
    expect(splitReading("I’ve got that, too.")).toEqual({ main: "I’ve got that, too.", reading: "" });
    expect(splitReading("")).toEqual({ main: "", reading: "" });
  });
  it("tách xong chấm điểm vẫn như cũ: phiên âm không tính", () => {
    const text = "你好吗？ Nǐ hǎo ma?";
    const a = compareSpoken(text, "你好吗");
    const b = compareSpoken(splitReading(text).main, "你好吗");
    expect([b.okCount, b.total]).toEqual([a.okCount, a.total]);
  });
});

describe("pinyinSyllables / alignReading — pinyin thẳng hàng dưới từng chữ Hán", () => {
  it("tách từ ghi liền thành âm tiết", () => {
    expect(pinyinSyllables("xiǎomāo")).toEqual(["xiǎo", "māo"]);
    expect(pinyinSyllables("nǐmen")).toEqual(["nǐ", "men"]);
    expect(pinyinSyllables("Yǐjīng")).toEqual(["yǐ", "jīng"]);
    expect(pinyinSyllables("xiānggǎng")).toEqual(["xiāng", "gǎng"]);
    expect(pinyinSyllables("piàoliang")).toEqual(["piào", "liang"]);
    expect(pinyinSyllables("gānjìng")).toEqual(["gān", "jìng"]);
    expect(pinyinSyllables("yìdiǎnr")).toEqual(["yì", "diǎn", "r"]);
    expect(pinyinSyllables("nǚ")).toEqual(["nǚ"]);
    expect(pinyinSyllables("123")).toBeNull();
  });
  it("ghép đủ một âm tiết cho mỗi chữ Hán, bỏ dấu câu", () => {
    const main = "这只小猫你们养了多久了?";
    const reading = "Zhè zhī xiǎomāo nǐmen yǎng le duō jiǔ le?";
    expect(alignReading(main, reading)).toEqual(["zhè", "zhī", "xiǎo", "māo", "nǐ", "men", "yǎng", "le", "duō", "jiǔ", "le"]);
  });
  it("câu nhiều đoạn, dấu phẩy, chấm", () => {
    const syl = alignReading("已经一年多了。第一天看见它的时候，它又脏又小。", "Yǐjīng yì nián duō le. Dìyī tiān kànjiàn tā de shíhou, tā yòu zāng yòu xiǎo.");
    expect(syl).toHaveLength(20);
    expect(syl?.[0]).toBe("yǐ");
    expect(syl?.[19]).toBe("xiǎo");
  });
  it("số âm tiết khác số chữ Hán, hoặc có chữ Latin/kana, thì không ghép (null)", () => {
    expect(alignReading("你好吗？", "Nǐ hǎo?")).toBeNull();
    expect(alignReading("我用 App 学习。", "Wǒ yòng App xuéxí.")).toBeNull();
    expect(alignReading("日本語です。", "Nihongo desu.")).toBeNull();
    expect(alignReading("你好", "")).toBeNull();
  });
  it("mainTextLang phân biệt Trung/Nhật/Hàn", () => {
    expect(mainTextLang("你好吗？")).toBe("zh-Hans");
    expect(mainTextLang("日本語です。")).toBe("ja");
    expect(mainTextLang("안녕하세요")).toBe("ko");
    expect(mainTextLang("Hello")).toBeUndefined();
  });
});
