import { describe, expect, it } from "vitest";
import { SIMPLIFY_TABLE_SIZE, simplifyChineseTranscript, toSimplified } from "./hanScript";

describe("toSimplified", () => {
  it("đổi phồn thể sang giản thể theo từng chữ", () => {
    expect(toSimplified("這是楊同樂嗎?他怎麼跟白家月在一起?")).toBe("这是杨同乐吗?他怎么跟白家月在一起?");
    expect(toSimplified("學習電腦開車買東西")).toBe("学习电脑开车买东西");
  });
  it("giữ nguyên giản thể, chữ Latin, số và dấu câu", () => {
    expect(toSimplified("你好 Nǐ hǎo 123, ok!")).toBe("你好 Nǐ hǎo 123, ok!");
  });
  it("không đổi nhầm các chữ giản thể thông dụng", () => {
    const common = "的一是不了人我在有他这中大来上个国到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工话儿者向情部正名定女问力机给等几很业最间新什写使各次相";
    expect(toSimplified(common)).toBe(common);
  });
  it("bảng đủ lớn", () => {
    expect(SIMPLIFY_TABLE_SIZE).toBeGreaterThan(2500);
  });
});

describe("simplifyChineseTranscript — chữ máy nghe được theo ngôn ngữ khoá", () => {
  const trad = "這是楊同樂嗎";
  it("khoá tiếng Trung giản thể (zh, zh-CN, zh-Hans) đổi sang giản thể", () => {
    for (const lang of ["zh", "ZH", "zh-CN", "zh_cn", "zh-Hans"]) expect(simplifyChineseTranscript(trad, lang), lang).toBe("这是杨同乐吗");
  });
  it("khoá tiếng Trung phồn thể giữ nguyên", () => {
    for (const lang of ["zh-TW", "zh-HK", "zh-Hant", "zh_tw"]) expect(simplifyChineseTranscript(trad, lang), lang).toBe(trad);
  });
  it("ngôn ngữ khác hoặc không có thì giữ nguyên", () => {
    for (const lang of ["en", "ja", "vi", "", null]) expect(simplifyChineseTranscript(trad, lang), String(lang)).toBe(trad);
    expect(simplifyChineseTranscript("zhong wen", "zh")).toBe("zhong wen");
  });
});
