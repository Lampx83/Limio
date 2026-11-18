// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { authoredKind, foldSummary, isAuthoredLesson, isFoldedSection, parseAuthoredHeading, planAuthored, splitAuthoredHtml } from "./hskAuthored";
import { hskAuthoredHtml } from "./hskAuthoredDom";
import { planHskSections } from "./hskLesson";
import { splitVocabMeaning, splitVocabNote } from "./hskVocab";

const rt = (html: string) => ({ type: "richtext", payload: { html } });
const chip = (n: number) => `<span style="x">${n}</span>`;
const h2 = (id: string, inner: string, n?: number) => `<h2 id="muc-${id}" style="font-size:1.7rem">${n ? chip(n) : ""}<span>${inner}</span></h2>`;
const hz = (t: string) => `<span style="font-size:1.3em">${t}</span>`;

describe("nhận diện bài tác giả soạn", () => {
  it("chỉ khối có dấu hiệu bền vững mới là bài tác giả; bài sách giữ nguyên", () => {
    expect(isAuthoredLesson([rt("<p>在家里</p>"), rt("小语讲堂")])).toBe(false);
    expect(isAuthoredLesson([rt('<section aria-label="Mục tiêu bài học"><ul></ul></section>')])).toBe(true);
    // bài nhập từ sách cũng có <h2 id="muc-…"> nhưng không có hộp aria: không phải bài tác giả
    expect(isAuthoredLesson([rt(h2("a", "x")), rt("小语讲堂")])).toBe(false);
    expect(isAuthoredLesson([rt('<section aria-label="Tổng kết bài học"></section>'), rt(h2("a", "x"))])).toBe(true);
    expect(authoredKind('<section aria-label="Tổng kết bài học"></section>')).toBe("a-summary");
    expect(authoredKind('<section aria-label="Mục tiêu bài học"></section>')).toBe("a-goals");
    expect(authoredKind("<p>x</p>")).toBe("authored");
  });
});

describe("parseAuthoredHeading", () => {
  it("tách chữ Hán, tên Việt, chữ cái khối hội thoại và mô tả", () => {
    expect(parseAuthoredHeading(`${chip(2)}<span>${hz("对话")} A · Hội thoại: xem nhà</span>`)).toEqual({ zh: "对话", vi: "Hội thoại", tag: "A", sub: "Xem nhà" });
    expect(parseAuthoredHeading(`<span>${hz("语法")} · Ngữ pháp</span>`)).toEqual({ zh: "语法", vi: "Ngữ pháp" });
    // nhãn có số ("课文2") không bị nhầm với chip số đầu tiêu đề
    expect(parseAuthoredHeading(`${chip(1)}<span>${hz("课文 2")} · 搬家忙乱</span>`)).toMatchObject({ zh: "课文2", vi: "搬家忙乱" });
  });
});

describe("splitAuthoredHtml và planAuthored — số mục", () => {
  it("bỏ mục lục; mỗi h2 là một mục; hội thoại B ngay sau A chỉ là nhãn nhỏ", () => {
    const html = '<nav aria-label="Mục lục bài học"><ol><li>x</li></ol></nav>' + h2("a", `${hz("情景")} · Tình huống`, 1) + "<p>cảnh</p>" + h2("b", `${hz("对话")} A · Hội thoại: xem nhà`, 2) + "<p>dẫn</p>";
    const parts = splitAuthoredHtml(html);
    expect(parts.map((p) => p.heading?.vi)).toEqual(["Tình huống", "Hội thoại"]);
    expect(parts[0]!.html).toBe("<p>cảnh</p>");
    const items = [rt('<section aria-label="Mục tiêu bài học"></section>'), rt(html), { type: "dialogue", payload: {} }, rt(h2("c", `${hz("对话")} B · Hội thoại: quyết định thuê`, 3) + "<p>B</p>"), { type: "dialogue", payload: {} }, rt(h2("d", `${hz("语法")} · Ngữ pháp`, 4) + "<h3>1. x</h3>"), rt(h2("e", `${hz("文化")} · Văn hoá`, 5) + "<p>c</p>")];
    const plan = planHskSections(items);
    expect(plan.kinds).toEqual(["a-goals", "authored", "dialogue", "authored", "dialogue", "authored", "authored"]);
    expect(plan.count).toBe(4); // Tình huống, Hội thoại, Ngữ pháp, Văn hoá
    expect(plan.segs.get(1)!.map((s) => s.head?.no)).toEqual([1, 2]);
    const b = plan.segs.get(3)!;
    expect(b[0]).toMatchObject({ sub: { tag: "B", text: "Quyết định thuê" } });
    expect(b[0]!.head).toBeUndefined();
    expect(plan.segs.get(6)![0]).toMatchObject({ card: "culture", head: { no: 4, section: { zh: "文化" } } });
  });
  it("hội thoại B tách khỏi A bởi mục khác (ngữ pháp) thì có mục Hội thoại riêng", () => {
    const items = [rt(h2("a", "对话 A · Hội thoại: a")), rt(h2("g", "语法 · Ngữ pháp")), rt(h2("b", "对话 B · Hội thoại: b"))];
    const p = planAuthored(items, ["authored", "authored", "authored"]);
    expect([...p.segs.values()].flat().map((s) => s.head?.no)).toEqual([1, 2, 3]);
  });
});

