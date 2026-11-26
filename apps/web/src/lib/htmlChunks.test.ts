import { describe, expect, it } from "vitest";
import { chunkRichText, demoteLongStrong, plainText, scaleInlineFontSizes, topLevelBlocks } from "./htmlChunks";

describe("topLevelBlocks", () => {
  it("giữ nguyên phần tử lồng nhau cùng tên thẻ", () => {
    const html = '<div><div>a</div></div><p>b</p>';
    expect(topLevelBlocks(html)).toEqual(["<div><div>a</div></div>", "<p>b</p>"]);
  });
  it("thẻ tự đóng và ảnh là một khối; chữ trần được bọc p; dấu > trong thuộc tính không làm hỏng", () => {
    const html = 'xin chào<img src="a.png"><p title="a > b">x</p><br/>';
    expect(topLevelBlocks(html)).toEqual(["<p>xin chào</p>", '<img src="a.png">', '<p title="a > b">x</p>', "<br/>"]);
  });
});

describe("plainText", () => {
  it("bỏ thẻ và đổi {{字^pinyin}} thành chữ Hán, kể cả khi có span bên trong", () => {
    expect(plainText('<p>Dùng {{<span style="x">租</span>^zū}} nhé&nbsp;!</p>')).toBe("Dùng 租 nhé !");
  });
});

describe("chunkRichText", () => {
  const h2 = (t: string) => `<h2 id="x">${t}</h2>`;
  it("cắt tại h2 và h3, mỗi đoạn mang tên mục", () => {
    const html = `${h2("Tình huống")}<p>Một.</p>${h2("Ngữ pháp")}<h3>1. Điểm một</h3><p>Hai.</p><h3>2. Điểm hai</h3><p>Ba.</p>`;
    const c = chunkRichText(html);
    expect(c.map((x) => [x.label, x.title])).toEqual([
      ["Tình huống", "Tình huống"],
      ["Ngữ pháp", "1. Điểm một"],
      ["Ngữ pháp", "2. Điểm hai"],
    ]);
  });
  it("h2 liền h3 dính chung một đoạn (không có màn chỉ có tiêu đề)", () => {
    const c = chunkRichText(`${h2("Ngữ pháp")}<h3>1. Một</h3><p>nội dung</p>`);
    expect(c).toHaveLength(1);
    expect(c[0]!.html).toContain("Ngữ pháp");
    expect(c[0]!.html).toContain("1. Một");
  });
  it("bỏ mục lục <nav> và khối rỗng; giữ khối chỉ có ảnh", () => {
    const c = chunkRichText(`<nav><a href="#x">Mục</a></nav><p>&nbsp;</p>${h2("A")}<p>x</p><img src="a.png">`);
    expect(c).toHaveLength(1);
    expect(c[0]!.html).not.toContain("<nav");
    expect(c[0]!.html).toContain("<img");
  });
  it("mục dài tách thành đoạn nối tiếp không tiêu đề, vẫn cùng tên mục", () => {
    const long = "chữ ".repeat(120);
    const c = chunkRichText(`${h2("Dài")}<p>${long}</p><p>${long}</p><p>${long}</p>`, 500);
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.label === "Dài")).toBe(true);
    expect(c.slice(1).every((x) => x.cont && x.title === "")).toBe(true);
  });
  it("danh sách dài tách thành các danh sách con, giữ số thứ tự và cùng một mục", () => {
    const li = (n: number) => `<li>${"câu ".repeat(40)}${n}</li>`;
    const html = `${h2("Ví dụ")}<ol class="x">${[1, 2, 3, 4, 5, 6].map(li).join("")}</ol>`;
    const c = chunkRichText(html, 500);
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.label === "Ví dụ")).toBe(true);
    // Cộng số mục của mọi đoạn bằng 6 và mỗi đoạn sau tiếp số thứ tự đoạn trước.
    const starts = c.map((x) => Number(/start="(\d+)"/.exec(x.html)?.[1] ?? 1));
    const counts = c.map((x) => (x.html.match(/<li>/g) ?? []).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6);
    expect(starts[0]).toBe(1);
    expect(starts[1]).toBe(1 + counts[0]!);
    expect(c[0]!.html).toContain('class="x"');
  });
  it("khối <section aria-label> ở đầu bài lấy nhãn từ aria-label", () => {
    const c = chunkRichText('<section aria-label="Mục tiêu bài học"><p>x</p></section>');
    expect(c[0]!.label).toBe("Mục tiêu bài học");
  });
});

describe("scaleInlineFontSizes", () => {
  it("đổi font-size rem thành em theo thân bài 1,25rem, giữ các giá trị khác", () => {
    const out = scaleInlineFontSizes('<p style="margin:.7rem 0;font-size:1.25rem;line-height:1.7">a</p><h2 style="font-size:1.7rem">b</h2><span style="font-size:1.3em">c</span>');
    expect(out).toContain("font-size:1em");
    expect(out).toContain("font-size:1.36em");
    expect(out).toContain("margin:.7rem 0");
    expect(out).toContain("font-size:1.3em");
  });
});

describe("demoteLongStrong", () => {
  it("giữ <strong> cho cụm ngắn, đổi cụm dài (cả câu) thành đoạn đậm thường; pinyin trong dấu {{ }} không tính độ dài", () => {
    const short = "<strong>{{按时^àn shí}}</strong>";
    const long = "<strong>{{林雨是大三的学生^Lín Yǔ shì dà sān de xué shēng}}，{{她想在学校附近租一套房子^tā xiǎng}}。</strong>";
    expect(demoteLongStrong(short)).toBe(short);
    expect(demoteLongStrong(long)).toContain("teach-strong-long");
    expect(demoteLongStrong(long)).not.toContain("<strong>");
  });
});
