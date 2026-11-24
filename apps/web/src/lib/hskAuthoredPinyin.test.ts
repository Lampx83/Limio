// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PINYIN_TOKEN, parseAuthoredHeading, stripPinyinTokens } from "./hskAuthored";
import { hskAuthoredHtml, rubyTokensOnlyHtml } from "./hskAuthoredDom";

/** Importer bọc cụm chữ Hán trong span phóng to rồi mới tới dấu ^ và pinyin. */
const tok = (han: string, py: string) => `{{<span style="font-size:1.3em">${han}</span>^${py}}}`;
const render = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = hskAuthoredHtml(html);
  return host;
};
const rubies = (host: Element) => Array.from(host.querySelectorAll("ruby.ruby-han")).map((r) => [r.firstElementChild?.textContent, r.querySelector("rt")?.textContent]);

describe("token pinyin trong bài tác giả", () => {
  it("nhận token có và không có span bọc, bỏ token giữ chữ Hán", () => {
    expect(stripPinyinTokens(`a ${tok("师傅", "shīfu")} b {{袋^dài}} c`)).toBe("a 师傅 b 袋 c");
    expect("{{打^dá}} và {{来得及^lái de jí}}".match(PINYIN_TOKEN)?.length).toBe(2);
    // không phải token: thiếu ^, có chữ Latin trong phần Hán, pinyin có dấu < hoặc "
    expect(stripPinyinTokens("{{abc^dá}} {{打}} {{打^d<b>á}}")).toBe("{{abc^dá}} {{打}} {{打^d<b>á}}");
  });

  it("pinyin hiện dưới TỪNG chữ Hán (ruby) trong đoạn văn, danh sách, ô bảng, hộp ghi chú, trích dẫn", () => {
    const html =
      `<p>Lượng từ ${tok("打", "dá")} và ${tok("师傅", "shī fu")}.</p>` +
      `<ul><li>${tok("来得及", "lái de jí")}</li></ul>` +
      `<table><thead><tr><th>Từ</th><th>Nghĩa</th></tr></thead><tbody><tr><td><strong>${tok("袋", "dài")}</strong></td><td>túi ${tok("一袋", "yí dài")}</td></tr></tbody></table>` +
      `<aside><div>Ghi nhớ</div><div>Nói ${tok("两台", "liǎng tái")}</div></aside>` +
      `<blockquote>${tok("小事", "xiǎo shì")}</blockquote>`;
    const host = render(html);
    expect(host.textContent).not.toContain("{{");
    expect(host.textContent).not.toContain("^");
    expect(host.querySelectorAll("[data-hzrb]").length).toBe(0);
    expect(rubies(host.querySelector("p")!)).toEqual([["打", "dá"], ["师", "shī"], ["傅", "fu"]]);
    expect(rubies(host.querySelector("li")!)).toEqual([["来", "lái"], ["得", "de"], ["及", "jí"]]);
    expect(rubies(host.querySelector("td strong")!)).toEqual([["袋", "dài"]]);
    expect(rubies(host.querySelector("aside")!)).toEqual([["两", "liǎng"], ["台", "tái"]]);
    expect(rubies(host.querySelector("blockquote")!)).toEqual([["小", "xiǎo"], ["事", "shì"]]);
    // chữ Hán trong ruby có lang riêng và lớp .hz để CSS tô màu / cỡ
    expect(host.querySelector(".hz.hz-rb")?.getAttribute("lang")).toBe("zh-Hans");
  });

  it("儿化: r dính vào âm tiết trước và nằm dưới chữ 儿", () => {
    const host = render(`<p>${tok("慢点儿", "màn diǎnr")}</p>`);
    expect(rubies(host)).toEqual([["慢", "màn"], ["点", "diǎn"], ["儿", "r"]]);
  });

  it("dấu đậm nằm ngoài token vẫn giữ: 两**袋**衣服", () => {
    const host = render(`<p>${tok("两", "liǎng")}<strong>${tok("袋", "dài")}</strong>${tok("衣服", "yī fu")}</p>`);
    expect(rubies(host.querySelector("strong")!)).toEqual([["袋", "dài"]]);
    expect(rubies(host.querySelector("p")!).length).toBe(4);
  });

  it("tiêu đề điểm ngữ pháp có pinyin; ô số và tiêu đề vẫn đúng", () => {
    const html = `<h3 id="muc-x">1. ${tok("名量词", "míng liàng cí")}：${tok("打", "dá")}（Lượng từ đếm đồ vật）</h3><p>Nội dung</p>`;
    const host = render(html);
    const head = host.querySelector(".hsk-ap-head")!;
    expect(head.querySelector(".hsk-ap-n")?.textContent).toBe("1");
    const t = head.querySelector(".hsk-ap-t")!;
    expect(t.textContent).toContain("Lượng từ đếm đồ vật");
    expect(t.textContent!.startsWith("1.")).toBe(false); // "1." đã tách sang ô số
    expect(rubies(t)).toEqual([["名", "míng"], ["量", "liàng"], ["词", "cí"], ["打", "dá"]]);
  });

  it("ví dụ trong bảng Câu | Pinyin | Nghĩa: bản dịch giữ chữ Hán có token; cột Pinyin riêng vẫn dựng ruby như cũ", () => {
    const html = `<table><thead><tr><th>Câu</th><th>Pinyin</th><th>Nghĩa</th></tr></thead><tbody><tr><td>我买了一打铅笔。</td><td>Wǒ mǎi le yì dá qiānbǐ.</td><td>Mua ${tok("一打", "yì dá")} bút</td></tr></tbody></table>`;
    const host = render(html);
    const li = host.querySelector("li.hsk-ex")!;
    expect(rubies(li.querySelector(".han")!).length).toBe(7);
    expect(rubies(li.querySelector(".vi2")!)).toEqual([["一", "yì"], ["打", "dá"]]);
    expect(li.querySelector(".vi2")?.textContent).toContain("Mua");
  });

  it("pinyin không khớp số chữ thì hiện chữ Hán kèm pinyin nhỏ, không vỡ", () => {
    const host = render(`<p>${tok("来得及", "lái de")}</p>`);
    expect(host.querySelector("ruby")).toBeNull();
    expect(host.querySelector(".hz-rb-fb")?.textContent?.trim()).toBe("lái de");
    expect(host.textContent).toContain("来得及");
  });

  it("tiêu đề mục h2 có token: tên mục vẫn tách đúng chữ Hán và tên Việt", () => {
    const h = parseAuthoredHeading(`<span>${tok("语法", "yǔ fǎ")} · Ngữ pháp</span>`);
    expect(h).toEqual({ zh: "语法", vi: "Ngữ pháp" });
  });

  it("chữ Hán không token (tiêu đề mục, nhãn) giữ nguyên, không tạo ruby", () => {
    const host = render(`<p>${"<span style=\"font-size:1.3em\">对话</span>"} và chữ thường</p>`);
    expect(host.querySelector("ruby")).toBeNull();
    expect(host.textContent).toContain("对话");
  });
});