describe("hskAuthoredHtml — dựng lại thân bài", () => {
  it("bỏ style nội tuyến, Hán thành .hz, hộp mục tiêu thành thẻ nhẹ", () => {
    const out = hskAuthoredHtml(`<section aria-label="Mục tiêu bài học" style="border-left:4px solid blue"><div style="a">Mục tiêu bài học</div><ul style="b"><li>${hz("租")} nhà</li></ul></section>`, "a-goals");
    expect(out).not.toMatch(/style=/);
    // Đóng/mở được: <details open> với nhãn là <summary>.
    expect(out).toContain('<details class="hsk-note hsk-note-goals" open="">');
    expect(out).toContain('<summary class="hsk-note-t hsk-note-sum-btn">Mục tiêu bài học</summary>');
    expect(out).toContain('class="hsk-note-ul"');
    expect(out).toContain('<span class="hz" lang="zh-Hans">租</span>');
  });
  it("điểm ngữ pháp: thẻ có tiêu đề số, khung Cấu trúc + Cách dùng, ví dụ có pinyin", () => {
    const html =
      `<h3 id="muc-1" style="x">1. ${hz("来得及")}</h3>` +
      `<aside style="s"><div>Ghi nhớ</div><div><strong>Cấu trúc</strong> S + ${hz("来得及")} + V</div></aside>` +
      `<p><strong>Cách dùng.</strong> Còn kịp.</p>` +
      `<table><thead><tr><th>Câu</th><th>Pinyin</th><th>Nghĩa</th></tr></thead><tbody><tr><td>${hz("现在还来得及。")}</td><td>Xiànzài hái láidejí.</td><td>Bây giờ còn kịp.</td></tr></tbody></table>` +
      `<aside><div>Bẫy thường gặp</div><div>Không nói không来得及</div></aside>`;
    const out = hskAuthoredHtml(html, "authored");
    const doc = new DOMParser().parseFromString(`<body>${out}</body>`, "text/html");
    expect(doc.querySelector(".hsk-ap .hsk-ap-n")?.textContent).toBe("1");
    expect(doc.querySelector(".hsk-ap-t")?.textContent).toBe("来得及");
    expect([...doc.querySelectorAll(".hsk-gexp .hsk-gr b")].map((b) => b.textContent)).toEqual(["Cấu trúc", "Cách dùng"]);
    expect(doc.querySelectorAll(".hsk-ex").length).toBe(1);
    expect(doc.querySelector(".hsk-ex ruby rt")?.textContent).toBe("xiàn");
    expect(doc.querySelector(".hsk-ex .vi2")?.textContent).toBe("Bây giờ còn kịp.");
    expect(doc.querySelector('.hsk-aside[data-tone="warn"] .hsk-aside-t')?.textContent).toBe("Bẫy thường gặp");
    expect(out).not.toMatch(/style=/);
  });
  it("bảng có cột Pinyin khác ba cột thì gộp pinyin vào ô chữ Hán, bọc cuộn ngang", () => {
    const out = hskAuthoredHtml(`<table><thead><tr><th>Từ</th><th>Pinyin</th><th>Nghĩa</th></tr></thead><tbody><tr><td>${hz("租")}</td><td>zū</td><td>thuê</td></tr></tbody></table>`, "authored");
    const doc = new DOMParser().parseFromString(`<body>${out}</body>`, "text/html");
    expect(doc.querySelectorAll("th").length).toBe(2);
    expect(doc.querySelector("td ruby rt")?.textContent).toBe("zū");
    expect(doc.querySelector(".hsk-tw table")).not.toBeNull();
  });
});

