// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildSlideUnits, firstSegmentPerUnit, markSlides, splitSentences, subtitleAt, unitIndexOf } from "./slideshow";

const html = (s: string) => {
  const root = document.createElement("div");
  root.id = "lesson-content";
  root.innerHTML = s;
  return root;
};

const META = `<div data-item-id="m"><div>15 phút · 3 phần</div><div>Mục tiêu bài học</div></div>`;
const SECTION = (t: string) => `<section class="lesson-section"><h2>${t}</h2><p>nội dung ${t}</p></section>`;
const SUMMARY = `<section aria-label="Tổng kết bài học"><p>Tóm lại</p></section>`;

describe("chia slide từ DOM", () => {
  it("mỗi mục trong một khối nhiều mục là một slide, phần trước mục đầu là bìa", () => {
    const root = html(META + `<div data-item-id="a">${SECTION("Một")}${SECTION("Hai")}</div>` + SUMMARY);
    const units = buildSlideUnits(root);
    expect(units).toHaveLength(4); // bìa, Một, Hai, tổng kết
    expect(units[1]![0]!.querySelector("h2")!.textContent).toBe("Một");
    expect(units[2]![0]!.querySelector("h2")!.textContent).toBe("Hai");
    expect(units[3]![0]!.getAttribute("aria-label")).toBe("Tổng kết bài học");
  });

  it("khối có một tiêu đề là một slide; khối không tiêu đề (đồ thị nhúng) đi theo slide trước", () => {
    const root = html(
      META +
        `<div data-item-id="a"><h2>Hàm số</h2><p>x</p></div>` +
        `<div data-item-id="b"><iframe src="/widgets/parabola.html"></iframe></div>` +
        `<div data-item-id="c"><h2>Bài tập</h2><p>y</p></div>`,
    );
    const units = buildSlideUnits(root);
    expect(units).toHaveLength(3); // bìa, Hàm số + nhúng, Bài tập
    expect(units[1]).toHaveLength(2);
    expect(units[1]![1]!.querySelector("iframe")).not.toBeNull();
  });

  it("bài không có tiêu đề nào: một slide duy nhất", () => {
    const units = buildSlideUnits(html(`<div data-item-id="a"><p>chỉ có chữ</p></div>`));
    expect(units).toHaveLength(1);
  });

  it("bài rỗng: không có slide", () => {
    expect(buildSlideUnits(html(""))).toEqual([]);
  });

  it("tổng kết nằm trong một khối thì khối đó là slide riêng", () => {
    const root = html(`<div data-item-id="a"><h2>Một</h2></div><div data-item-id="z">${SUMMARY}</div>`);
    const units = buildSlideUnits(root);
    expect(units).toHaveLength(2);
    expect(units[1]![0]!.getAttribute("data-item-id")).toBe("z");
  });
});

describe("chọn slide theo phần tử đang giảng", () => {
  const root = html(
    META +
      `<div data-item-id="a"><section class="lesson-section"><h2>Một</h2><div class="lesson-part" id="p1">bước 1</div></section>${SECTION("Hai")}</div>`,
  );
  const units = buildSlideUnits(root);

  it("phần tử nằm trong slide (vd một bước của lời giải) thuộc slide đó", () => {
    expect(unitIndexOf(units, root.querySelector("#p1"))).toBe(1);
  });

  it("chính mục hay tiêu đề của mục đều ra slide của mục", () => {
    expect(unitIndexOf(units, root.querySelectorAll(".lesson-section")[1]!)).toBe(2);
    expect(unitIndexOf(units, root.querySelectorAll("h2")[1]!)).toBe(2);
  });

  it("không biết (null / ngoài bài) trả -1", () => {
    expect(unitIndexOf(units, null)).toBe(-1);
    expect(unitIndexOf(units, document.createElement("p"))).toBe(-1);
  });

  it("firstSegmentPerUnit: đoạn giảng đầu tiên của mỗi slide, để bấm Sau thì nhảy tới đúng đoạn", () => {
    // đoạn 0 → bìa(0), đoạn 1 → bước 1 của Một(1), đoạn 2 → cũng Một, đoạn 3 → Hai(2)
    expect(firstSegmentPerUnit([0, 1, 1, 2], 3)).toEqual([0, 1, 3]);
    // slide không có đoạn giảng nào (-1) vẫn có chỗ: dùng đoạn của slide trước
    expect(firstSegmentPerUnit([0, 2], 3)).toEqual([0, 0, 1]);
  });
});

