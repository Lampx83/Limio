import { describe, expect, it } from "vitest";
import { REVISION_MAX_CHARS } from "@feedbackme/core-feedback";
import type { Outline, OutlineSlide } from "./limioLiveOutline";
import {
  REVISE_MAX_CHARS,
  REVISE_MIN_CHARS,
  REVISE_SUGGESTIONS,
  appendSuggestion,
  canRevise,
  carryOutlineIds,
  checkInstruction,
  estimateReviseTokens,
  reviseRange,
  shortInstruction,
  toRevisionInput,
} from "./limioLiveOutlineRevise";

/** Chỉnh dàn ý bằng AI — docs/tieu-chi/dan-y-chinh-bang-ai.md (R1–R7, R10). */

const slide = (o: Partial<OutlineSlide> & { id: string }): OutlineSlide =>
  ({ partId: "p1", kind: "content", layout: "image", title: "T", points: [], ...o }) as OutlineSlide;

const outline: Outline = {
  title: "Phản hồi",
  slides: [
    slide({ id: "a", partId: "c", layout: "cover", title: "Phản hồi", points: ["Một câu giá trị."] }),
    slide({ id: "b", partId: "n1", layout: "section", title: "Khái niệm", points: ["Phần này trả lời phản hồi là gì."] }),
    slide({ id: "c", partId: "n1", title: "Phản hồi là gì", points: ["Chỉ ra khoảng cách."] }),
    slide({ id: "d", partId: "n1", kind: "poll", layout: null, title: "Thầy/cô từng nhận phản hồi nào?", points: [] }),
  ],
  parts: [
    { id: "c", role: "cover", name: "" },
    { id: "n1", role: "content", name: "Khái niệm" },
  ],
} as Outline;

describe("kiểm tra lời dặn (R3)", () => {
  it("cắt khoảng trắng; dưới 5 ký tự là quá ngắn, trên 1.000 là quá dài", () => {
    expect(checkInstruction("   ")).toEqual({ ok: false, reason: "too_short" });
    expect(checkInstruction("ngắn")).toEqual({ ok: false, reason: "too_short" });
    expect(checkInstruction("  Rút ngắn lại  ")).toEqual({ ok: true, text: "Rút ngắn lại" });
    expect(checkInstruction("a".repeat(REVISE_MAX_CHARS))).toMatchObject({ ok: true });
    expect(checkInstruction("a".repeat(REVISE_MAX_CHARS + 1))).toEqual({ ok: false, reason: "too_long" });
  });
  it("giới hạn khớp với phía AI", () => {
    expect(REVISE_MAX_CHARS).toBe(REVISION_MAX_CHARS);
    expect(REVISE_MIN_CHARS).toBe(5);
  });
});

describe("gợi ý bấm nhanh (R2)", () => {
  it("có đúng 4 gợi ý, đều qua được kiểm tra lời dặn", () => {
    expect(REVISE_SUGGESTIONS).toHaveLength(4);
    for (const s of REVISE_SUGGESTIONS) expect(checkInstruction(s).ok).toBe(true);
  });
  it("ô trống thì điền gợi ý; ô có chữ thì nối thêm; đã có rồi thì giữ nguyên", () => {
    expect(appendSuggestion("", "Rút ngắn lại")).toBe("Rút ngắn lại");
    expect(appendSuggestion("  ", "Rút ngắn lại")).toBe("Rút ngắn lại");
    expect(appendSuggestion("Dạy cho sinh viên năm nhất", "Rút ngắn lại")).toBe("Dạy cho sinh viên năm nhất. Rút ngắn lại");
    expect(appendSuggestion("Dạy cho sinh viên năm nhất.", "Rút ngắn lại")).toBe("Dạy cho sinh viên năm nhất. Rút ngắn lại");
    expect(appendSuggestion("Rút ngắn lại. Thêm ví dụ", "Rút ngắn lại")).toBe("Rút ngắn lại. Thêm ví dụ");
  });
});

describe("điều kiện hiện hộp (R1)", () => {
  it("hiện cho bài AI soạn có văn bản nguồn", () => {
    expect(canRevise({ importedRows: 0, sourceChars: 500 })).toBe(true);
  });
  it("ẩn khi có slide lấy nguyên từ file gốc hoặc không còn văn bản nguồn", () => {
    expect(canRevise({ importedRows: 3, sourceChars: 500 })).toBe(false);
    expect(canRevise({ importedRows: 0, sourceChars: 0 })).toBe(false);
  });
});

describe("khoảng slide khi chỉnh (R5)", () => {
  it("tối đa theo thời lượng, tối thiểu 6 để làm được lời dặn 'rút ngắn'", () => {
    expect(reviseRange(30)).toEqual({ min: 6, max: 20 });
    expect(reviseRange(90)).toEqual({ min: 6, max: 50 });
    expect(reviseRange(15)).toEqual({ min: 6, max: 12 });
  });
});

