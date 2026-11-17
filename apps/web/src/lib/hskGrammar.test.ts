// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { grammarPhrases, hskGrammarHtml, readGrammarData } from "./hskGrammar";

const html =
  '<h2 id="x">小语讲堂 · Lớp học của Tiểu Ngữ</h2>' +
  '<p><strong>1</strong> <span>固定短语“看上去/看起来”</span> Cụm cố định “看上去/看起来”</p>' +
  "<p>固定短语“看上去”与“看起来”，可用来描述某人或某物的外观或状态。例如：</p>" +
  "<p>Các cụm cố định … Ví dụ:</p>" +
  "<ul><li>（1）他们看上去有点儿像。</li><li>（2）这些菜看起来都很好吃。</li></ul>" +
  "<p><strong>■</strong> <span>完成句子。</span>Hoàn thành câu.</p>";

describe("grammarPhrases", () => {
  it("lấy cụm trong dấu “ ” và tách theo /", () => {
    expect(grammarPhrases("固定短语“看上去/看起来” Cụm cố định “看上去/看起来”")).toEqual(["看上去", "看起来"]);
    expect(grammarPhrases("Cấu trúc “又……又……”")).toEqual(["又……又……"]);
    expect(grammarPhrases("定语的多层叠加")).toEqual([]);
  });
});

describe("hskGrammarHtml — khung ngữ pháp", () => {
  it("cụm khoá thành viên thuốc (ngăn bằng / khi chưa có ghi chú thay thế), ví dụ thành thẻ đánh số, ■ thành dòng thử ngay", () => {
    const out = hskGrammarHtml(html);
    expect(out).toContain('<div class="hsk-pills">');
    expect(out).toContain('<span class="hsk-pill" lang="zh-Hans">看上去</span>');
    expect(out).toContain('<span class="hsk-eq">/</span>');
    expect((out.match(/class="hsk-ex"/g) ?? []).length).toBe(2);
    expect(out).toContain('<span class="n">1</span><div class="hsk-exb"><p class="han">他们看上去有点儿像。</p></div>');
    expect(out).toContain('class="hsk-try"');
    expect(out).not.toContain("■");
    expect(out).toContain('class="hsk-gx"'); // đoạn giải thích giữ lại
  });
  it("điểm ngữ pháp không có cụm trong dấu “ ”: giữ tên điểm làm tiêu đề", () => {
    const out = hskGrammarHtml('<h2>小语讲堂</h2><p><strong>1</strong> 定语的多层叠加 Định ngữ nhiều tầng</p><p>x</p>');
    expect(out).toContain('class="hsk-gp-title"');
    expect(out).not.toContain("hsk-pills");
  });
  it("nhiều điểm ngữ pháp: mỗi điểm một nhóm; HTML khác giữ nguyên", () => {
    const two = '<h2>小语讲堂</h2><p><strong>1</strong> A “甲”</p><p>a</p><p><strong>2</strong> B “乙”</p><p>b</p>';
    expect((hskGrammarHtml(two).match(/class="hsk-gp"/g) ?? []).length).toBe(2);
    expect(hskGrammarHtml("<p>không có</p>")).toBe("<p>không có</p>");
  });
});

describe("hskGrammarHtml — HTML thật của sách (số trong <span>, chữ Hán chia nhiều span)", () => {
  const real =
    '<p>Student’s Book · page 3</p><h2><span><span>小语讲堂</span></span><span>Lớp học của Tiểu Ngữ</span></h2>' +
    '<p><span>1</span><span>固定短语</span>“<span>看上去</span>/<span>看起来</span>” Cụm cố định “<span>看上去</span>/<span>看起来</span>”</p>' +
    "<p><span>固定短语</span>“<span>看上去</span>”<span>与</span>“<span>看起来</span>”<span>，可用来描述某人或某物的外观或状态。例如：</span></p>" +
    "<p>Các cụm cố định … Ví dụ:</p>" +
    "<ul><li><span>（</span>1<span>）他们看上去有点儿像。</span></li><li><span>（</span>2<span>）这些菜看起来都很好吃。</span></li></ul>" +
    "<p><strong>■</strong> <span>完成句子。</span>Hoàn thành câu.</p>";
  it("nhận ra điểm ngữ pháp, cụm khoá, ví dụ (bỏ số 1 và （n） ở đầu) và dòng thử ngay", () => {
    const out = hskGrammarHtml(real);
    expect(out).toContain('<span class="hsk-pill" lang="zh-Hans">看上去</span>');
    expect(out).toContain('<span class="hsk-pill" lang="zh-Hans">看起来</span>');
    expect(out).toContain('<span class="n">1</span><div class="hsk-exb"><p class="han">他们看上去有点儿像。</p></div>');
    expect(out).toContain('<span class="n">2</span><div class="hsk-exb"><p class="han">这些菜看起来都很好吃。</p></div>');
    expect(out).toContain('class="hsk-try"');
    expect(out).not.toContain("■");
    expect((out.match(/class="hsk-gp"/g) ?? []).length).toBe(1);
  });
});

