import { describe, expect, it } from "vitest";
import {
  ITEM_RANGE,
  MAX_LEN,
  MAX_TOC,
  MIN_FONT_PX,
  accentTail,
  emptyLayoutConfig,
  fitFontSize,
  layoutTextProblems,
  resolveLayout,
  sanitizeLayoutConfig,
  SLIDE_LAYOUTS,
} from "./limioLiveSlides";

describe("resolveLayout", () => {
  it("slide cũ không có layout thì là classic", () => {
    expect(resolveLayout({ title: "a", bullets: [] })).toBe("classic");
    expect(resolveLayout(undefined)).toBe("classic");
    expect(resolveLayout({ layout: "không-có" })).toBe("classic");
  });
  it("nhận đủ các bố cục khai báo", () => {
    for (const l of SLIDE_LAYOUTS) expect(resolveLayout({ layout: l })).toBe(l);
  });
});

describe("sanitizeLayoutConfig", () => {
  it("cắt độ dài, bỏ mục rỗng, giới hạn số mục", () => {
    const out = sanitizeLayoutConfig("steps", {
      title: "  Vòng lặp  ",
      items: [
        { heading: "A", body: "x".repeat(500) },
        { heading: "", body: "" },
        ...Array.from({ length: 9 }, (_, i) => ({ heading: `B${i}`, body: "b" })),
      ],
      footnote: "f",
    });
    expect(out.title).toBe("Vòng lặp");
    const items = out.items as Array<{ heading: string; body: string }>;
    expect(items).toHaveLength(ITEM_RANGE.steps!.max);
    expect(items[0]!.body).toHaveLength(MAX_LEN.itemBody);
    expect(items.every((i) => i.heading || i.body)).toBe(true);
  });

  it("chỉ giữ icon hợp lệ và chỉ ở bố cục ba thẻ", () => {
    const cards = sanitizeLayoutConfig("cards", {
      items: [{ heading: "a", body: "b", icon: "target" }, { heading: "c", body: "d", icon: "hack" }],
    });
    expect((cards.items as any[])[0].icon).toBe("target");
    expect((cards.items as any[])[1].icon).toBeUndefined();
    const steps = sanitizeLayoutConfig("steps", { items: [{ heading: "a", body: "b", icon: "target" }] });
    expect((steps.items as any[])[0].icon).toBeUndefined();
  });

  it("slide tóm tắt không có phần giải thích; số liệu cắt con số ngắn", () => {
    const s = sanitizeLayoutConfig("summary", { items: [{ heading: "Ý 1", body: "bỏ" }, { heading: "Ý 2" }] });
    expect((s.items as any[])[0].body).toBe("");
    const st = sanitizeLayoutConfig("stats", { items: [{ heading: "1234567890123", body: "x" }, { heading: "2", body: "y" }] });
    expect((st.items as any[])[0].heading).toHaveLength(MAX_LEN.statValue);
  });

  it("so sánh: đúng hai cột, tối đa ba ý mỗi cột, tone mặc định là good", () => {
    const c = sanitizeLayoutConfig("compare", {
      columns: [
        { heading: "Sai", points: ["1", "2", "3", "4"], tone: "bad" },
        { heading: "Đúng", points: ["a"] },
        { heading: "Thừa", points: ["z"] },
      ],
    });
    const cols = c.columns as any[];
    expect(cols).toHaveLength(2);
    expect(cols[0].points).toHaveLength(3);
    expect(cols[1].tone).toBe("good");
  });

  it("trích dẫn không giữ tiêu đề; trường lạ bị bỏ", () => {
    const q = sanitizeLayoutConfig("quote", { title: "bỏ", quote: "Một câu.", source: "Ai đó", hack: "<script>" });
    expect(q.title).toBeUndefined();
    expect(q.quote).toBe("Một câu.");
    expect(q).not.toHaveProperty("hack");
  });

  it("ảnh: tối đa ba ý", () => {
    const i = sanitizeLayoutConfig("image", { title: "t", bullets: ["1", "2", "3", "4"] });
    expect(i.bullets).toHaveLength(3);
  });
});