describe("dàn ý gửi AI (R4)", () => {
  it("mỗi slide mang vai trò và tên phần của phần chứa nó; slide tương tác không có ý", () => {
    const r = toRevisionInput(outline);
    expect(r.title).toBe("Phản hồi");
    expect(r.slides).toHaveLength(4);
    expect(r.slides[0]).toMatchObject({ role: "cover", section: null, kind: "content", layout: "cover" });
    expect(r.slides[1]).toMatchObject({ role: "content", section: "Khái niệm", layout: "section" });
    expect(r.slides[3]).toMatchObject({ role: "content", section: "Khái niệm", kind: "poll", layout: null, points: [] });
  });
  it("bỏ dòng Nguồn tham khảo do hệ thống dựng", () => {
    const withRefs = { ...outline, slides: [...outline.slides, slide({ id: "r", partId: "n1", layout: "summary", title: "Nguồn tham khảo", points: ["[1] Trang A"], fixed: "references" })] } as Outline;
    expect(toRevisionInput(withRefs).slides).toHaveLength(4);
  });
  it("không lộ id nội bộ", () => {
    expect(JSON.stringify(toRevisionInput(outline))).not.toContain('"id"');
  });
});

describe("giữ định danh slide (R6)", () => {
  const next = (slides: Array<Partial<OutlineSlide> & { id: string }>): Outline => ({ title: "Phản hồi", slides: slides.map(slide), parts: outline.parts }) as Outline;

  it("slide giống hệt giữ id cũ", () => {
    const out = carryOutlineIds(outline, next(outline.slides.map((s, i) => ({ ...s, id: `new${i}` }))));
    expect(out.slides.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("cùng loại và tiêu đề nhưng đổi ý vẫn giữ id (để cập nhật chứ không xoá-tạo lại)", () => {
    const out = carryOutlineIds(outline, next([{ ...outline.slides[2]!, id: "x", points: ["Ý đã viết lại hoàn toàn."] }]));
    expect(out.slides[0]!.id).toBe("c");
  });
  it("slide mới hoàn toàn giữ id mới; mỗi id cũ chỉ dùng một lần", () => {
    const dup = { ...outline.slides[2]!, id: "x1" };
    const out = carryOutlineIds(outline, next([dup, { ...dup, id: "x2" }, { ...dup, id: "x3", title: "Ví dụ thực tế về phản hồi", points: ["Một ví dụ."] }]));
    expect(out.slides[0]!.id).toBe("c");
    expect(out.slides[1]!.id).toBe("x2");
    expect(out.slides[2]!.id).toBe("x3");
  });
  it("ưu tiên trùng cả ý khi có nhiều slide cùng tiêu đề", () => {
    const prev = { ...outline, slides: [slide({ id: "p", title: "Ví dụ", points: ["Một."] }), slide({ id: "q", title: "Ví dụ", points: ["Hai."] })] } as Outline;
    const out = carryOutlineIds(prev, next([{ id: "n1", title: "Ví dụ", points: ["Hai."] }, { id: "n2", title: "Ví dụ", points: ["Một."] }]));
    expect(out.slides.map((s) => s.id)).toEqual(["q", "p"]);
  });
  it("loại slide khác thì không giữ id dù tiêu đề trùng", () => {
    const out = carryOutlineIds(outline, next([{ id: "z", kind: "quiz", layout: null, title: "Phản hồi là gì", points: [] }]));
    expect(out.slides[0]!.id).toBe("z");
  });
  it("dòng Nguồn tham khảo dựng lại vẫn giữ id cũ, kể cả khi chữ khác", () => {
    const prev = { ...outline, slides: [...outline.slides, slide({ id: "r", layout: "summary", title: "Nguồn tham khảo", points: ["[1] A"], fixed: "references" })] } as Outline;
    const out = carryOutlineIds(prev, next([{ id: "z", layout: "summary", title: "Tài liệu tham khảo", points: ["[1] A", "[2] B"], fixed: "references" }]));
    expect(out.slides[0]!.id).toBe("r");
  });
  it("không đổi phần còn lại của dàn ý", () => {
    const out = carryOutlineIds(outline, next([{ id: "z", title: "Khác" }]));
    expect(out.title).toBe("Phản hồi");
    expect(out.parts).toBe(outline.parts);
  });
});

describe("ước tính token (R10)", () => {
  it("tăng theo độ dài nguồn và số slide, nguồn tính tối đa 24.000 ký tự", () => {
    const a = estimateReviseTokens({ sourceChars: 2_000, slideCount: 10 });
    const b = estimateReviseTokens({ sourceChars: 20_000, slideCount: 10 });
    const c = estimateReviseTokens({ sourceChars: 20_000, slideCount: 20 });
    expect(a.total).toBeGreaterThan(0);
    expect(b.total).toBeGreaterThan(a.total);
    expect(c.total).toBeGreaterThan(b.total);
    expect(estimateReviseTokens({ sourceChars: 500_000, slideCount: 10 }).total).toBe(estimateReviseTokens({ sourceChars: 24_000, slideCount: 10 }).total);
  });
});

describe("rút gọn lời dặn cho thanh hoàn tác (R7)", () => {
  it("một dòng, cắt ở 60 ký tự kèm dấu ba chấm", () => {
    expect(shortInstruction("Rút ngắn\nlại")).toBe("Rút ngắn lại");
    const s = shortInstruction("a".repeat(100));
    expect(s.length).toBeLessThanOrEqual(61);
    expect(s.endsWith("…")).toBe(true);
  });
});
