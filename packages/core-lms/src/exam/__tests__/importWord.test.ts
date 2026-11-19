import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { interpretBlocks, parseExamWord, type Block, type WordImage } from "../importWord";

const FIXTURE = path.join(__dirname, "fixtures", "de-thi-mau.docx");

/** Dựng khối thủ công để thử từng dạng mà không cần file Word. */
const p = (text: string, images: number[] = []): Block => ({
  kind: "p",
  text,
  html: text.replace(/&/g, "&amp;") + images.map((i) => `<img src="embedded:${i}" alt="" />`).join(""),
  images,
});
const h = (level: number, text: string): Block => ({ kind: "h", level, text, html: text, images: [] });
const img = (index: number, contentType = "image/png"): WordImage => ({
  index,
  contentType,
  alt: "",
  data: Buffer.alloc(10),
  ...(contentType === "image/png" ? {} : { error: "ảnh định dạng EMF không được hỗ trợ (chỉ PNG, JPG, WebP, GIF)" }),
});

describe("parseExamWord — file mẫu Bách khoa", () => {
  it("đọc đủ 16 câu, 10 dạng, 1 đoạn văn, 3 ảnh, tổng 20 điểm", async () => {
    const r = await parseExamWord(readFileSync(FIXTURE));
    expect(r.rows).toHaveLength(16);
    expect(r.summary).toEqual({ ok: 16, warning: 0, error: 0, total: 16 });
    const types = new Set(r.rows.map((x) => x.parsed!.type));
    expect(types).toEqual(
      new Set(["mcq", "multi", "true_false_notgiven", "gap_fill", "short_answer", "ordering", "matching", "numerical", "drag_drop_fill", "essay"]),
    );
    expect(r.rows.reduce((s, x) => s + x.parsed!.points, 0)).toBe(20);
    expect(r.images).toHaveLength(3);
    expect(r.passages).toHaveLength(1);
    expect(r.passages[0]!.title).toBe("Một ngày của Minh ở Bách khoa");
    expect(r.passages[0]!.imageIndexes).toHaveLength(1);
    expect(r.passages[0]!.html).toContain("Minh là sinh viên năm thứ nhất");
    expect(r.passages[0]!.html).toContain("embedded:");
    expect(r.notes).toEqual([]);
  });

  it("câu 9–13 thuộc đoạn văn, các câu khác độc lập; phụ lục và khung ghi chú bị bỏ qua", async () => {
    const r = await parseExamWord(readFileSync(FIXTURE));
    const byNo = (n: number) => r.rows.find((x) => x.rowNumber === n)!;
    for (const n of [9, 10, 11, 12, 13]) expect(byNo(n).passageKey).toBe("p1");
    for (const n of [1, 6, 7, 8, 14, 15, 16]) expect(byNo(n).passageKey).toBeNull();
    expect(byNo(10).parsed!.passageTitleRaw).toBe("Một ngày của Minh ở Bách khoa");
  });

  it("cấu hình đúng từng dạng", async () => {
    const r = await parseExamWord(readFileSync(FIXTURE));
    const cfg = (n: number) => r.rows.find((x) => x.rowNumber === n)!.parsed!.config as Record<string, any>;
    expect(cfg(1).options.find((o: any) => o.isCorrect).id).toBe("a");
    expect(cfg(3)).toEqual({ correct: "true" });
    expect(cfg(4).items.map((i: any) => i.label)).toEqual(["Phân tích yêu cầu", "Thiết kế", "Lập trình", "Kiểm thử", "Triển khai"]);
    expect(cfg(5).pairs.map((x: any) => x.right)).toEqual(["Cổng Parabol", "HUST", "Thư viện Tạ Quang Bửu", "Số 1 Đại Cồ Việt, Hà Nội"]);
    expect(cfg(5).pairs[0].left).toContain("biểu tượng");
    expect(cfg(6).blanks).toEqual([{ id: "b1", acceptedAnswers: ["1956"], matchMode: "case_insensitive" }]);
    expect(cfg(8)).toMatchObject({ expected: 0.2, tolerance: 0.01 });
    expect(cfg(10).correct).toBe("true");
    expect(cfg(11).correct).toBe("false");
    expect(cfg(12).correct).toBe("notgiven");
    expect(cfg(13).acceptedAnswers).toEqual(["lập trình", "câu lạc bộ lập trình", "CLB lập trình"]);
    expect(cfg(14).options.filter((o: any) => o.isCorrect).map((o: any) => o.id)).toEqual(["a", "b", "e"]);
    expect(cfg(15).tokens).toEqual([
      { id: "t1", label: "biến", blankIndex: 1 },
      { id: "t2", label: "vòng lặp", blankIndex: 2 },
      { id: "t3", label: "chú thích", blankIndex: null },
    ]);
    expect(cfg(16)).toMatchObject({ minWords: 100 });
    expect(cfg(16).rubric).toContain("nêu rõ tên ngành");
  });

  it("câu có ảnh chuyển thành HTML có thẻ img embedded, kèm mô tả", async () => {
    const r = await parseExamWord(readFileSync(FIXTURE));
    const q7 = r.rows.find((x) => x.rowNumber === 7)!;
    expect(q7.imageIndexes).toHaveLength(1);
    expect(q7.parsed!.prompt).toMatch(/<img src="embedded:\d+" alt="Hình minh hoạ câu 7">/);
    expect(q7.parsed!.prompt).toContain("Cổng hình parabol");
    const q1 = r.rows.find((x) => x.rowNumber === 1)!;
    expect(q1.parsed!.prompt).not.toContain("<"); // câu không ảnh giữ chữ thường
    expect(r.images.every((i) => i.alt.length > 0 && i.contentType === "image/png")).toBe(true);
  });
});

