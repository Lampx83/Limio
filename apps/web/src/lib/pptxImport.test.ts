import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildPptx, SLIDE_H, SLIDE_W } from "@/test/pptxFixture";
import { PptxError, parsePptx, resolvePath, suggestMinutes } from "./pptxImport";
import { parseXml, textOf } from "./xmlLite";

describe("xmlLite", () => {
  it("đọc thuộc tính, thực thể và CDATA", () => {
    const el = parseXml('<?xml version="1.0"?><a:p x="1 &amp; 2"><a:t>A &lt; B &#7871;</a:t><![CDATA[<raw>]]></a:p>');
    expect(el.attrs.x).toBe("1 & 2");
    expect(textOf(el)).toBe("A < B ế<raw>");
  });
  it("ném lỗi khi thẻ đóng không khớp", () => {
    expect(() => parseXml("<a><b></a>")).toThrow();
  });
});

describe("resolvePath", () => {
  it("tính đường dẫn tương đối của quan hệ", () => {
    expect(resolvePath("ppt/slides/", "../media/image1.png")).toBe("ppt/media/image1.png");
    expect(resolvePath("ppt/", "slides/slide1.xml")).toBe("ppt/slides/slide1.xml");
  });
});

describe("parsePptx", () => {
  it("P3: đọc đúng thứ tự trong presentation.xml, kể cả slide ẩn", async () => {
    const file = await buildPptx([{ title: "Một" }, { title: "Hai", hidden: true }, { title: "Ba" }]);
    const { deck } = await parsePptx(file);
    expect(deck.slides.map((s) => [s.n, s.title, s.hidden])).toEqual([
      [1, "Một", false],
      [2, "Hai", true],
      [3, "Ba", false],
    ]);
  });

  it("P4–P6: tiêu đề, phụ đề, các cấp, đánh số, ghi chú giữ nguyên chữ; bỏ số trang", async () => {
    const file = await buildPptx([
      { title: "Phản hồi trong dạy học", titleType: "ctrTitle", subtitle: ["Khoa Công nghệ giáo dục"], layout: "title" },
      {
        title: "Ba câu hỏi",
        body: ["Đích đến là gì?", { text: "Mục tiêu bài học", lvl: 1 }, { text: "Bước một", num: true }],
        notes: "Dòng một của ghi chú.\n\nDòng ba,  giữ  nguyên.",
      },
    ]);
    const { deck } = await parsePptx(file);
    const [a, b] = deck.slides;
    expect(a!.title).toBe("Phản hồi trong dạy học");
    expect(a!.layoutType).toBe("title");
    expect(a!.subtitle.map((p) => p.text)).toEqual(["Khoa Công nghệ giáo dục"]);
    expect(b!.paragraphs).toEqual([
      { text: "Đích đến là gì?", level: 0, numbered: false },
      { text: "Mục tiêu bài học", level: 1, numbered: false },
      { text: "Bước một", level: 0, numbered: true },
    ]);
    expect(b!.notes).toBe("Dòng một của ghi chú.\n\nDòng ba,  giữ  nguyên.");
    expect(JSON.stringify(deck)).not.toContain('"2"');
  });

  it("P4: không có placeholder tiêu đề thì lấy dòng đầu của khối chữ trên cùng", async () => {
    const file = await buildPptx([{ textBoxes: [{ text: "Nội dung bên dưới", y: 3000000 }, { text: "Tiêu đề tự gõ", y: 200000 }] }]);
    const { deck } = await parsePptx(file);
    expect(deck.slides[0]!.title).toBe("Tiêu đề tự gõ");
    expect(deck.slides[0]!.hasTitlePlaceholder).toBe(false);
    expect(deck.slides[0]!.paragraphs.map((p) => p.text)).toEqual(["Nội dung bên dưới"]);
  });

  it("P5, P7: bỏ logo và chân trang lặp ở nhiều slide; hình lớn đứng trước", async () => {
    const logo = { name: "logo.png", cx: SLIDE_W / 10, cy: SLIDE_H / 10 };
    const footer = { text: "Khoa CNGD, Trường ĐH X", y: 6400000 };
    const file = await buildPptx([
      { title: "A", images: [logo], textBoxes: [footer] },
      { title: "B", images: [logo, { name: "nho.png", cx: 1000000, cy: 1000000 }, { name: "to.png", cx: SLIDE_W / 2, cy: SLIDE_H / 2 }], textBoxes: [footer] },
      { title: "C", images: [logo], textBoxes: [footer] },
      { title: "D", images: [logo], textBoxes: [footer] },
    ]);
    const { deck, media } = await parsePptx(file);
    expect(deck.droppedRepeatedImages).toBe(4);
    expect(deck.droppedRepeatedText).toBe(4);
    expect(deck.slides[1]!.images.map((i) => i.target)).toEqual(["ppt/media/to.png", "ppt/media/nho.png"]);
    expect(deck.slides[0]!.paragraphs).toEqual([]);
    expect((await media("ppt/media/to.png"))?.length).toBeGreaterThan(10);
  });

  it("P7: hình lớn lặp lại (ảnh nền nội dung) không bị coi là logo", async () => {
    const big = { name: "nen.png", cx: SLIDE_W, cy: SLIDE_H };
    const file = await buildPptx([{ title: "A", images: [big] }, { title: "B", images: [big] }, { title: "C", images: [big] }]);
    const { deck } = await parsePptx(file);
    expect(deck.slides.every((s) => s.images.length === 1)).toBe(true);
  });

  it("P8: đọc bảng và biểu đồ (kể cả phần trăm, thanh ngang)", async () => {
    const file = await buildPptx([
      { title: "Bảng", table: [["Mức", "Ví dụ"], ["Nhiệm vụ", "Đúng hay sai"], ["Quá trình", "Cách làm"]] },
      { title: "Biểu đồ", chart: { type: "bar", title: "Khảo sát", labels: ["Lớp A", "Lớp B"], series: [{ name: "Điểm", values: [7.5, 8] }] } },
      { title: "Tỉ lệ", chart: { type: "hbar", labels: ["Có", "Không"], series: [{ name: "Tỉ lệ", values: [0.35, 0.65] }], percent: true } },
    ]);
    const { deck } = await parsePptx(file);
    expect(deck.slides[0]!.tables).toEqual([[["Mức", "Ví dụ"], ["Nhiệm vụ", "Đúng hay sai"], ["Quá trình", "Cách làm"]]]);
    expect(deck.slides[1]!.charts[0]).toEqual({ type: "bar", title: "Khảo sát", labels: ["Lớp A", "Lớp B"], series: [{ name: "Điểm", values: [7.5, 8] }], unit: "" });
    expect(deck.slides[2]!.charts[0]).toMatchObject({ type: "hbar", unit: "%", series: [{ values: [35, 65] }] });
  });

  it("P9: SmartArt lấy chữ theo cấp (bỏ nút trình bày); cờ sơ đồ hình khối, công thức, video, hiệu ứng", async () => {
    const file = await buildPptx([
      { title: "SmartArt", smartArt: [{ text: "Đích đến", children: ["Mục tiêu"] }, { text: "Hiện trạng" }] },
      { title: "Sơ đồ", shapes: ["Bước 1", "Bước 2", "Bước 3"] },
      { title: "Công thức", equation: "x = 2", video: true, animated: true },
    ]);
    const { deck } = await parsePptx(file);
    const [a, b, c] = deck.slides;
    expect(a!.smartArt).toEqual([
      { text: "Đích đến", level: 0, numbered: false },
      { text: "Mục tiêu", level: 1, numbered: false },
      { text: "Hiện trạng", level: 0, numbered: false },
    ]);
    expect(a!.flags).toContain("smartart");
    expect(b!.flags).toContain("shapes");
    expect(b!.paragraphs.map((p) => p.text)).toEqual(["Bước 1", "Bước 2", "Bước 3"]);
    expect(c!.flags).toEqual(expect.arrayContaining(["equation", "media"]));
    expect(c!.paragraphs.map((p) => p.text)).toEqual(["x = 2"]);
    expect(JSON.stringify(c)).not.toContain("FALLBACK");
    expect(deck.animatedSlides).toBe(1);
  });

  it("P7: hình EMF được báo là không chuyển được", async () => {
    const file = await buildPptx([{ title: "Vector", images: [{ name: "clip.emf", cx: 1000, cy: 1000 }] }]);
    const { deck } = await parsePptx(file);
    expect(deck.slides[0]!.images).toEqual([]);
    expect(deck.slides[0]!.flags).toContain("image_unsupported");
  });

  it("P2: file OLE (.ppt cũ hoặc có mật khẩu), file không phải trình chiếu", async () => {
    await expect(parsePptx(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]))).rejects.toMatchObject({ code: "ole_container" });
    await expect(parsePptx(new TextEncoder().encode("xin chào"))).rejects.toBeInstanceOf(PptxError);
    const docx = new JSZip();
    docx.file("word/document.xml", "<w:document/>");
    await expect(parsePptx(await docx.generateAsync({ type: "uint8array" }))).rejects.toMatchObject({ code: "not_pptx" });
  });
});

describe("suggestMinutes (P11)", () => {
  it("theo số slide", () => {
    expect([8, 12, 13, 19, 20, 24, 60].map(suggestMinutes)).toEqual([15, 15, 30, 30, 45, 45, 45]);
  });
});