describe("emptyLayoutConfig", () => {
  it("mọi bố cục mới có cấu hình trống đi qua sanitize không ném lỗi và giữ layout", () => {
    for (const l of SLIDE_LAYOUTS.filter((x) => x !== "classic")) {
      const e = emptyLayoutConfig(l);
      expect(e.layout).toBe(l);
      expect(sanitizeLayoutConfig(l, e).layout).toBe(l);
    }
  });
});

describe("accentTail", () => {
  it("tiêu đề ngắn không bị chia", () => {
    expect(accentTail("Ba điều cần nhớ")).toEqual({ head: "Ba điều", tail: "cần nhớ" });
    expect(accentTail("Mở đầu")).toEqual({ head: "Mở đầu", tail: "" });
  });
  it("lấy khoảng một phần ba số từ cuối", () => {
    expect(accentTail("Phản hồi hiệu quả trong dạy học")).toEqual({ head: "Phản hồi hiệu quả", tail: "trong dạy học" });
  });
});

describe("fitFontSize", () => {
  it("chữ ngắn giữ cỡ lớn nhất", () => {
    expect(fitFontSize("Ngắn", { maxPx: 72, widthPx: 1000, maxLines: 2 })).toEqual({ px: 72, overflow: false });
  });
  it("chữ dài thu nhỏ nhưng không xuống dưới 26 px", () => {
    const r = fitFontSize("a".repeat(30), { maxPx: 60, widthPx: 400, maxLines: 1 });
    expect(r.px).toBeLessThan(60);
    expect(r.px).toBeGreaterThanOrEqual(MIN_FONT_PX);
  });
  it("quá dài thì báo tràn và dừng ở 26 px", () => {
    const r = fitFontSize("a".repeat(2000), { maxPx: 40, widthPx: 300, maxLines: 3 });
    expect(r).toEqual({ px: MIN_FONT_PX, overflow: true });
  });
  it("minPx nhỏ hơn 26 vẫn bị nâng lên 26", () => {
    expect(fitFontSize("a".repeat(2000), { maxPx: 40, minPx: 12, widthPx: 300, maxLines: 3 }).px).toBe(MIN_FONT_PX);
  });
});

describe("layoutTextProblems", () => {
  it("không cảnh báo với nội dung vừa", () => {
    expect(
      layoutTextProblems("cards", {
        title: "Ba câu hỏi của phản hồi",
        items: [{ heading: "a", body: "Người học biết mình cần đạt điều gì." }],
      }),
    ).toEqual([]);
  });
  it("cảnh báo đúng thẻ quá dài", () => {
    const p = layoutTextProblems("cards", { items: [{ heading: "a", body: "x".repeat(140) }, { heading: "b", body: "ngắn" }] });
    expect(p).toEqual(["Thẻ 1"]);
  });
});

import { convertLayoutConfig, padForEditing } from "./limioLiveSlides";

