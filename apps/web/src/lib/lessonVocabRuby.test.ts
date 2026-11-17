// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildVocabCards, buildVocabRuby, parseVocabTable } from "./lessonVocabRuby";

const th = (t: string) => `<th>${t}</th>`;
const td = (t: string) => `<td>${t}</td>`;
const table = (rows: string[][]) => `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i === 0 ? th(c) : td(c))).join("")}</tr>`).join("")}</table>`;
const wrapHan = (s: string) => `<span style="font-size:1.3em">${s}</span>`;

describe("buildVocabRuby — pinyin dưới từ trong bảng từ mới", () => {
  it("bỏ cột Pinyin, ghép từng âm tiết dưới từng chữ Hán", () => {
    const html = table([
      [wrapHan("词"), "Pinyin", wrapHan("词性"), "Tiếng Việt"],
      [wrapHan("以为"), "yǐwéi", "đg.", "nghĩ rằng"],
    ]);
    const out = buildVocabRuby(html);
    expect(out).not.toContain("<th>Pinyin</th>");
    expect(out).not.toContain(">yǐwéi<");
    expect(out).toContain('<ruby class="ruby-han"><span>以</span><rt>yǐ</rt></ruby>');
    expect(out).toContain('<ruby class="ruby-han"><span>为</span><rt>wéi</rt></ruby>');
    expect(out).toContain("đg.");
    expect(out).toContain("nghĩ rằng");
    // còn đúng 3 cột
    const doc = new DOMParser().parseFromString(out, "text/html");
    expect(doc.querySelectorAll("tr")[1]!.cells).toHaveLength(3);
  });

  it("pinyin lệch số chữ thì để thành dòng nhỏ dưới từ, không ghép bừa", () => {
    const out = buildVocabRuby(table([["词", "Pinyin", "nghĩa"], ["你好吗", "nǐ hǎo", "khoẻ không"]]));
    expect(out).not.toContain("<ruby");
    expect(out).toContain('<div class="vocab-reading">nǐ hǎo</div>');
  });

  it("từ có dấu gạch chéo (hai cách nói) vẫn ghép được", () => {
    const out = buildVocabRuby(table([["词", "Pinyin", "nghĩa"], ["难过/难受", "nánguò/nánshòu", "buồn"]]));
    expect(out).toContain("<rt>nán</rt>");
    expect(out).toContain("<rt>shòu</rt>");
  });

  it("bảng khác (không có cột Pinyin sau cột chữ Hán) và HTML thường giữ nguyên", () => {
    const other = table([["Tên", "Tuổi"], ["An", "20"]]);
    expect(buildVocabRuby(other)).toBe(other);
    const plain = "<p>Pinyin là hệ phiên âm</p>";
    expect(buildVocabRuby(plain)).toBe(plain);
    const noHan = table([["Word", "Pinyin"], ["a", "b"]]);
    expect(buildVocabRuby(noHan)).toBe(noHan);
  });
});

describe("parseVocabTable / buildVocabCards — thẻ từ mới và flashcard theo bảng của sách", () => {
  const html = table([
    [wrapHan("词"), "Pinyin", wrapHan("词性"), "Tiếng Việt"],
    [wrapHan("以为"), "yǐwéi", "đg.", "nghĩ rằng"],
    [wrapHan("北京南站"), "Běijīng Nán Zhàn", "d.", "ga Bắc Kinh Nam"],
    [wrapHan("二十"), "èrshí", "st.", "hai mươi"],
  ]);
  it("đọc đủ các dòng đúng thứ tự, gồm cả tên riêng", () => {
    expect(parseVocabTable(html)).toEqual([
      { term: "以为", reading: "yǐwéi", pos: "đg.", meaning: "nghĩ rằng" },
      { term: "北京南站", reading: "Běijīng Nán Zhàn", pos: "d.", meaning: "ga Bắc Kinh Nam" },
      { term: "二十", reading: "èrshí", pos: "st.", meaning: "hai mươi" },
    ]);
  });
  it("dựng lưới thẻ: loại từ, ruby dưới từng chữ, nghĩa; bảng biến mất", () => {
    const out = buildVocabCards(html);
    expect(out).toContain('<ul class="hsk-words">');
    expect(out).not.toContain("<table");
    expect(out).toContain('<span class="hsk-pos">đg.</span>');
    expect(out).toContain("<rt>yǐ</rt>");
    expect(out).toContain("<rt>èr</rt>"); // âm tiết er
    expect(out).toContain('<p class="hsk-wc-mean">nghĩ rằng</p>');
    expect((out.match(/class="hsk-wc"/g) ?? []).length).toBe(3);
  });
  it("pinyin lệch số chữ: dòng nhỏ dưới từ, không ghép bừa", () => {
    const out = buildVocabCards(table([[wrapHan("词"), "Pinyin", wrapHan("词性"), "Tiếng Việt"], [wrapHan("你好吗"), "nǐ hǎo", "c.", "khoẻ không"]]));
    expect(out).toContain('<span class="vocab-reading">nǐ hǎo</span>');
    expect(out).not.toContain("<ruby");
    // 北京南站: 4 chữ Hán, 4 âm tiết (Běi jīng Nán Zhàn) nên ghép được từng chữ
    expect(buildVocabCards(html)).toContain("<rt>zhàn</rt>");
  });
  it("HTML không có bảng từ mới thì giữ nguyên / null", () => {
    expect(buildVocabCards("<p>a</p>")).toBe("<p>a</p>");
    expect(parseVocabTable("<p>a</p>")).toBeNull();
    expect(parseVocabTable(table([["Tên", "Tuổi"], ["An", "20"]]))).toBeNull();
  });
});