describe("ngắt dòng", () => {
  it("từ ngắn không bị ngắt giữa chừng, câu dài thì được", () => {
    const host = render(`<p>${tok("一桌子", "yì zhuō zi")} ${tok("我买了一打铅笔", "wǒ mǎi le yì dá qiān bǐ")}</p>`);
    const wraps = host.querySelectorAll(".hz-rb");
    expect(wraps[0]!.classList.contains("hz-rb-nw")).toBe(true);
    expect(wraps[1]!.classList.contains("hz-rb-nw")).toBe(false);
  });
});

describe("bài chưa vào giao diện HSK (khách xem thử): token vẫn thành ruby", () => {
  it("đổi token thành ruby, không dựng lại bố cục, không để lộ dấu {{ }}", () => {
    const html = `<section aria-label="Mục tiêu bài học"><ul><li>Nói ${tok("红包", "hóng bāo")} và ${tok("过年的热闹", "guò nián de rè nao")}</li></ul></section>`;
    const host = document.createElement("div");
    host.innerHTML = rubyTokensOnlyHtml(html);
    expect(host.textContent).not.toContain("{{");
    expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Mục tiêu bài học");
    expect(host.querySelector(".hsk-note")).toBeNull();
    expect(rubies(host).slice(0, 2)).toEqual([["红", "hóng"], ["包", "bāo"]]);
  });

  it("HTML không có token đi qua nguyên vẹn", () => {
    const html = "<p>Chào <b>bạn</b></p>";
    expect(rubyTokensOnlyHtml(html)).toBe(html);
  });
});