describe("đánh dấu slide", () => {
  it("chỉ slide hiện tại có data-slide-on; phần tử của slide khác có data-slide mà không có -on", () => {
    const root = html(`<div data-item-id="a">${SECTION("Một")}${SECTION("Hai")}</div>`);
    const units = buildSlideUnits(root);
    markSlides(root, units, 1);
    const [one, two] = [...root.querySelectorAll(".lesson-section")];
    expect(one!.hasAttribute("data-slide-on")).toBe(false);
    expect(one!.getAttribute("data-slide")).toBe("0");
    expect(two!.hasAttribute("data-slide-on")).toBe(true);
    markSlides(root, units, 0);
    expect(one!.hasAttribute("data-slide-on")).toBe(true);
    expect(two!.hasAttribute("data-slide-on")).toBe(false);
  });

  it("gọi lại trên cùng DOM không đổi gì (để MutationObserver không lặp vô hạn)", () => {
    const root = html(`<div data-item-id="a">${SECTION("Một")}</div>`);
    const units = buildSlideUnits(root);
    markSlides(root, units, 0);
    const before = root.innerHTML;
    expect(markSlides(root, units, 0)).toBe(false);
    expect(root.innerHTML).toBe(before);
  });
});

describe("phụ đề", () => {
  it("tách câu theo dấu chấm, hỏi, than; giữ dấu câu", () => {
    expect(splitSentences("Chào các em. Hôm nay học gì? Học hàm số! Xong.")).toEqual([
      "Chào các em.",
      "Hôm nay học gì?",
      "Học hàm số!",
      "Xong.",
    ]);
  });

  it("không tách ở số thập phân hay dấu chấm giữa số", () => {
    expect(splitSentences("Đỉnh có hoành độ 1.5 nhé. Tiếp theo.")).toEqual(["Đỉnh có hoành độ 1.5 nhé.", "Tiếp theo."]);
  });

  it("câu quá dài được cắt ở dấu phẩy thành các phụ đề vừa màn hình", () => {
    const long = "Một, " + "chữ ".repeat(60).trim() + ", hai, " + "chữ ".repeat(60).trim() + ".";
    const parts = splitSentences(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(180);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long.replace(/\s+/g, " "));
  });

  it("chữ rỗng: không có câu", () => {
    expect(splitSentences("  ")).toEqual([]);
  });

  it("subtitleAt chia thời gian theo số ký tự trong đoạn", () => {
    const text = "Ngắn. " + "Câu này dài gấp nhiều lần câu đầu tiên đó nhé.";
    const seg = { startSec: 10, endSec: 20 };
    expect(subtitleAt(text, seg, 10)).toBe("Ngắn.");
    expect(subtitleAt(text, seg, 19)).toBe("Câu này dài gấp nhiều lần câu đầu tiên đó nhé.");
  });

  it("subtitleAt: ngoài đoạn thì kẹp về đầu/cuối; không có chữ thì rỗng", () => {
    const seg = { startSec: 0, endSec: 10 };
    expect(subtitleAt("A. B.", seg, -5)).toBe("A.");
    expect(subtitleAt("A. B.", seg, 99)).toBe("B.");
    expect(subtitleAt(undefined, seg, 5)).toBe("");
    expect(subtitleAt("", seg, 5)).toBe("");
  });
});