describe("convertLayoutConfig", () => {
  const cards = {
    layout: "cards",
    title: "Ba câu hỏi",
    items: [
      { heading: "Mục tiêu là gì?", body: "Người học biết cần đạt điều gì.", icon: "target" },
      { heading: "Hiện đang ở đâu?", body: "Bài làm cho thấy mức đạt." },
      { heading: "Bước tiếp theo?", body: "Một việc cụ thể." },
    ],
  };

  it("thẻ sang các bước giữ tiêu đề và cả ba ý", () => {
    const s = convertLayoutConfig(cards, "steps") as any;
    expect(s.layout).toBe("steps");
    expect(s.title).toBe("Ba câu hỏi");
    expect(s.items.map((i: any) => i.heading)).toEqual(["Mục tiêu là gì?", "Hiện đang ở đâu?", "Bước tiếp theo?"]);
    expect(s.items[0].body).toBe("Người học biết cần đạt điều gì.");
  });

  it("thẻ sang tóm tắt gộp tiêu đề và giải thích thành một câu", () => {
    const s = convertLayoutConfig(cards, "summary") as any;
    expect(s.items[0].heading).toBe("Mục tiêu là gì? Người học biết cần đạt điều gì.");
    expect(s.items[0].body).toBe("");
  });

  it("thẻ sang chữ và hình thành ba ý, rồi quay lại thẻ không mất chữ", () => {
    const img = convertLayoutConfig(cards, "image") as any;
    expect(img.bullets).toHaveLength(3);
    const back = convertLayoutConfig(img, "cards") as any;
    expect(back.items[0].heading).toContain("Mục tiêu là gì?");
  });

  it("sang bìa lấy ý đầu làm mô tả; sang trích dẫn lấy tiêu đề làm câu trích", () => {
    expect((convertLayoutConfig(cards, "cover") as any).subtitle).toContain("Mục tiêu là gì?");
    expect((convertLayoutConfig(cards, "quote") as any).quote).toBe("Ba câu hỏi");
  });

  it("slide cũ sang bố cục mới mang theo ý chính và ảnh", () => {
    const old = { title: "Tiêu đề", subtitle: "Phụ đề", bullets: ["Ý một", "Ý hai"], imageUrl: "https://x/y.png" };
    const img = convertLayoutConfig(old, "image") as any;
    expect(img.bullets).toEqual(["Ý một", "Ý hai"]);
    expect(img.imageUrl).toBe("https://x/y.png");
    const cardsFromOld = convertLayoutConfig(old, "cards") as any;
    expect(cardsFromOld.items.map((i: any) => i.heading)).toEqual(["Ý một", "Ý hai"]);
    // Trình soạn bù ô trống cho đủ số thẻ tối thiểu để giảng viên điền tiếp.
    expect((padForEditing("cards", cardsFromOld).items as any[]).length).toBe(3);
  });

  it("sang slide cũ trả về cấu hình không có khoá layout", () => {
    const c = convertLayoutConfig(cards, "classic") as any;
    expect(c.layout).toBeUndefined();
    expect(c.title).toBe("Ba câu hỏi");
    expect(c.bullets.length).toBeGreaterThan(0);
  });

  it("so sánh: hai ý đầu thành hai cột", () => {
    const c = convertLayoutConfig(cards, "compare") as any;
    expect(c.columns).toHaveLength(2);
    expect(c.columns[0].heading).toBe("Mục tiêu là gì?");
  });
});

describe("padForEditing", () => {
  it("bù thẻ, cột và ý cho đủ để điền; không đụng khi đã đủ", () => {
    expect((padForEditing("steps", { layout: "steps", items: [{ heading: "a", body: "b" }] }).items as any[]).length).toBe(4);
    expect((padForEditing("compare", { layout: "compare", columns: [] }).columns as any[]).length).toBe(2);
    expect((padForEditing("image", { layout: "image", bullets: ["x"] }).bullets as any[]).length).toBe(3);
    const full = { layout: "cards", items: [1, 2, 3].map((n) => ({ heading: `h${n}`, body: "b" })) };
    expect(padForEditing("cards", full).items).toEqual(full.items);
  });
});

import { normalizeContentSlideConfig, pickMeta } from "./limioLiveSlides";

describe("normalizeContentSlideConfig", () => {
  it("slide có bố cục: lọc trường lạ, giữ ghi chú giảng, cắt độ dài", () => {
    const out = normalizeContentSlideConfig({
      layout: "cover",
      title: "T",
      evil: "x",
      presenterNote: "  Nhắc: nói chậm.  ",
    }) as any;
    expect(out.evil).toBeUndefined();
    expect(out.presenterNote).toBe("Nhắc: nói chậm.");
    expect(out.layout).toBe("cover");
  });
  it("slide cũ và slide học liệu đi qua nguyên vẹn", () => {
    const old = { title: "a", bullets: ["b"], extra: 1 };
    expect(normalizeContentSlideConfig(old)).toBe(old);
    const res = { layout: "cards", resource: { type: "pdf", payload: {} }, title: "x" };
    expect(normalizeContentSlideConfig(res)).toBe(res);
  });
});

