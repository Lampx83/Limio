import { describe, expect, it } from "vitest";
import { buildPptx } from "@/test/pptxFixture";
import { parsePptx } from "./pptxImport";
import {
  chunkBalanced,
  importSourceText,
  importedSlideFor,
  keepOutline,
  piecesFor,
  pointsSig,
  sanitizeImportSource,
  splitText,
  toImportedSlide,
  type ImportedSlide,
} from "./limioLivePptx";
import { sanitizeOutline } from "./limioLiveOutline";
import { MAX_LEN } from "./limioLiveSlides";

const slide = (o: Partial<ImportedSlide> & { n: number }): ImportedSlide => ({
  hidden: false,
  layoutType: "obj",
  title: "",
  subtitle: [],
  paragraphs: [],
  notes: "",
  imageUrl: null,
  imageCount: 0,
  tables: [],
  charts: [],
  smartArt: [],
  flags: [],
  ...o,
});
const P = (text: string, level = 0, numbered = false) => ({ text, level, numbered });

/** Mọi chữ có trên các slide dựng ra (để kiểm "không mất chữ"). */
function allText(pieces: ReturnType<typeof piecesFor>): string {
  return JSON.stringify(pieces.map((p) => p.config));
}

describe("splitText (P15)", () => {
  it("không đổi đoạn ngắn; tách ở ranh giới câu rồi dấu phẩy rồi khoảng trắng, không mất chữ", () => {
    expect(splitText("Ngắn.", 140)).toEqual(["Ngắn."]);
    const long = "Câu thứ nhất khá dài để vượt giới hạn. Câu thứ hai cũng dài không kém, có dấu phẩy ở giữa câu. Câu ba.";
    const parts = splitText(long, 50);
    expect(parts.every((p) => p.length <= 50)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
    const noSpace = "x".repeat(130);
    expect(splitText(noSpace, 60).join("")).toBe(noSpace);
  });
  it("chunkBalanced chia đều", () => {
    expect(chunkBalanced([1, 2, 3, 4, 5, 6, 7], 3).map((g) => g.length)).toEqual([3, 2, 2]);
    expect(chunkBalanced([1, 2, 3, 4], 3).map((g) => g.length)).toEqual([2, 2]);
    expect(chunkBalanced([], 3)).toEqual([]);
  });
});

describe("piecesFor: chọn bố cục bằng quy tắc (P16)", () => {
  it("slide đầu → Bìa, phụ đề giữ nguyên", () => {
    const [p] = piecesFor(slide({ n: 1, title: "Phản hồi trong dạy học", subtitle: ["Khoa Công nghệ giáo dục"] }), { first: true });
    expect(p).toMatchObject({ layout: "cover", config: { title: "Phản hồi trong dạy học", subtitle: "Khoa Công nghệ giáo dục" } });
  });
  it("Section Header → Mở phần; slide chỉ có tiêu đề → Bìa", () => {
    expect(piecesFor(slide({ n: 3, layoutType: "secHead", title: "Phần 2", paragraphs: [P("Bốn mức")] }), { first: false })[0]).toMatchObject({
      layout: "section",
      config: { title: "Phần 2", subtitle: "Bốn mức" },
    });
    expect(piecesFor(slide({ n: 9, title: "Cảm ơn" }), { first: false })[0]!.layout).toBe("cover");
  });
  it("≤ 3 ý → Chữ và hình, hình gốc hiện trọn", () => {
    const [p] = piecesFor(slide({ n: 2, title: "Phản hồi là gì?", paragraphs: [P("Ý một."), P("Ý hai.")], imageUrl: "/api/limio-live-media/u-1.jpg" }), { first: false });
    expect(p).toMatchObject({ layout: "image", config: { bullets: ["Ý một.", "Ý hai."], imageUrl: "/api/limio-live-media/u-1.jpg", imageFit: "contain" } });
  });
  it("danh sách đánh số 2–5 mục ngắn → Các bước; SmartArt → Các bước (ý con là câu giải thích)", () => {
    const steps = piecesFor(slide({ n: 4, title: "Quy trình", paragraphs: [P("Quan sát", 0, true), P("Nhận xét", 0, true), P("Gợi ý", 0, true)] }), { first: false });
    expect(steps[0]!.layout).toBe("steps");
    const smart = piecesFor(slide({ n: 5, title: "Ba câu hỏi", smartArt: [P("Đích đến"), P("Mục tiêu bài", 1), P("Hiện trạng"), P("Bước tiếp")] }), { first: false });
    expect(smart[0]).toMatchObject({ layout: "steps", config: { items: [{ heading: "Đích đến", body: "Mục tiêu bài" }, { heading: "Hiện trạng" }, { heading: "Bước tiếp" }] } });
  });
  it("2–4 mục đều có ý con → Ba thẻ; 4–5 mục ngắn → Tóm tắt", () => {
    const cards = piecesFor(slide({ n: 6, title: "Bốn mức", paragraphs: [P("Nhiệm vụ"), P("Đúng hay sai", 1), P("Quá trình"), P("Cách làm", 1)] }), { first: false });
    expect(cards[0]).toMatchObject({ layout: "cards", config: { items: [{ heading: "Nhiệm vụ", body: "Đúng hay sai" }, { heading: "Quá trình", body: "Cách làm" }] } });
    const sum = piecesFor(slide({ n: 7, title: "Tóm tắt", paragraphs: ["A", "B", "C", "D"].map((t) => P(t)) }), { first: false });
    expect(sum[0]!.layout).toBe("summary");
  });
  it("P15: nhiều ý dài hơn bố cục chứa → chia slide (tiếp), không mất chữ", () => {
    const paragraphs = Array.from({ length: 7 }, (_, i) => P(`Ý số ${i + 1} của slide này được viết thành một câu khá dài để không vừa bố cục Tóm tắt.`));
    const pieces = piecesFor(slide({ n: 8, title: "Nhiều ý", paragraphs }), { first: false });
    expect(pieces.map((p) => p.layout)).toEqual(["image", "image", "image"]);
    expect(pieces.map((p) => (p.config as { title: string }).title)).toEqual(["Nhiều ý", "Nhiều ý (tiếp)", "Nhiều ý (tiếp)"]);
    const text = allText(pieces);
    for (const p of paragraphs) expect(text).toContain(p.text);
  });
  it("P15: ý dài hơn 140 ký tự được tách câu, tiêu đề dài hơn 120 ký tự chuyển phần thừa xuống thân", () => {
    const long = "Phản hồi hiệu quả trả lời ba câu hỏi: đích đến là gì, em đang ở đâu và bước tiếp theo là gì. Mỗi câu hỏi tương ứng một chức năng riêng của phản hồi trong lớp học.";
    const title = "Tiêu đề ".repeat(20).trim();
    const pieces = piecesFor(slide({ n: 9, title, paragraphs: [P(long)] }), { first: false });
    const bullets = pieces.flatMap((p) => (p.config as { bullets?: string[] }).bullets ?? []);
    expect(bullets.every((b) => b.length <= MAX_LEN.bullet)).toBe(true);
    expect(bullets.join(" ")).toContain("Mỗi câu hỏi tương ứng");
    expect(((pieces[0]!.config as { title: string }).title).length).toBeLessThanOrEqual(MAX_LEN.title);
    expect(allText(pieces).replace(/\s+/g, "")).toContain(title.replace(/\s+/g, "").slice(-30));
  });
  it("P19: bảng vừa khung → Bảng (lặp hàng tiêu đề khi chia); bảng quá rộng → danh sách", () => {
    const rows = Array.from({ length: 9 }, (_, i) => [`Mức ${i + 1}`, `Ví dụ ${i + 1}`]);
    const pieces = piecesFor(slide({ n: 10, title: "Bốn mức", tables: [[["Mức", "Ví dụ"], ...rows]] }), { first: false });
    expect(pieces.every((p) => p.layout === "table")).toBe(true);
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    expect(pieces.every((p) => (p.config as { head: string[] }).head[0] === "Mức")).toBe(true);
    expect(pieces.flatMap((p) => (p.config as { rows: string[][] }).rows)).toEqual(rows);
    const wide = piecesFor(slide({ n: 11, title: "Rộng", tables: [[["a", "b", "c", "d", "e", "f"], ["1", "2", "3", "4", "5", "6"]]] }), { first: false });
    expect(wide[0]!.layout).toBe("image");
    expect((wide[0]!.config as { bullets: string[] }).bullets).toEqual(["a: b · c · d · e · f", "1: 2 · 3 · 4 · 5 · 6"]);
  });
  it("P20: biểu đồ vừa khung giữ số; không vừa → bảng số liệu; chữ thêm sang slide (tiếp)", () => {
    const chart = { type: "bar" as const, title: "", labels: ["Lớp A", "Lớp B"], series: [{ name: "Điểm", values: [7.5, 8] }], unit: "" };
    const pieces = piecesFor(slide({ n: 12, title: "Kết quả", charts: [chart], paragraphs: [P("Lớp B nhỉnh hơn.")] }), { first: false });
    expect(pieces[0]).toMatchObject({ layout: "chart", config: { chartType: "bar", labels: ["Lớp A", "Lớp B"], series: [{ name: "Điểm", values: [7.5, 8] }] } });
    expect(pieces[1]).toMatchObject({ layout: "image", config: { title: "Kết quả (tiếp)", bullets: ["Lớp B nhỉnh hơn."] } });
    const many = { ...chart, type: "pie" as const, labels: ["a", "b", "c", "d", "e", "f", "g"], series: [{ name: "Tỉ lệ", values: [1, 2, 3, 4, 5, 6, 7] }] };
    const fallback = piecesFor(slide({ n: 13, title: "Tròn", charts: [many] }), { first: false });
    expect(fallback[0]).toMatchObject({ layout: "table", config: { head: ["", "Tỉ lệ"] } });
    expect(fallback.flatMap((p) => (p.config as { rows: string[][] }).rows).length).toBe(7);
  });
});

describe("keepOutline (P14, P21)", () => {
  it("mỗi slide gốc thành dòng dàn ý có nguồn; chia phần như dàn ý cũ; lưu dàn ý giữ nguyên nguồn", () => {
    const src = {
      slides: [
        slide({ n: 1, title: "Bài giảng", subtitle: ["Khoa A"] }),
        slide({ n: 2, layoutType: "secHead", title: "Phần một" }),
        slide({ n: 3, title: "Ý chính", paragraphs: [P("Một."), P("Hai.")] }),
        slide({ n: 4, title: "Tóm tắt", paragraphs: ["A", "B", "C", "D"].map((t) => P(t)) }),
      ],
    };
    const o = keepOutline(src, "Bài giảng");
    expect(o.slides.map((s) => [s.layout, s.origin?.slides, s.origin?.how])).toEqual([
      ["cover", [1], "same"],
      ["section", [2], "same"],
      ["image", [3], "same"],
      ["summary", [4], "same"],
    ]);
    expect(o.parts.map((p) => p.role)).toEqual(["cover", "content", "summary"]);
    const saved = sanitizeOutline(JSON.parse(JSON.stringify(o)));
    expect(saved.slides.map((s) => s.origin)).toEqual(o.slides.map((s) => s.origin));
  });
});

describe("importedSlideFor (P17, P18, P22)", () => {
  const src = {
    slides: [
      slide({ n: 1, title: "Bìa" }),
      slide({ n: 2, title: "Ý chính", paragraphs: [P("Một."), P("Hai.")], notes: "Ghi chú gốc,  nguyên chữ.\nDòng hai.", imageUrl: "/api/limio-live-media/u-2.jpg", hidden: true }),
    ],
  };
  const rows = keepOutline(src, "Bìa").slides;

  it("dựng nguyên chữ, hình, ghi chú; giữ cờ ẩn; có outlineId và aiGenerated", () => {
    const g = importedSlideFor(rows[1]!, src)!;
    expect(g.usedFallback).toBe(false);
    expect(g.config).toMatchObject({
      layout: "image",
      title: "Ý chính",
      bullets: ["Một.", "Hai."],
      imageUrl: "/api/limio-live-media/u-2.jpg",
      imageFit: "contain",
      presenterNote: "Ghi chú gốc,  nguyên chữ.\nDòng hai.",
      hidden: true,
      outlineId: rows[1]!.id,
      aiGenerated: true,
    });
  });
  it("sửa tiêu đề → tiêu đề mới; sửa ý → dựng từ ý đã sửa, giữ hình và ghi chú; đổi bố cục → đổi nội dung gốc", () => {
    expect(importedSlideFor({ ...rows[1]!, title: "Tiêu đề mới" }, src)!.config).toMatchObject({ title: "Tiêu đề mới", bullets: ["Một.", "Hai."] });
    const edited = importedSlideFor({ ...rows[1]!, points: ["Ý giảng viên sửa."] }, src)!.config;
    expect(edited).toMatchObject({ bullets: ["Ý giảng viên sửa."], imageUrl: "/api/limio-live-media/u-2.jpg", presenterNote: "Ghi chú gốc,  nguyên chữ.\nDòng hai." });
    const cards = importedSlideFor({ ...rows[1]!, layout: "summary" }, src)!.config;
    expect(cards).toMatchObject({ layout: "summary" });
    expect(JSON.stringify(cards)).toContain("Một.");
  });
  it("dòng không có nguồn, nguồn gộp hay mới → null (AI viết)", () => {
    expect(importedSlideFor({ ...rows[1]!, origin: undefined }, src)).toBeNull();
    expect(importedSlideFor({ ...rows[1]!, origin: { slides: [1, 2], how: "merge" } }, src)).toBeNull();
    expect(importedSlideFor({ ...rows[1]!, origin: { slides: [], how: "new" } }, src)).toBeNull();
  });
  it("sig ổn định qua lưu dàn ý", () => {
    const saved = sanitizeOutline({ title: "x", slides: rows, parts: [] }).slides[1]!;
    expect(pointsSig(saved.points)).toBe(saved.origin!.sig);
  });
});

describe("từ file .pptx tới dàn ý", () => {
  it("đọc, lưu, đọc lại importSource; chữ cả bài cho AI có ghi chú và số liệu", async () => {
    const file = await buildPptx([
      { title: "Phản hồi", titleType: "ctrTitle", subtitle: ["Khoa CNGD"], layout: "title" },
      { title: "Khảo sát", chart: { type: "bar", labels: ["A", "B"], series: [{ name: "Điểm", values: [7, 8] }] }, notes: "Nói về lớp B." },
    ]);
    const { deck } = await parsePptx(file);
    const raw = { format: "pptx", fileName: "x.pptx", slides: deck.slides.map((s) => toImportedSlide(s, null)) };
    const src = sanitizeImportSource(JSON.parse(JSON.stringify(raw)))!;
    expect(src.slides).toHaveLength(2);
    expect(importSourceText(src)).toContain("Điểm: A 7; B 8");
    expect(importSourceText(src)).toContain("Ghi chú giảng: Nói về lớp B.");
    const o = keepOutline(src, "Phản hồi");
    expect(o.slides.map((s) => s.layout)).toEqual(["cover", "chart"]);
  });
});

describe("generateDeckSlides + fixedSlide (P14: cách Giữ ý không gọi AI)", () => {
  it("mọi dòng lấy từ slide gốc → không gọi mô hình lần nào", async () => {
    const { generateDeckSlides } = await import("./limioLiveGenerate");
    const src = { slides: [slide({ n: 1, title: "Bìa" }), slide({ n: 2, title: "Ý", paragraphs: [P("Một.")], notes: "Ghi chú." })] };
    const outline = keepOutline(src, "Bìa").slides;
    let calls = 0;
    const res = await generateDeckSlides({
      outline,
      isFatal: () => true,
      generateBatch: async () => {
        calls += 1;
        return [];
      },
      fixedSlide: (os) => importedSlideFor(os, src),
    });
    expect(calls).toBe(0);
    expect(res.fallbackCount).toBe(0);
    expect(res.slides.map((s) => s.config.layout)).toEqual(["cover", "image"]);
    expect(res.slides[1]!.config.presenterNote).toBe("Ghi chú.");
  });
});