describe("từ vựng bài tác giả", () => {
  it("tách từ loại khỏi nghĩa; nghĩa cũ (đứng đầu là pinyin) giữ nguyên", () => {
    expect(splitVocabMeaning("đg. · thuê (nhà, xe…)")).toEqual({ pos: "đg.", meaning: "thuê (nhà, xe…)" });
    expect(splitVocabMeaning("đg./d. · khoá")).toEqual({ pos: "đg./d.", meaning: "khoá" });
    expect(splitVocabMeaning("zū · đg. · thuê")).toEqual({ pos: null, meaning: "zū · đg. · thuê" });
    expect(splitVocabMeaning("nhà · phòng")).toEqual({ pos: null, meaning: "nhà · phòng" });
  });
  it("nhãn Từ chủ động / Từ nhận biết thành viên thuốc; ghi chú cũ không có nhãn giữ nguyên", () => {
    expect(splitVocabNote("Từ chủ động. Lỗi dịch thẳng.")).toEqual({ tag: "Từ chủ động", active: true, note: "Lỗi dịch thẳng." });
    expect(splitVocabNote("Từ nhận biết.")).toEqual({ tag: "Từ nhận biết", active: false, note: null });
    expect(splitVocabNote("Wǒ xiǎng zū.")).toEqual({ tag: null, active: false, note: "Wǒ xiǎng zū." });
    expect(splitVocabNote(undefined)).toEqual({ tag: null, active: false, note: null });
  });
});

describe("mục phụ gập sẵn (docs/tieu-chi/limio-language-ux-p1-ly-thuyet.md, mục E)", () => {
  it("chỉ gập đúng ba mục phụ; mục chính và mục ôn của bài tổng hợp thì không", () => {
    expect(isFoldedSection("Ngữ pháp")).toBe(true);
    expect(isFoldedSection("Văn hoá")).toBe(true);
    expect(isFoldedSection("Lưu ý về từ")).toBe(true);
    for (const vi of ["Hội thoại", "Từ mới", "Tình huống", "Ôn ngữ pháp", "Ôn văn hoá", "Ôn từ", undefined, ""]) expect(isFoldedSection(vi as string | undefined)).toBe(false);
  });

  it("tóm tắt ngữ pháp là tiêu đề các điểm (công thức), bỏ token pinyin", () => {
    const html = '<h3>1. {{一^yī}} + 屋子 / 脸  (danh từ mượn làm lượng từ)</h3><p>Cách dùng…</p><h3>2. 来得及 / 来不及</h3>';
    expect(foldSummary(html)).toEqual(["1. 一 + 屋子 / 脸 (danh từ mượn làm lượng từ)", "2. 来得及 / 来不及"]);
  });

  it("tóm tắt Lưu ý về từ là các từ ở cột đầu của bảng", () => {
    const html = "<table><tr><th>Từ</th><th>Dễ nhầm</th></tr><tr><td>整 (zhěng)</td><td>x</td></tr><tr><td>干 (gān)</td><td>y</td></tr></table>";
    expect(foldSummary(html)).toEqual(["整、干"]);
  });

  it("tóm tắt Văn hoá là câu đầu của đoạn đầu tiên, cắt gọn khi quá dài", () => {
    expect(foldSummary("<p>Ở nhiều thành phố lớn, nhà nằm trong khu dân cư. Câu thứ hai.</p>")).toEqual(["Ở nhiều thành phố lớn, nhà nằm trong khu dân cư."]);
    const long = `<p>${"chữ ".repeat(60)}.</p>`;
    const [line] = foldSummary(long, 50);
    expect(line!.length).toBeLessThanOrEqual(50);
    expect(line!.endsWith("…")).toBe(true);
  });

  it("giữ token pinyin khi được yêu cầu (để dựng pinyin dưới chữ ở trình duyệt)", () => {
    expect(foldSummary('<h3>{{<span style="font-size:1.3em">一屋子</span>^yì wū zi}} 都是</h3>', 120, true)).toEqual(["{{一屋子^yì wū zi}} 都是"]);
  });

  it("không có gì để tóm tắt thì trả mảng rỗng", () => {
    expect(foldSummary("")).toEqual([]);
  });
});