describe("giữ khoá meta khi lọc bố cục", () => {
  it("cờ ẩn slide và dấu vết AI không bị mất khi lưu slide có bố cục", () => {
    const out = normalizeContentSlideConfig({
      layout: "cards",
      title: "T",
      hidden: true,
      outlineId: "o1",
      aiGenerated: true,
      editedByUser: true,
      rubbish: 1,
    }) as any;
    expect(out).toMatchObject({ hidden: true, outlineId: "o1", aiGenerated: true, editedByUser: true });
    expect(out.rubbish).toBeUndefined();
  });
  it("pickMeta bỏ giá trị sai kiểu", () => {
    expect(pickMeta({ hidden: "yes", aiGenerated: 1, outlineId: 5, presenterNote: "  " })).toEqual({});
    expect(pickMeta(undefined)).toEqual({});
  });
});

import { mergeSlideMeta } from "./limioLiveSlides";

describe("mergeSlideMeta", () => {
  const ai = { layout: "cards", title: "T", items: [{ heading: "a", body: "b" }], outlineId: "o1", aiGenerated: true, presenterNote: "Ghi chú." };

  it("giảng viên đổi chữ slide AI sinh thì đánh dấu đã sửa tay và giữ dấu vết nhận diện", () => {
    const out = mergeSlideMeta(ai, { layout: "cards", title: "T mới", items: [{ heading: "a", body: "b" }], presenterNote: "Ghi chú." });
    expect(out).toMatchObject({ editedByUser: true, outlineId: "o1", aiGenerated: true });
  });
  it("lưu lại đúng nội dung cũ (autosave khi rời ô) không bị tính là sửa", () => {
    const out = mergeSlideMeta(ai, { layout: "cards", title: "T", items: [{ heading: "a", body: "b" }], presenterNote: " Ghi chú. " });
    expect(out.editedByUser).toBeUndefined();
  });
  it("ẩn/hiện slide không tính là sửa nội dung", () => {
    expect(mergeSlideMeta(ai, { ...ai, hidden: true }).editedByUser).toBeUndefined();
  });
  it("bật ẩn thì tắt ẩn được; trình soạn làm rơi cờ ẩn thì cờ vẫn còn", () => {
    const hid = { ...ai, hidden: true };
    expect(mergeSlideMeta(hid, { ...ai, hidden: false }).hidden).toBe(false);
    expect(mergeSlideMeta(hid, { layout: "cards", title: "T", items: [{ heading: "a", body: "b" }], presenterNote: "Ghi chú." }).hidden).toBe(true);
  });
  it("AI sửa (đã được giảng viên chấp nhận) không đánh dấu sửa tay", () => {
    expect(mergeSlideMeta(ai, { ...ai, title: "Ngắn hơn" }, { fromAi: true }).editedByUser).toBeUndefined();
  });
  it("đã sửa tay thì mãi là sửa tay, kể cả khi AI sửa tiếp", () => {
    const edited = { ...ai, editedByUser: true };
    expect(mergeSlideMeta(edited, { ...ai, title: "x" }, { fromAi: true }).editedByUser).toBe(true);
  });
  it("slide soạn tay không bao giờ bị gắn dấu vết AI", () => {
    const out = mergeSlideMeta({ title: "a", bullets: [] }, { title: "b", bullets: [] });
    expect(out).toEqual({ title: "b", bullets: [] });
  });
  it("quiz do AI sinh: trình soạn quiz làm rơi dấu vết nhưng bản lưu vẫn giữ và đánh dấu khi sửa câu hỏi", () => {
    const quiz = { question: "Q?", options: [{ text: "A", correct: true }, { text: "B", correct: false }], outlineId: "o2", aiGenerated: true };
    const out = mergeSlideMeta(quiz, { question: "Q mới?", options: [{ text: "A", correct: true }, { text: "B", correct: false }] });
    expect(out).toMatchObject({ outlineId: "o2", aiGenerated: true, editedByUser: true });
  });
});

