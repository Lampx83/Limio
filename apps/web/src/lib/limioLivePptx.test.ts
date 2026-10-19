import { describe, expect, it } from "vitest";
import { buildPptx } from "@/test/pptxFixture";
import { parsePptx } from "./pptxImport";
import {
  applyEmphasis,
  chunkBalanced,
  importSourceText,
  importedSlideFor,
  importReport,
  keepOutline,
  piecesFor,
  pointsSig,
  sanitizeImportSource,
  splitText,
  toImportedSlide,
  type ImportedSlide,
} from "./limioLivePptx";
import { sanitizeOutline } from "./limioLiveOutline";
import { groupsFit } from "./limioLiveGroups";
import { MAX_LEN } from "./limioLiveSlides";

const slide = (o: Partial<ImportedSlide> & { n: number }): ImportedSlide => ({
  hidden: false,
  layoutType: "obj",
  title: "",
  kicker: "",
  credit: "",
  caption: "",
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
      // P38: "Phần 2" là dòng dẫn mở phần; tên phần là dòng nội dung, số phần lấy từ dòng dẫn.
      layout: "section",
      config: { title: "Bốn mức", sectionNumber: "02" },
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
  it("2 mục trở lên đều có ý con → Nhóm (P56, thay Ba thẻ); 4–5 mục ngắn → Tóm tắt", () => {
    const cards = piecesFor(slide({ n: 6, title: "Bốn mức", paragraphs: [P("Nhiệm vụ"), P("Đúng hay sai", 1), P("Quá trình"), P("Cách làm", 1)] }), { first: false });
    expect(cards[0]).toMatchObject({ layout: "groups", config: { groups: [{ heading: "Nhiệm vụ", points: ["Đúng hay sai"] }, { heading: "Quá trình", points: ["Cách làm"] }] } });
    const sum = piecesFor(slide({ n: 7, title: "Tóm tắt", paragraphs: ["A", "B", "C", "D"].map((t) => P(t)) }), { first: false });
    expect(sum[0]!.layout).toBe("summary");
  });
  it("P15: nhiều ý dài hơn bố cục chứa → chia slide (tiếp), không mất chữ", () => {
    const paragraphs = Array.from({ length: 7 }, (_, i) => P(`Ý số ${i + 1} của slide này được viết thành một câu khá dài để không vừa bố cục Tóm tắt.`));
    const pieces = piecesFor(slide({ n: 8, title: "Nhiều ý", paragraphs }), { first: false });
    // P47: nhiều chữ thì bố cục Danh sách; chỉ chia khi ở 26 px vẫn không vừa.
    expect(pieces.every((p) => p.layout === "list")).toBe(true);
    expect(pieces.length).toBeLessThanOrEqual(2);
    expect((pieces[0]!.config as { title: string }).title).toBe("Nhiều ý");
    const text = allText(pieces);
    for (const p of paragraphs) expect(text).toContain(p.text);
  });
  it("P15: ý dài hơn 140 ký tự được tách câu, tiêu đề dài hơn 120 ký tự chuyển phần thừa xuống thân", () => {
    const long = "Phản hồi hiệu quả trả lời ba câu hỏi: đích đến là gì, em đang ở đâu và bước tiếp theo là gì. Mỗi câu hỏi tương ứng một chức năng riêng của phản hồi trong lớp học.";
    const title = "Tiêu đề ".repeat(20).trim();
    const pieces = piecesFor(slide({ n: 9, title, paragraphs: [P(long)] }), { first: false });
    // P47: không cắt đôi câu: ý dài nằm trọn trong một dòng Danh sách (≤ 200 ký tự), dài hơn nữa mới tách câu.
    const bullets = pieces.flatMap((p) => ((p.config as { lines?: Array<{ text: string }> }).lines ?? []).map((l) => l.text));
    expect(bullets.every((b) => b.length <= MAX_LEN.listLine)).toBe(true);
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
    // P46: bảng rộng hơn 5 cột vẫn giữ dạng bảng, chia theo nhóm cột và lặp cột đầu.
    const wide = piecesFor(slide({ n: 11, title: "Rộng", tables: [[["a", "b", "c", "d", "e", "f"], ["1", "2", "3", "4", "5", "6"]]] }), { first: false });
    expect(wide.map((p) => p.layout)).toEqual(["table", "table"]);
    expect(wide.map((p) => (p.config as { head: string[] }).head)).toEqual([["a", "b", "c", "d"], ["a", "e", "f"]]);
    expect(wide.map((p) => (p.config as { rows: string[][] }).rows)).toEqual([[["1", "2", "3", "4"]], [["1", "5", "6"]]]);
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

describe("Excel nhúng dựng thành Biểu đồ/Bảng (E2, E4, E8)", () => {
  it("biểu đồ và bảng đọc từ Excel nhúng dựng như biểu đồ, bảng thường; báo cáo đếm riêng", async () => {
    const file = await buildPptx([
      {
        title: "Điểm theo lớp",
        ole: { kind: "xlsxChart", chart: { type: "bar", labels: ["Lớp A", "Lớp B", "Lớp C"], series: [{ name: "Điểm", values: [6.5, 7.25, 8] }] } },
      },
      { title: "Số sinh viên", ole: { kind: "xlsxSheet", rows: [["Năm", "Số SV"], [2024, 1234], [2025, 1500]] } },
      { title: "Đối tượng cũ", ole: { kind: "bin" } },
    ]);
    const { deck } = await parsePptx(file);
    const [chart] = piecesFor(toImportedSlide(deck.slides[0]!, null), { first: false });
    expect(chart).toMatchObject({ layout: "chart", config: { chartType: "bar", labels: ["Lớp A", "Lớp B", "Lớp C"], series: [{ name: "Điểm", values: [6.5, 7.25, 8] }] } });
    const [table] = piecesFor(toImportedSlide(deck.slides[1]!, null), { first: false });
    expect(table).toMatchObject({ layout: "table", config: { head: ["Năm", "Số SV"], rows: [["2024", "1234"], ["2025", "1500"]] } });

    const report = importReport(deck);
    expect(report).toMatchObject({ charts: 1, tables: 1, fromExcel: 2 });
    expect(report.warnings.join(" ")).toContain("Slide 3 có đối tượng nhúng");
    expect(importSourceText({ slides: deck.slides.map((s) => toImportedSlide(s, null)) })).toContain("Lớp B 7.25");
  });
});

describe("tối ưu theo file thật (P38, P40, P43, P44, P47, P48)", () => {
  it("P38: bìa nhận dòng dẫn làm tên đơn vị; 'NỘI DUNG 1' → Mở phần số 01", () => {
    const [cover] = piecesFor(slide({ n: 1, title: "NHẬP MÔN CNGD", kicker: "Nhóm chuyên môn: CNGD", paragraphs: [P("Định nghĩa và phạm vi")] }), { first: true });
    expect(cover).toMatchObject({ layout: "cover", config: { title: "NHẬP MÔN CNGD", org: "Nhóm chuyên môn: CNGD", subtitle: "Định nghĩa và phạm vi" } });
    const [sec] = piecesFor(slide({ n: 4, title: "ĐỊNH NGHĨA VỀ CNGD", kicker: "NỘI DUNG 1" }), { first: false });
    expect(sec).toMatchObject({ layout: "section", config: { title: "ĐỊNH NGHĨA VỀ CNGD", sectionNumber: "01" } });
  });
  it("P48: tiêu đề đánh số chỉ có tiêu đề → Mở phần (số tách khỏi tên); slide '2.1 …' không bị coi là mở phần", () => {
    expect(piecesFor(slide({ n: 9, title: "2. Phân tích chuẩn đầu ra" }), { first: false })[0]).toMatchObject({
      layout: "section",
      config: { title: "Phân tích chuẩn đầu ra", sectionNumber: "02" },
    });
    expect(piecesFor(slide({ n: 10, title: "2.1 Chi tiết", paragraphs: [P("Một."), P("Hai.")] }), { first: false })[0]!.layout).not.toBe("section");
  });
  it("P43: slide cảm ơn hoặc lặp tên bài với vài dòng ngắn → Bìa", () => {
    expect(piecesFor(slide({ n: 26, title: "Thank you for listening!", paragraphs: [P("Contacts:"), P("Dr. A – Email: a@b.c")] }), { first: false })[0]!.layout).toBe("cover");
    const closing = piecesFor(slide({ n: 21, title: "NHẬP MÔN CNGD", paragraphs: [P("Biên soạn: TS. A"), P("Trình bày: TS. A")] }), { first: false, deckTitle: "Nhập môn CNGD" });
    expect(closing[0]!.layout).toBe("cover");
  });
  it("P47: slide nhiều ý thành một slide Danh sách (ý con giữ cấp), hình ở ô bên phải; không cắt đôi câu", () => {
    const paragraphs = [P("Kiến thức chuyên môn"), P("PLO1. Áp dụng kiến thức.", 1), P("PLO2. Phát triển chương trình.", 1), P("Pros"), P("Nền tảng rộng", 1), P("Cons"), P("Chưa nói về AI", 1)];
    const pieces = piecesFor(slide({ n: 10, title: "2.1 Phân tích", paragraphs, imageUrl: "/api/limio-live-media/u-10.jpg" }), { first: false });
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ layout: "list", config: { imageUrl: "/api/limio-live-media/u-10.jpg" } });
    const lines = (pieces[0]!.config as { lines: Array<{ text: string; sub?: boolean }> }).lines;
    expect(lines.map((l) => `${l.sub ? "– " : ""}${l.text}`)).toEqual(paragraphs.map((p) => `${p.level ? "– " : ""}${p.text}`));
    const long = "Công nghệ được hiểu là một hệ thống bao gồm phương tiện, phương pháp và kỹ năng, được sử dụng để vận dụng các quy luật khách quan, tác động vào đối tượng.";
    const [one] = piecesFor(slide({ n: 6, title: "1.1", paragraphs: [P(long)] }), { first: false });
    expect(one).toMatchObject({ layout: "list", config: { lines: [{ text: long }] } });
  });
  it("P40: nguồn hình hiện ở chân ô hình khi slide có hình; slide không hiện hình thì bỏ", () => {
    const withImg = piecesFor(slide({ n: 5, title: "Ảnh", paragraphs: [P("Một.")], imageUrl: "/api/limio-live-media/u-5.jpg", credit: "Nguồn ảnh minh hoạ: Tạo bởi Claude (AI)" }), { first: false });
    expect(withImg[0]!.config).toMatchObject({ imageCredit: "Tạo bởi Claude (AI)" });
    const noImg = piecesFor(slide({ n: 4, title: "Mở phần", kicker: "NỘI DUNG 1", credit: "Nguồn ảnh minh hoạ: Tạo bởi Claude (AI)" }), { first: false });
    expect(JSON.stringify(noImg)).not.toContain("Claude");
  });
  it("Mở đầu: slide giữa Bìa và slide Mở phần đầu tiên thành phần Mục tiêu, số phần khớp bài gốc", () => {
    const src = {
      slides: [
        slide({ n: 1, title: "Bài" }),
        slide({ n: 2, title: "Mục tiêu bài học", paragraphs: [P("Giải thích được A."), P("Phân biệt được B.")] }),
        slide({ n: 3, title: "Định nghĩa", kicker: "NỘI DUNG 1" }),
        slide({ n: 4, title: "Ý", paragraphs: [P("Một.")] }),
      ],
    };
    const o = keepOutline(src, "Bài");
    expect(o.parts.map((p) => p.role)).toEqual(["cover", "objectives", "content"]);
  });
  it("P44: Thêm lại chèn slide gốc vào đúng chỗ theo thứ tự gốc", async () => {
    const { appendBack } = await import("./limioLivePptx");
    const src = { slides: [slide({ n: 1, title: "Bìa" }), slide({ n: 2, title: "Hai", paragraphs: [P("a.")] }), slide({ n: 3, title: "Ba", paragraphs: [P("b.")] }), slide({ n: 4, title: "Bốn", paragraphs: [P("c.")] })] };
    const full = keepOutline(src, "Bìa");
    const without3 = { ...full, slides: full.slides.filter((r) => r.origin?.slides[0] !== 3) };
    const back = appendBack(without3, src, 3);
    expect(back.slides.map((r) => r.origin?.slides[0])).toEqual([1, 2, 3, 4]);
    expect(back.slides[2]!.origin?.how).toBe("back");
  });
});

describe("chú thích và nguồn ảnh (P49)", () => {
  it("chú thích thành mô tả ảnh; 'Source: https://…' hiện tên trang và giữ đường dẫn", () => {
    const [p] = piecesFor(
      slide({
        n: 5,
        title: "1. POSITIVE THINKING",
        paragraphs: [P("Is the glass half-full or half-empty?")],
        imageUrl: "/api/limio-live-media/u-5.jpg",
        caption: "Figure 1b: Glass of water",
        credit: "Source: https://www.freepik.com/free-vector/glass.htm",
      }),
      { first: false },
    );
    expect(p!.config).toMatchObject({
      imageAlt: "Figure 1b: Glass of water",
      imageCredit: "freepik.com",
      imageSourceUrl: "https://www.freepik.com/free-vector/glass.htm",
    });
    expect(JSON.stringify(p!.config.bullets)).not.toContain("Figure");
  });
});

describe("chữ nhấn và cụm từ khoá (P52, P53)", () => {
  it("applyEmphasis đánh dấu đúng cụm, trọn từ, không đè chữ đã có dấu", () => {
    const marks = [
      { text: "chemicals", kind: "mark" as const },
      { text: "chủ động", kind: "bold" as const },
      { text: "love", kind: "italic" as const },
    ];
    expect(applyEmphasis("There are chemicals in our brains.", marks)).toBe("There are ==chemicals== in our brains.");
    expect(applyEmphasis("Học chủ động; lovely không phải love.", marks)).toBe("Học **chủ động**; lovely không phải *love*.");
    expect(applyEmphasis("Đã có **dấu** chemicals", marks)).toBe("Đã có **dấu** chemicals");
    expect(applyEmphasis("Không nhấn gì", [])).toBe("Không nhấn gì");
  });

  it("slide dựng ra mang dấu tô màu ở các dòng, không ở tiêu đề; dàn ý không có dấu", () => {
    const src = {
      slides: [
        slide({ n: 1, title: "Bìa" }),
        slide({
          n: 2,
          title: "Chemicals in the brain",
          paragraphs: [P("There are chemicals in our brains."), P("Release these ‘feel-good’ chemicals!"), P("Third line of text."), P("Fourth line of text.")],
          emphasis: [
            { text: "chemicals", kind: "mark" },
            { text: "feel-good", kind: "mark" },
          ],
        }),
      ],
    };
    const rows = keepOutline(src, "Bìa").slides;
    expect(JSON.stringify(rows[1]!.points)).not.toContain("==");
    const c = importedSlideFor(rows[1]!, src)!.config as Record<string, any>;
    expect(c.title).toBe("Chemicals in the brain");
    expect(JSON.stringify(c)).toContain("There are ==chemicals== in our brains.");
    expect(JSON.stringify(c)).toContain("‘==feel-good==’ ==chemicals==!");
  });

  it("slide có cụm từ là Danh sách: các dòng rồi đến cụm từ, không tách slide, không thành slide mở phần", () => {
    const words = ["fantastic", "laugh", "love", "best", "great", "smile", "enjoy", "brilliant", "special", "nice", "good", "better", "amazing"];
    const pieces = piecesFor(
      slide({ n: 17, title: "4. REFLECTION", paragraphs: [P("Think Positive"), P("Using the words below, compose a positive statement to share with the class.")], words }),
      { first: false },
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.layout).toBe("list");
    expect(pieces[0]!.config).toMatchObject({ title: "4. REFLECTION", words });
    expect((pieces[0]!.config as any).lines).toHaveLength(2);
    const only = piecesFor(slide({ n: 9, title: "2. Từ khoá", words: ["một", "hai", "ba"] }), { first: false });
    expect(only.map((p) => p.layout)).toEqual(["list"]);
  });

  it("dữ liệu nhập cũ không có words/emphasis vẫn đọc được; dữ liệu lạ bị lọc", () => {
    const raw = { format: "pptx", fileName: "a.pptx", slides: [{ n: 1, title: "x", words: ["a", 3, ""], emphasis: [{ text: "a", kind: "lạ" }, null, { kind: "bold" }] }] };
    const s = sanitizeImportSource(raw)!.slides[0]!;
    expect(s.words).toEqual(["a"]);
    expect(s.emphasis).toEqual([{ text: "a", kind: "mark" }]);
  });
});

describe("slide hai cấp: chọn kiểu theo nội dung (P55–P59)", () => {
  const P1 = (text: string) => P(text, 0);
  const K = (text: string) => P(text, 1);
  const one = (s: ImportedSlide) => {
    const pieces = piecesFor(s, { first: false });
    return pieces;
  };

  it("2 nhóm ngắn có ý con (2.1 TECHNOLOGY IN EDUCATION) → Nhóm, chữ nguyên văn", () => {
    const pieces = one(
      slide({
        n: 5,
        title: "2.1. TECHNOLOGY IN EDUCATION",
        paragraphs: [P1("Bản chất"), K("Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy"), P1("Đặc trưng"), K("Tập trung vào phương tiện"), K("Không thay đổi bản chất phương pháp dạy học"), K("Giáo viên vẫn là trung tâm điều khiển")],
      }),
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.layout).toBe("groups");
    expect(pieces[0]!.config).toMatchObject({
      title: "2.1. TECHNOLOGY IN EDUCATION",
      groups: [
        { heading: "Bản chất", points: ["Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy"] },
        { heading: "Đặc trưng", points: ["Tập trung vào phương tiện", "Không thay đổi bản chất phương pháp dạy học", "Giáo viên vẫn là trung tâm điều khiển"] },
      ],
    });
  });

  it("đúng 2 nhóm đối lập (1.4 năng lực mất/gia tăng) → So sánh hai cột, nhóm đi xuống màu ấm", () => {
    const pieces = one(
      slide({
        n: 6,
        title: "1.4 AI thay đổi yêu cầu năng lực thị trường lao động Edtech",
        paragraphs: [
          P1("Năng lực đang mất lợi thế"),
          K("Sản xuất nội dung thông thường"),
          K("Thiết kế học liệu theo mẫu có sẵn"),
          K("Thao tác công nghệ lặp lại, quy trình cố định"),
          P1("Năng lực đang gia tăng nhu cầu"),
          K("Sử dụng AI có kiểm soát và có phê phán"),
        ],
      }),
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.layout).toBe("compare");
    expect((pieces[0]!.config as any).columns).toMatchObject([
      { heading: "Năng lực đang mất lợi thế", tone: "bad", points: ["Sản xuất nội dung thông thường", "Thiết kế học liệu theo mẫu có sẵn", "Thao tác công nghệ lặp lại, quy trình cố định"] },
      { heading: "Năng lực đang gia tăng nhu cầu", tone: "good", points: ["Sử dụng AI có kiểm soát và có phê phán"] },
    ]);
  });

  it("một nhóm có ý con (What positive thinking is not?) → Nhóm một nhóm, tên nhóm là câu dẫn", () => {
    const pieces = one(
      slide({ n: 7, title: "1. POSITIVE THINKING", paragraphs: [P1("What positive thinking is not?"), K("Ignoring problems or reality"), K("Toxic positivity (forced optimism)"), K('Just "thinking happy thoughts"')] }),
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.layout).toBe("groups");
    expect((pieces[0]!.config as any).groups).toHaveLength(1);
    expect((pieces[0]!.config as any).groups[0].heading).toBe("What positive thinking is not?");
  });

  it("câu không có ý con đứng trước một nhóm là câu dẫn; dấu ':' cuối tên nhóm bỏ đi", () => {
    const pieces = one(
      slide({
        n: 8,
        title: "1. POSITIVE THINKING",
        paragraphs: [P1("Why positive thinking matter?"), P1("Research findings:"), K("Positive thinkers have 23% lower levels of stress hormones"), K("Problem-solving ability improves by up to 20% in positive mental states"), K("Enhanced creativity and cognitive flexibility")],
      }),
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.config).toMatchObject({
      layout: "groups",
      lead: "Why positive thinking matter?",
      groups: [{ heading: "Research findings", points: ["Positive thinkers have 23% lower levels of stress hormones", "Problem-solving ability improves by up to 20% in positive mental states", "Enhanced creativity and cognitive flexibility"] }],
    });
  });

  it("5 nhóm ý con dài (4.1 năm nhóm năng lực AI) → Nhóm; chữ thân giữ to nên nếu cần thì chia hai slide, không co dưới 26 px", () => {
    const names = ["AI Literacy", "Đạo đức & Trách nhiệm số", "Sử dụng AI chuyên môn", "Đánh giá & kiểm chứng AI", "Thiết kế đánh giá trong bối cảnh AI"];
    const para = names.flatMap((n) => [P1(n), K(`Hiểu nguyên lý, khả năng và giới hạn của AI để dùng hiệu quả và có trách nhiệm (${n.length}).`)]);
    const pieces = one(slide({ n: 9, title: "4.1 Năm nhóm năng lực AI cần bổ sung vào chương trình ED2", paragraphs: para }));
    expect(pieces.length).toBeLessThanOrEqual(2);
    expect(pieces.every((p) => p.layout === "groups")).toBe(true);
    expect(pieces.flatMap((p) => (p.config as any).groups.map((g: any) => g.heading))).toEqual(names);
    for (const p of pieces) expect(groupsFit({ title: (p.config as any).title, groups: (p.config as any).groups }).overflow).toBe(false);
  });

  it("quá nhiều chữ thì chia slide (tiếp), không mất chữ", () => {
    const long = "Một câu rất dài mô tả đầy đủ năng lực cần đạt, có nhiều vế và nhiều ý nhỏ cần được trình bày cho trọn nghĩa, kèm ví dụ cụ thể.";
    const para = Array.from({ length: 6 }, (_, i) => [P1(`Nhóm số ${i + 1}`), K(`${long} ${i}a`), K(`${long} ${i}b`), K(`${long} ${i}c`), K(`${long} ${i}d`), K(`${long} ${i}e`)]).flat();
    const pieces = one(slide({ n: 10, title: "Quá dài", paragraphs: para }));
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.layout === "groups")).toBe(true);
    expect((pieces[1]!.config as any).title).toBe("Quá dài (tiếp)");
    expect(pieces.flatMap((p) => (p.config as any).groups.map((g: any) => g.heading)).sort()).toEqual(Array.from({ length: 6 }, (_, i) => `Nhóm số ${i + 1}`).sort());
  });

  it("slide chỉ có một phần số mục có ý con hoặc chỉ một ý con vẫn đi theo luật cũ", () => {
    const flat = one(slide({ n: 11, title: "Ý phẳng", paragraphs: [P1("Một ý."), P1("Hai ý."), P1("Ba ý.")] }));
    expect(flat.every((p) => p.layout !== "groups")).toBe(true);
    const mixed = one(slide({ n: 12, title: "Lẫn", paragraphs: [P1("Ý cha"), K("Ý con"), P1("Ý lẻ không con"), P1("Ý lẻ nữa")] }));
    expect(mixed.every((p) => p.layout !== "groups")).toBe(true);
    const single = one(slide({ n: 13, title: "Một con", paragraphs: [P1("Ý cha"), K("Chỉ một ý con")] }));
    expect(single.every((p) => p.layout !== "groups")).toBe(true);
  });

  it("ý cha là vế đầu của câu, hoặc danh sách tài liệu tham khảo, giữ Danh sách", () => {
    const sentence = one(slide({ n: 15, title: "Định hướng", paragraphs: [P1("Bổ sung các yêu cầu cụ thể về"), K("sử dụng AI"), K("đánh giá AI"), K("đạo đức AI")] }));
    expect(sentence.every((p) => p.layout !== "groups")).toBe(true);
    const refs = one(slide({ n: 16, title: "Tài liệu", paragraphs: [P1("The Seed Of Thoughts"), K("References:"), K("[1] Covey, S. R. (1989). The 7 habits."), K("[2] Seligman, M. (2011). Flourish.")] }));
    expect(refs.every((p) => p.layout !== "groups")).toBe(true);
  });

  it("slide có hình giữ luật cũ (Nhóm không có ô hình)", () => {
    const withImg = one(slide({ n: 14, title: "Có hình", imageUrl: "/api/limio-live-media/x.jpg", paragraphs: [P1("A"), K("a1"), P1("B"), K("b1")] }));
    expect(withImg.every((p) => p.layout !== "groups")).toBe(true);
  });

  it("dàn ý của slide Nhóm: mỗi ý là một nhóm 'Tên: ý con; ý con'", () => {
    const src = { slides: [slide({ n: 1, title: "Bìa" }), slide({ n: 2, title: "2.1. TECH", paragraphs: [P1("Bản chất"), K("Ý một"), P1("Đặc trưng"), K("Ý hai"), K("Ý ba")] })] };
    const rows = keepOutline(src, "Bìa").slides;
    expect(rows[1]!.layout).toBe("groups");
    expect(rows[1]!.points).toEqual(["Bản chất: Ý một", "Đặc trưng: Ý hai; Ý ba"]);
    const g = importedSlideFor(rows[1]!, src)!.config as any;
    expect(g.layout).toBe("groups");
    expect(g.groups[1]).toEqual({ heading: "Đặc trưng", points: ["Ý hai", "Ý ba"] });
  });
});
