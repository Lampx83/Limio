// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildVocabRuby } from "./lessonVocabRuby";

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