import { parseInline, slideConfigsEqual, splitSlideConfig, stripInline, toggleInlineMarker } from "./limioLiveSlides";

describe("parseInline", () => {
  it("tách in đậm và in nghiêng", () => {
    expect(parseInline("Có **hai** ý và *một* ví dụ.")).toEqual([
      { text: "Có " },
      { text: "hai", bold: true },
      { text: " ý và " },
      { text: "một", italic: true },
      { text: " ví dụ." },
    ]);
  });
  it("lồng đậm trong nghiêng", () => {
    expect(parseInline("*a **b** c*")).toEqual([{ text: "a ", italic: true }, { text: "b", bold: true, italic: true }, { text: " c", italic: true }]);
  });
  it("dấu không có cặp đóng giữ nguyên là chữ", () => {
    expect(stripInline("Giá trị 2 * 3 và **chưa đóng")).toBe("Giá trị 2 * 3 và **chưa đóng");
    expect(parseInline("a * b")).toEqual([{ text: "a * b" }]);
  });
  it("chuỗi rỗng và chuỗi không dấu", () => {
    expect(parseInline("")).toEqual([]);
    expect(parseInline("Không có dấu")).toEqual([{ text: "Không có dấu" }]);
  });
  it("stripInline bỏ dấu đã ghép cặp", () => {
    expect(stripInline("**Phản hồi** là *thông tin*.")).toBe("Phản hồi là thông tin.");
  });
});

describe("toggleInlineMarker", () => {
  it("bọc đoạn chọn và giữ vùng chọn", () => {
    expect(toggleInlineMarker("Phản hồi tốt", 0, 8, "**")).toEqual({ value: "**Phản hồi** tốt", start: 2, end: 10 });
  });
  it("bấm lần nữa thì gỡ", () => {
    const a = toggleInlineMarker("Phản hồi tốt", 0, 8, "**");
    expect(toggleInlineMarker(a.value, a.start, a.end, "**")).toEqual({ value: "Phản hồi tốt", start: 0, end: 8 });
  });
  it("không có đoạn chọn thì không đổi", () => {
    expect(toggleInlineMarker("abc", 1, 1, "*")).toEqual({ value: "abc", start: 1, end: 1 });
  });
  it("in nghiêng bên trong in đậm không bị coi là đã in nghiêng", () => {
    const r = toggleInlineMarker("**ab**", 2, 4, "*");
    expect(r.value).toBe("***ab***");
  });
});

