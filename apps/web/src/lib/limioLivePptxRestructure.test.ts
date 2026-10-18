import { describe, expect, it } from "vitest";
import {
  appendBack,
  coverage,
  firstSplitRows,
  importedSlideFor,
  notesPlan,
  originsFromAi,
  restructureOutline,
  rowsUsingSlide,
  withOriginalNotes,
  type ImportedSlide,
} from "./limioLivePptx";
import { originLabel, sanitizeOutline } from "./limioLiveOutline";

/** Cách "Soạn lại mạch" và màn đối chiếu (tiêu chí P24–P31, docs/tieu-chi/nhap-powerpoint.md). */

const P = (text: string, level = 0) => ({ text, level, numbered: false });
const slide = (n: number, title: string, o: Partial<ImportedSlide> = {}): ImportedSlide => ({
  n,
  hidden: false,
  layoutType: "obj",
  title,
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
const src = {
  slides: [
    slide(1, "Phản hồi trong dạy học", { subtitle: ["Buổi 5"] }),
    slide(2, "Phản hồi là gì?", { paragraphs: [P("Thông tin về khoảng cách.")], notes: "Ghi chú hai." }),
    slide(3, "Đích đến", { paragraphs: [P("Mục tiêu bài học.")], notes: "Ghi chú ba." }),
    slide(4, "Hiện trạng", { paragraphs: [P("So với tiêu chí.")], notes: "Ghi chú bốn.", imageUrl: "/api/limio-live-media/u-4.jpg" }),
    slide(5, "Nhiều ý", { paragraphs: [P("Ý một dài."), P("Ý hai dài."), P("Ý ba dài."), P("Ý bốn dài.")], notes: "Ghi chú năm." }),
    slide(6, "Cảm ơn"),
  ],
};

/** Đầu ra giả của mô hình (LLM giả). */
const RAW = {
  title: "Phản hồi trong dạy học",
  slides: [
    { role: "cover", section: null, kind: "content", layout: "cover", title: "Phản hồi trong dạy học", points: ["Buổi 5"], from: [1], basis: [] },
    { role: "objectives", section: null, kind: "content", layout: "summary", title: "Mục tiêu của buổi học", points: ["Người học giải thích được phản hồi."], from: [], basis: [2] },
    { role: "content", section: "Phản hồi là gì", kind: "content", layout: "image", title: "Tên AI đặt lại", points: ["AI viết lại."], from: [2], basis: [] },
    { role: "content", section: "Phản hồi là gì", kind: "content", layout: "steps", title: "Hai câu hỏi", points: ["Đích đến: mục tiêu.", "Hiện trạng: so tiêu chí."], from: [3, 4], basis: [] },
    { role: "content", section: "Phản hồi là gì", kind: "quiz", layout: null, title: "Câu nào nói về đích đến?", points: [], from: [3], basis: [4, 99] },
    { role: "content", section: "Phản hồi là gì", kind: "content", layout: "image", title: "Nhiều ý (1)", points: ["Ý một dài.", "Ý hai dài."], from: [5], basis: [] },
    { role: "summary", section: null, kind: "content", layout: "summary", title: "Tổng kết", points: ["Ý ba dài.", "Ý bốn dài."], from: [5], basis: [] },
  ],
};

describe("originsFromAi (P25)", () => {
  it("một slide → same, nhiều slide → merge, cùng slide ở nhiều dòng → split, không có → new; bỏ số ngoài khoảng", () => {
    const out = originsFromAi(RAW, 6) as { slides: Array<{ origin: unknown; from?: unknown }> };
    expect(out.slides.map((s) => s.origin)).toEqual([
      { slides: [1], how: "same" },
      { slides: [2], how: "new" },
      { slides: [2], how: "same" },
      { slides: [3, 4], how: "merge" },
      { slides: [3, 4], how: "new" },
      { slides: [5], how: "split" },
      { slides: [5], how: "split" },
    ]);
    expect(out.slides[0]!.from).toBeUndefined();
  });
});

describe("restructureOutline (P24–P26)", () => {
  const { outline } = restructureOutline(RAW, src, 30);
  it("dòng same dựng nguyên từ slide gốc (tiêu đề và chữ gốc, không để AI đặt lại)", () => {
    const row = outline.slides.find((s) => s.origin?.how === "same" && s.origin.slides[0] === 2)!;
    expect(row.title).toBe("Phản hồi là gì?");
    expect(row.points).toEqual(["Thông tin về khoảng cách."]);
    expect(importedSlideFor(row, src)!.config).toMatchObject({ bullets: ["Thông tin về khoảng cách."], presenterNote: "Ghi chú hai." });
  });
  it("nhãn nguồn như bản mẫu", () => {
    expect(outline.slides.map((s) => originLabel(s.origin))).toEqual(
      expect.arrayContaining(["từ slide 1", "mới, dựa trên slide 2", "gộp slide 3 và 4", "mới, dựa trên slide 3 và 4", "tách từ slide 5"]),
    );
  });
  it("lưu dàn ý giữ nguyên nguồn", () => {
    const saved = sanitizeOutline(JSON.parse(JSON.stringify(outline)));
    expect(saved.slides.map((s) => s.origin)).toEqual(outline.slides.map((s) => s.origin));
  });
});

describe("withOriginalNotes (P26)", () => {
  const gen = { type: "content" as const, config: { layout: "image", title: "Hai câu hỏi", bullets: ["a"], presenterNote: "AI viết.", outlineId: "x", aiGenerated: true }, usedFallback: false };
  it("gộp: ghi chú gốc nối theo thứ tự, AI không viết lại; nhận hình của slide gốc", () => {
    const row = { id: "r", kind: "content" as const, layout: "image" as const, title: "t", points: [], origin: { slides: [4, 3], how: "merge" as const } };
    expect(withOriginalNotes(gen, row, src).config).toMatchObject({ presenterNote: "Ghi chú ba.\n\nGhi chú bốn.", imageUrl: "/api/limio-live-media/u-4.jpg", imageFit: "contain" });
  });
  it("tách: ghi chú gốc chỉ ở dòng đầu; dòng mới giữ ghi chú AI", () => {
    const rows = [
      { id: "a", kind: "content" as const, layout: "image" as const, title: "t", points: [], origin: { slides: [5], how: "split" as const } },
      { id: "b", kind: "content" as const, layout: "image" as const, title: "t", points: [], origin: { slides: [5], how: "split" as const } },
    ];
    const first = firstSplitRows(rows);
    expect([...first]).toEqual(["a"]);
    expect(withOriginalNotes(gen, rows[0]!, src, first.has("a")).config.presenterNote).toBe("Ghi chú năm.");
    expect(withOriginalNotes(gen, rows[1]!, src, first.has("b")).config.presenterNote).toBe("AI viết.");
    const fresh = { id: "c", kind: "content" as const, layout: "image" as const, title: "t", points: [], origin: { slides: [], how: "new" as const } };
    expect(withOriginalNotes(gen, fresh, src)).toBe(gen);
  });
});

describe("màn đối chiếu (P28–P30)", () => {
  const { outline } = restructureOutline(RAW, src, 30);
  it("độ phủ: slide 6 (Cảm ơn) chưa dùng; 'dựa trên' không tính là đã dùng", () => {
    const c = coverage(outline, 6);
    expect([...c.used].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(c.unused).toEqual([6]);
    expect(rowsUsingSlide(outline, 4).length).toBe(2);
  });
  it("Thêm lại: slide gốc vào cuối phần cuối, nguồn back, dựng không AI", () => {
    const next = appendBack(outline, src, 6);
    const last = next.slides[next.slides.length - 1]!;
    expect(last.origin).toMatchObject({ slides: [6], how: "back" });
    expect(originLabel(last.origin)).toBe("thêm lại từ slide 6");
    expect(last.partId).toBe(next.parts[next.parts.length - 1]!.id);
    expect(coverage(next, 6).unused).toEqual([]);
    expect(importedSlideFor(last, src)!.config).toMatchObject({ layout: "cover", title: "Cảm ơn" });
  });
  it("kế hoạch ghi chú: giữ, nối, AI viết, để trống", () => {
    const row = (origin: object) => ({ id: "x", kind: "content" as const, layout: "image" as const, title: "", points: [], origin: origin as never });
    expect(notesPlan(row({ slides: [2], how: "same" }), src)).toBe("kept");
    expect(notesPlan(row({ slides: [3, 4], how: "merge" }), src)).toBe("joined");
    expect(notesPlan(row({ slides: [], how: "new" }), src)).toBe("ai");
    expect(notesPlan(row({ slides: [6], how: "same" }), src)).toBe("empty");
  });
});