describe("hskGrammarHtml — có nội dung bổ sung (pinyin, nghĩa, cách dùng, dịch ví dụ, lưu ý)", () => {
  const real =
    '<h2>小语讲堂</h2><p><span>1</span><span>固定短语</span>“<span>看上去</span>/<span>看起来</span>” Cụm cố định</p>' +
    "<p>Giải thích của sách.</p>" +
    "<ul><li><span>（</span>1<span>）他们看上去有点儿像。</span></li><li><span>（</span>2<span>）这些菜看起来都很好吃。</span></li></ul>" +
    "<p><strong>■</strong> <span>完成句子。</span>Hoàn thành câu.</p>";
  const data = readGrammarData({
    "1": {
      phrases: [
        { han: "看上去", reading: "kànshangqu" },
        { han: "看起来", reading: "kànqǐlai" },
      ],
      meaning: "Trông có vẻ…",
      usage: "Đặt sau chủ ngữ: chủ ngữ + 看上去 + miêu tả.",
      note: "“看上去” và “看起来” có thể thay thế cho nhau.",
      examples: [
        { reading: "Tāmen kànshangqu yǒudiǎnr xiàng.", vi: "Trông họ hơi giống nhau." },
        { reading: "Zhèxiē cài kànqǐlai dōu hěn hǎochī.", vi: "Những món này trông đều rất ngon." },
      ],
    },
  });
  it("cụm khoá có pinyin dưới từng chữ, nối bằng = khi ghi chú nói thay thế được cho nhau", () => {
    const out = hskGrammarHtml(real, data);
    expect(out).toContain("<rt>kàn</rt>");
    expect(out).toContain("<rt>shang</rt>");
    expect(out).toContain('<span class="hsk-eq">=</span>');
  });
  it("khối Nghĩa / Cách dùng nằm TRƯỚC các ví dụ; ví dụ có pinyin dưới từng chữ và bản dịch; lưu ý nằm trước dòng thử ngay", () => {
    const out = hskGrammarHtml(real, data);
    expect(out.indexOf("hsk-gexp")).toBeGreaterThan(-1);
    expect(out.indexOf("hsk-gexp")).toBeLessThan(out.indexOf("hsk-exs"));
    expect(out).toContain("<b>Nghĩa</b>");
    expect(out).toContain("<b>Cách dùng</b>");
    expect(out).toContain("<rt>yǒu</rt>");
    expect(out).toContain("<rt>r</rt>"); // 儿 hoá
    expect(out).toContain('<p class="vi2">Trông họ hơi giống nhau.</p>');
    expect(out.indexOf("hsk-gnote")).toBeLessThan(out.indexOf("hsk-try"));
    expect(out).toContain("<b>Lưu ý</b>");
  });
  it("không có nội dung bổ sung: cụm khoá không pinyin, không có khối nghĩa; hai cụm không có ghi chú thì ngăn bằng /", () => {
    const out = hskGrammarHtml(real);
    expect(out).not.toContain("hsk-gexp");
    expect(out).not.toContain("<rt>");
    expect(out).toContain('<span class="hsk-eq">/</span>');
  });
  it("readGrammarData bỏ phần sai dạng, quá dài, số điểm lạ", () => {
    expect(readGrammarData(null)).toEqual({});
    expect(readGrammarData({ x: { meaning: "a" }, "1": { meaning: 5, usage: "x".repeat(300), phrases: [{ han: "看" }], examples: "no" } })).toEqual({
      "1": { phrases: [], meaning: null, usage: null, note: null, examples: [] },
    });
  });
});