describe("splitSlideConfig", () => {
  const steps = {
    layout: "steps",
    title: "Quy trình",
    items: ["a", "b", "c", "d", "e"].map((h) => ({ heading: h, body: `Câu ${h}.` })),
    footnote: "Lặp lại.",
    presenterNote: "Ghi chú.",
    outlineId: "o9",
    aiGenerated: true,
  };
  it("chia đều các bước; slide sau có (tiếp), không ghi chú, không dàn ý, không dòng cuối", () => {
    const r = splitSlideConfig(steps)!;
    expect((r[0].items as any[]).map((i) => i.heading)).toEqual(["a", "b", "c"]);
    expect((r[1].items as any[]).map((i) => i.heading)).toEqual(["d", "e"]);
    expect(r[1].title).toBe("Quy trình (tiếp)");
    expect(r[1].presenterNote).toBeUndefined();
    expect(r[1].outlineId).toBeUndefined();
    expect(r[1].footnote).toBeUndefined();
    expect(r[0]).toMatchObject({ presenterNote: "Ghi chú.", outlineId: "o9", editedByUser: true });
    expect(r[1].editedByUser).toBe(true);
  });
  it("hai nửa đều phải đủ số mục tối thiểu: 3 thẻ thì không tách", () => {
    expect(splitSlideConfig({ layout: "cards", title: "t", items: [1, 2, 3].map((n) => ({ heading: `h${n}`, body: "b" })) })).toBeNull();
    expect(splitSlideConfig({ layout: "steps", title: "t", items: [1, 2].map((n) => ({ heading: `h${n}`, body: "b" })) })).toBeNull();
  });
  it("tiêu đề đã có (tiếp) không thêm lần nữa", () => {
    const r = splitSlideConfig({ ...steps, title: "Quy trình (tiếp)" })!;
    expect(r[1].title).toBe("Quy trình (tiếp)");
  });
  it("slide chữ và hình tách ý, bố cục khác không tách được", () => {
    const r = splitSlideConfig({ layout: "image", title: "T", bullets: ["1.", "2.", "3."], imageUrl: "https://x/y.png" })!;
    expect(r[0].bullets).toEqual(["1.", "2."]);
    expect(r[1].bullets).toEqual(["3."]);
    expect(r[1].imageUrl).toBeUndefined();
    expect(splitSlideConfig({ layout: "cover", title: "T" })).toBeNull();
    expect(splitSlideConfig({ layout: "compare", title: "T", columns: [] })).toBeNull();
    expect(splitSlideConfig({ layout: "image", title: "T", bullets: ["một ý"] })).toBeNull();
  });
});

describe("slideConfigsEqual", () => {
  it("không phân biệt thứ tự khoá, coi undefined như thiếu khoá", () => {
    expect(slideConfigsEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, x: undefined })).toBe(true);
    expect(slideConfigsEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(slideConfigsEqual(null, {})).toBe(true);
  });
});


describe("slide văn bản mới (soạn thủ công)", () => {
  it("bắt đầu ở bố cục Chữ và hình, không phải bố cục cũ, và vẫn giữ sau khi chuẩn hoá lúc tạo", () => {
    const created = normalizeContentSlideConfig(emptyLayoutConfig("image"));
    expect(resolveLayout(created)).toBe("image");
    expect(resolveLayout(created)).not.toBe("classic");
  });
});

import { adjacentSlide } from "./limioLiveSlides";

describe("adjacentSlide (nút ‹ › trong cửa sổ sửa slide)", () => {
  const slides = [
    { id: "a", type: "content", config: { layout: "cover" } },
    { id: "b", type: "content", config: { layout: "cards" } },
    { id: "c", type: "quiz", config: { question: "?" } },
    { id: "d", type: "content", config: { title: "cũ", bullets: [] } },
    { id: "e", type: "content", config: { layout: "image", resource: { type: "video" } } },
  ];
  it("trả slide kế bên theo hai chiều, null ở đầu và cuối bài", () => {
    expect(adjacentSlide(slides, "b", 1)?.id).toBe("c");
    expect(adjacentSlide(slides, "b", -1)?.id).toBe("a");
    expect(adjacentSlide(slides, "a", -1)).toBeNull();
    expect(adjacentSlide(slides, "e", 1)).toBeNull();
    expect(adjacentSlide(slides, "không có", 1)).toBeNull();
  });
  it("chỉ slide nội dung có bố cục mới (không nhúng tài nguyên) mới dùng trình sửa bố cục", () => {
    expect(adjacentSlide(slides, "a", 1)?.layoutSlide).toBe(true);
    expect(adjacentSlide(slides, "b", 1)?.layoutSlide).toBe(false); // quiz
    expect(adjacentSlide(slides, "c", 1)?.layoutSlide).toBe(false); // bố cục cũ
    expect(adjacentSlide(slides, "d", 1)?.layoutSlide).toBe(false); // nhúng tài nguyên
  });
});

import { SLIDE_ZOOM_MAX, SLIDE_ZOOM_MIN, layoutRenderScale } from "./limioLiveSlides";