describe("interpretBlocks — từng dạng và lỗi", () => {
  const run = (blocks: Block[], images: WordImage[] = []) => interpretBlocks(blocks, images);

  it("suy ra dạng khi thiếu nhãn và báo cảnh báo", () => {
    const r = run([p("Câu 1. 2 + 2 = ?"), p("A. 3"), p("B. 4"), p("Đáp án: B")]);
    expect(r.rows[0]!.status).toBe("warning");
    expect(r.rows[0]!.parsed!.type).toBe("mcq");
    expect(r.rows[0]!.warnings[0]).toMatch(/đoán/);
  });

  it("danh sách tự đánh số của Word thành phương án A, B, C", () => {
    const r = run([
      p("Câu 1. [Một đáp án] Chọn số chẵn"),
      { kind: "list", ordered: true, items: [{ html: "1", text: "1", images: [] }, { html: "2", text: "2", images: [] }] },
      p("Đáp án: B"),
    ]);
    expect(r.rows[0]!.status).toBe("ok");
    expect((r.rows[0]!.parsed!.config as any).options.map((o: any) => o.label)).toEqual(["1", "2"]);
  });

  it.each([
    ["thiếu Đáp án", [p("Câu 1. [Một đáp án] X"), p("A. a"), p("B. b")], /Thiếu dòng/],
    ["mcq hai đáp án", [p("Câu 1. [Một đáp án] X"), p("A. a"), p("B. b"), p("Đáp án: A, B")], /đúng 1 đáp án/],
    ["chữ đáp án lạ", [p("Câu 1. [Một đáp án] X"), p("A. a"), p("B. b"), p("Đáp án: D")], /không có trong/],
    ["số sai", [p("Câu 1. [Đáp án dạng số] X"), p("Đáp án: nhiều")], /phải là một số/],
    ["sắp xếp thiếu mục", [p("Câu 1. [Sắp xếp thứ tự] X"), p("A. a"), p("B. b"), p("C. c"), p("Đáp án: A → B")], /đủ 3 mục/],
    ["ghép thiếu cặp", [p("Câu 1. [Ghép cặp] X"), p("1. a"), p("2. b"), p("A. x"), p("B. y"), p("Đáp án: 1 – A")], /thiếu cặp cho mục 2/],
    ["kéo thả thiếu thẻ", [p("Câu 1. [Kéo thả từ/câu] [[1]] và [[2]]"), p("Thẻ [1]: a")], /\[\[2\]\] chưa có thẻ/],
    ["nhãn lạ", [p("Câu 1. [Dạng lạ] X"), p("Đáp án: A")], /Nhãn dạng không nhận ra/],
    ["điểm lẻ", [p("Câu 1. (1,5 điểm) [Trả lời ngắn] X"), p("Đáp án: a")], /số nguyên/],
  ] as Array<[string, Block[], RegExp]>)("lỗi: %s", (_name, blocks, re) => {
    const r = run(blocks);
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors.join(" ")).toMatch(re);
    expect(r.rows[0]!.parsed).toBeUndefined();
  });

  it("điền khuyết: số chỗ trống lệch với đáp án chỉ là cảnh báo", () => {
    const r = run([p("Câu 1. [Điền khuyết] Hà Nội là ____ của ____ và ____"), p("Đáp án: thủ đô ; Việt Nam")]);
    expect(r.rows[0]!.status).toBe("warning");
    expect((r.rows[0]!.parsed!.config as any).blanks).toHaveLength(2);
  });

  it("câu có ảnh định dạng không hỗ trợ báo lỗi, không bỏ ảnh âm thầm", () => {
    const r = run([p("Câu 1. [Trả lời ngắn] Hình gì?"), p("", [0]), p("Đáp án: tròn")], [img(0, "image/x-emf")]);
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors.join(" ")).toMatch(/EMF/);
  });

  it("đoạn văn: gom chữ + ảnh, câu sau thuộc đoạn, [HẾT ĐOẠN VĂN] đóng đoạn, tiêu đề cấp 1 cũng đóng", () => {
    const r = run(
      [
        p("[ĐOẠN VĂN] Bài đọc"),
        p("Nội dung."),
        p("", [0]),
        p("Câu 1. [Trả lời ngắn] Q1"),
        p("Đáp án: a"),
        p("[HẾT ĐOẠN VĂN]"),
        p("Câu 2. [Trả lời ngắn] Q2"),
        p("Đáp án: b"),
        p("[ĐOẠN VĂN]"),
        p("Văn bản khác"),
        p("Câu 3. [Trả lời ngắn] Q3"),
        p("Đáp án: c"),
        h(1, "Phần mới"),
        p("Câu 4. [Trả lời ngắn] Q4"),
        p("Đáp án: d"),
      ],
      [img(0)],
    );
    expect(r.passages.map((x) => x.title)).toEqual(["Bài đọc", "Đoạn văn 2"]);
    expect(r.rows.map((x) => x.passageKey)).toEqual(["p1", null, "p2", null]);
    expect(r.passages[0]!.html).toMatch(/<img src="embedded:0" alt="Hình minh hoạ đoạn văn">/);
  });

  it("đoạn không có câu: ghi chú, không lỗi; đoạn ảnh hỏng: các câu của đoạn báo lỗi", () => {
    const a = run([p("[ĐOẠN VĂN] Trống"), p("Chữ")]);
    expect(a.notes.join(" ")).toMatch(/chưa có câu hỏi/);
    const b = run([p("[ĐOẠN VĂN] Hỏng"), p("", [0]), p("Câu 1. [Trả lời ngắn] Q"), p("Đáp án: a")], [img(0, "image/x-emf")]);
    expect(b.rows[0]!.status).toBe("error");
    expect(b.passages[0]!.error).toMatch(/EMF/);
  });

  it("bỏ qua bảng, chữ ngoài câu hỏi; dòng thừa sau đáp án là cảnh báo", () => {
    const r = run([
      p("Ghi chú của người soạn"),
      { kind: "table" },
      p("Câu 1. [Trả lời ngắn] Q"),
      p("Đáp án: a"),
      p("Dòng lạ sau đáp án"),
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.status).toBe("warning");
    expect(r.rows[0]!.warnings[0]).toMatch(/Dòng không nhận ra/);
  });

  it("file không có câu nào → rows rỗng", () => {
    expect(run([p("Chỉ là một đoạn văn bình thường")]).rows).toEqual([]);
  });
});