describe("layoutRenderScale (thu phóng khi trình chiếu)", () => {
  it("nhân tỉ lệ vừa khung với mức thu phóng", () => {
    expect(layoutRenderScale(1.1, 1)).toBeCloseTo(1.1);
    expect(layoutRenderScale(1.1, 1.2)).toBeCloseTo(1.32);
    expect(layoutRenderScale(1.1, 0.8)).toBeCloseTo(0.88);
  });
  it("không thu phóng thì giữ nguyên; giá trị lạ về 100%", () => {
    expect(layoutRenderScale(1, undefined)).toBe(1);
    expect(layoutRenderScale(1, NaN)).toBe(1);
  });
  it("giới hạn trong khoảng cho phép của nút thu phóng", () => {
    expect(layoutRenderScale(1, 99)).toBe(SLIDE_ZOOM_MAX);
    expect(layoutRenderScale(1, 0.01)).toBe(SLIDE_ZOOM_MIN);
  });
});

describe("bìa phần có mục lục", () => {
  it("giữ mục lục và vị trí phần hiện tại khi hợp lệ, cắt độ dài và số mục", () => {
    const toc = Array.from({ length: 9 }, (_, i) => `Phần ${i + 1} ${"x".repeat(100)}`);
    const c = sanitizeLayoutConfig("section", { title: "Ứng dụng", sectionNumber: "02", toc, tocCurrent: 2 });
    expect((c.toc as string[]).length).toBe(MAX_TOC);
    expect((c.toc as string[])[0]!.length).toBe(MAX_LEN.tocItem);
    expect(c.tocCurrent).toBe(2);
  });
  it("bỏ mục lục khi ít hơn 2 phần hoặc vị trí ngoài khoảng; bố cục khác không mang mục lục", () => {
    expect(sanitizeLayoutConfig("section", { toc: ["Một"], tocCurrent: 1 })).not.toHaveProperty("toc");
    expect(sanitizeLayoutConfig("section", { toc: ["A", "B"], tocCurrent: 3 })).not.toHaveProperty("toc");
    expect(sanitizeLayoutConfig("summary", { toc: ["A", "B"], tocCurrent: 1 })).not.toHaveProperty("toc");
  });
});

// ── Bìa bốn dòng: tên đơn vị, tên bài, phụ đề, người trình bày; kiểu bìa ─────────────────
import { COVER_STYLES, DEFAULT_COVER_STYLE, MAX_LEN as LEN, fillCoverIdentity, resolveCoverStyle } from "./limioLiveSlides";

describe("bìa: tên đơn vị (org)", () => {
  it("giữ tên đơn vị ở bìa, đã cắt khoảng trắng và độ dài", () => {
    const out = sanitizeLayoutConfig("cover", { title: "Bài 1", org: "  Khoa Công nghệ thông tin  " });
    expect(out.org).toBe("Khoa Công nghệ thông tin");
    expect((sanitizeLayoutConfig("cover", { org: "x".repeat(500) }).org as string).length).toBe(LEN.org);
  });
  it("bỏ tên đơn vị rỗng và tên đơn vị ở bố cục không phải bìa", () => {
    expect(sanitizeLayoutConfig("cover", { title: "A", org: "   " })).not.toHaveProperty("org");
    expect(sanitizeLayoutConfig("section", { title: "A", org: "Khoa" })).not.toHaveProperty("org");
  });
  it("bìa trống có sẵn ô tên đơn vị", () => {
    expect(emptyLayoutConfig("cover")).toMatchObject({ org: "", title: "", subtitle: "", byline: "" });
  });
});