import { replaceEmbeddedImages, wordHtmlToPassageDoc } from "../importWordDoc";

describe("wordHtmlToPassageDoc", () => {
  const src = (i: number) => (i === 0 ? "/api/exam-assets/a.png" : null);

  it("đổi đoạn, tiêu đề, danh sách, dấu định dạng và ảnh thành Tiptap JSON", () => {
    const doc = wordHtmlToPassageDoc(
      '<h2>Tiêu đề</h2><p>Chữ <strong>đậm</strong> và <em>nghiêng</em><br>dòng mới &amp; hết</p><p><img src="embedded:0" alt="Biểu đồ"></p><ul><li>Một</li><li>Hai</li></ul><ol><li>x</li></ol>',
      src,
    );
    expect(doc.type).toBe("doc");
    const c = doc.content as any[];
    expect(c[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tiêu đề" }] });
    expect(c[1].type).toBe("paragraph");
    expect(c[1].content[1]).toEqual({ type: "text", text: "đậm", marks: [{ type: "bold" }] });
    expect(c[1].content.some((n: any) => n.type === "hardBreak")).toBe(true);
    expect(c[1].content.at(-1).text).toBe("dòng mới & hết");
    expect(c[2]).toEqual({ type: "image", attrs: { src: "/api/exam-assets/a.png", alt: "Biểu đồ" } });
    expect(c[3].type).toBe("bulletList");
    expect(c[3].content).toHaveLength(2);
    expect(c[4].type).toBe("orderedList");
  });

  it("ảnh không có đường dẫn bị bỏ, không để lại nút hỏng", () => {
    const doc = wordHtmlToPassageDoc('<p>A</p><p><img src="embedded:9" alt=""></p>', src);
    expect((doc.content as any[]).map((n) => n.type)).toEqual(["paragraph"]);
  });

  it("replaceEmbeddedImages thay đường dẫn và bỏ ảnh không có nguồn", () => {
    expect(replaceEmbeddedImages('<p><img src="embedded:0" alt="a"></p><p><img src="embedded:5" alt="b"></p>', src)).toBe(
      '<p><img src="/api/exam-assets/a.png" alt="a"></p><p></p>',
    );
  });
});