describe("bìa: kiểu bìa (coverStyle)", () => {
  it("có mười kiểu, mặc định Khối màu", () => {
    expect(COVER_STYLES).toHaveLength(10);
    expect(DEFAULT_COVER_STYLE).toBe("block");
  });
  it("kiểu hợp lệ sống qua lọc bố cục, AI sửa và đổi bố cục (là khoá meta)", () => {
    expect(normalizeContentSlideConfig({ layout: "cover", title: "A", coverStyle: "wave" })).toMatchObject({ coverStyle: "wave" });
    expect(pickMeta({ coverStyle: "tiles" })).toEqual({ coverStyle: "tiles" });
  });
  it("kiểu lạ hoặc sai kiểu dữ liệu bị bỏ", () => {
    expect(normalizeContentSlideConfig({ layout: "cover", title: "A", coverStyle: "split" })).not.toHaveProperty("coverStyle");
    expect(pickMeta({ coverStyle: 3 })).toEqual({});
  });
  it("đọc kiểu: thiếu hoặc lạ thì về mặc định", () => {
    expect(resolveCoverStyle({ coverStyle: "formal" })).toBe("formal");
    expect(resolveCoverStyle({ coverStyle: "bold" })).toBe("block");
    expect(resolveCoverStyle({})).toBe("block");
    expect(resolveCoverStyle(null)).toBe("block");
  });
  it("đổi kiểu bìa là đổi trang trí, không tính là sửa tay slide AI sinh", () => {
    const old = { layout: "cover", title: "A", aiGenerated: true };
    expect(mergeSlideMeta(old, { ...old, coverStyle: "arch" })).not.toHaveProperty("editedByUser");
  });
});

describe("fillCoverIdentity: điền sẵn tên đơn vị và người trình bày", () => {
  const who = { org: "Trường Công nghệ", presenter: "Trần Minh Anh" };
  it("điền vào ô còn trống của bìa", () => {
    expect(fillCoverIdentity({ layout: "cover", title: "A", byline: "" }, who)).toMatchObject({ org: "Trường Công nghệ", byline: "Trần Minh Anh" });
  });
  it("không ghi đè chữ giảng viên đã điền", () => {
    const c = fillCoverIdentity({ layout: "cover", title: "A", org: "Bộ môn Tin học", byline: "TS. Lê Hà" }, who);
    expect(c).toMatchObject({ org: "Bộ môn Tin học", byline: "TS. Lê Hà" });
  });
  it("không có thông tin thì để trống, không bịa", () => {
    expect(fillCoverIdentity({ layout: "cover", title: "A" }, { org: "", presenter: "  " })).toEqual({ layout: "cover", title: "A" });
  });
  it("bỏ qua slide không phải bìa", () => {
    const c = { layout: "section", title: "A" };
    expect(fillCoverIdentity(c, who)).toBe(c);
  });
  it("cắt theo độ dài tối đa của từng ô", () => {
    const c = fillCoverIdentity<Record<string, unknown>>({ layout: "cover" }, { org: "o".repeat(300), presenter: "p".repeat(300) });
    expect((c.org as string).length).toBe(LEN.org);
    expect((c.byline as string).length).toBe(LEN.byline);
  });
});

describe("ý của slide Tóm tắt là cả một câu", () => {
  it("không cắt câu dài hơn tiêu đề thẻ, chỉ cắt ở giới hạn câu giải thích", () => {
    const cau = "Người học giải thích được khái niệm phân cấp thị giác và vai trò của nó trong thiết kế giao diện.";
    expect(cau.length).toBeGreaterThan(MAX_LEN.itemHeading);
    const c = sanitizeLayoutConfig("summary", { title: "Mục tiêu", items: [{ heading: cau }, { heading: "x".repeat(300) }] });
    const items = c.items as Array<{ heading: string }>;
    expect(items[0]!.heading).toBe(cau);
    expect(items[1]!.heading).toHaveLength(MAX_LEN.itemBody);
  });
  it("tiêu đề thẻ vẫn giữ giới hạn ngắn", () => {
    const c = sanitizeLayoutConfig("cards", { items: [{ heading: "x".repeat(100), body: "Một câu." }, { heading: "B", body: "Hai." }] });
    expect((c.items as Array<{ heading: string }>)[0]!.heading).toHaveLength(MAX_LEN.itemHeading);
  });
});
