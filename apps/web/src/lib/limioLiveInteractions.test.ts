import { describe, expect, it } from "vitest";
import { capWhiteboards, insertInteractions, interactionGap, interactionTarget, topUpSummary } from "./limioLiveInteractions";
import { DURATIONS, isFullStructure, isValidMinutes, outlineWarnings, slideRange, type Outline, type OutlineSlide } from "./limioLiveOutline";
import { suggestMinutes } from "./pptxImport";

/** Ít nhất 5 tương tác ở mọi cách tạo, thêm 90 phút — docs/tieu-chi/tao-bai-giang-mot-o.md (M11–M19, M21). */

let n = 0;
const c = (title: string, extra: Partial<OutlineSlide> = {}): OutlineSlide => ({ id: `s${n++}`, kind: "content", layout: "image", title, points: ["Một ý."], partId: "p1", ...extra });
const q = (kind: OutlineSlide["kind"], title: string): OutlineSlide => ({ id: `s${n++}`, kind, layout: null, title, points: [], partId: "p1" });
const outline = (slides: OutlineSlide[]): Outline => ({ title: "Bài", slides, parts: [{ id: "p1", role: "content", name: "Phần 1" }] });

describe("thời lượng 90 phút (M11, M12)", () => {
  it("90 phút: 42 đến 50 slide, đủ mạch; thời lượng cũ giữ nguyên", () => {
    expect(DURATIONS.map((d) => d.minutes)).toEqual([15, 30, 45, 90]);
    expect(slideRange(90)).toEqual({ min: 42, max: 50 });
    expect(slideRange(15)).toEqual({ min: 9, max: 12 });
    expect(isValidMinutes(90)).toBe(true);
    expect(isValidMinutes(60)).toBe(false);
    expect(isFullStructure(90)).toBe(true);
  });
  it("90 phút chỉ là một lựa chọn: nhập PowerPoint không tự gợi ý 90 phút", () => {
    expect([10, 12, 13, 19, 20, 34, 35, 60].map(suggestMinutes)).toEqual([15, 15, 30, 30, 45, 45, 45, 45]);
  });
});

describe("mức tối thiểu (M14)", () => {
  it("15/30/45 phút: 5 tương tác, 3 loại; 90 phút: 10 tương tác, 4 loại; bảng trắng tối đa 1", () => {
    for (const m of [15, 30, 45]) expect(interactionTarget(m)).toEqual({ min: 5, kinds: 3, whiteboardMax: 1 });
    expect(interactionTarget(90)).toEqual({ min: 10, kinds: 4, whiteboardMax: 1 });
  });
  it("tính phần thiếu theo số slide và số loại", () => {
    const o = outline([c("Bìa", { layout: "cover" }), c("A"), q("quiz", "Hỏi 1?"), c("B"), q("quiz", "Hỏi 2?"), c("C"), q("poll", "Bình chọn?"), c("Kết")]);
    const g = interactionGap(o, 30);
    expect(g.count).toBe(3);
    expect(g.kinds.sort()).toEqual(["poll", "quiz"]);
    expect(g.need).toBe(2);
    // Hai slide thêm phải có ít nhất một loại mới để đủ 3 loại.
    expect(g.needKinds).toBe(1);
  });
  it("đủ số nhưng thiếu loại vẫn phải bổ sung", () => {
    const o = outline([c("Bìa"), ...[1, 2, 3, 4, 5].flatMap((k) => [c(`Ý ${k}`), q("quiz", `Hỏi ${k}?`)]), c("Kết")]);
    const g = interactionGap(o, 30);
    expect(g.count).toBe(5);
    expect(g.need).toBe(2);
    expect(g.needKinds).toBe(2);
  });
  it("đủ cả số và loại thì không cần gì", () => {
    const o = outline([c("Bìa"), c("A"), q("quiz", "1?"), c("B"), q("poll", "2?"), c("C"), q("word_cloud", "3?"), c("D"), q("quiz", "4?"), c("E"), q("poll", "5?"), c("Kết")]);
    expect(interactionGap(o, 15)).toMatchObject({ need: 0, needKinds: 0 });
  });
});

describe("capWhiteboards (M15)", () => {
  it("bảng trắng thứ hai trở đi đổi thành bảng cộng tác", () => {
    const o = capWhiteboards(outline([c("Bìa"), c("A"), q("whiteboard", "Giải bài 1"), c("B"), q("whiteboard", "Giải bài 2"), c("Kết")]));
    expect(o.slides.filter((s) => s.kind === "whiteboard")).toHaveLength(1);
    expect(o.slides.filter((s) => s.kind === "collaborate_board")).toHaveLength(1);
  });
});

describe("insertInteractions (M16, M17)", () => {
  it("chèn sau đúng slide, mang phần của slide đó", () => {
    const base: Outline = {
      title: "Bài",
      slides: [c("Bìa", { layout: "cover", partId: "p0" }), c("A", { partId: "p2" }), c("B", { partId: "p2" }), c("Kết", { layout: "summary", partId: "p3" })],
      parts: [
        { id: "p0", role: "cover", name: "" },
        { id: "p2", role: "content", name: "Khái niệm" },
        { id: "p3", role: "summary", name: "" },
      ],
    };
    const r = insertInteractions(base, [{ afterIndex: 1, kind: "poll", title: "Bạn nghĩ sao?" }]);
    expect(r.added).toBe(1);
    expect(r.outline.slides.map((s) => s.title)).toEqual(["Bìa", "A", "Bạn nghĩ sao?", "B", "Kết"]);
    expect(r.outline.slides[2]).toMatchObject({ kind: "poll", layout: null, points: [], partId: "p2" });
  });
  it("không liền slide tương tác khác, không ở cuối, không ngay sau slide mở phần: dời tới chỗ hợp lệ gần nhất", () => {
    const base = outline([c("Bìa", { layout: "cover" }), c("Phần 1", { layout: "section" }), c("A"), q("quiz", "Có sẵn?"), c("B"), c("C"), c("Kết", { layout: "summary" })]);
    // Sau slide mở phần (1) → dời; sau A (2) thì liền "Có sẵn?" → dời tiếp; sau slide cuối (6) → dời lên.
    const r = insertInteractions(base, [
      { afterIndex: 1, kind: "poll", title: "Mới 1?" },
      { afterIndex: 6, kind: "word_cloud", title: "Mới 2?" },
    ]);
    const kinds = r.outline.slides.map((s) => s.kind);
    for (let i = 1; i < kinds.length; i++) expect(kinds[i] !== "content" && kinds[i - 1] !== "content").toBe(false);
    expect(kinds[kinds.length - 1]).toBe("content");
    expect(r.outline.slides[2]!.title).toBe("A");
    expect(r.added).toBe(2);
  });
  it("không còn chỗ hợp lệ thì bỏ; bỏ loại hay câu hỏi rỗng; chỉ giữ một bảng trắng", () => {
    const base = outline([c("Bìa", { layout: "cover" }), c("A"), c("Kết", { layout: "summary" })]);
    const r = insertInteractions(base, [
      { afterIndex: 1, kind: "quiz", title: "Một?" },
      { afterIndex: 1, kind: "poll", title: "Hai?" },
      { afterIndex: 0, kind: "content" as never, title: "Sai loại" },
      { afterIndex: 0, kind: "quiz", title: "  " },
    ]);
    expect(r.added).toBe(1);
    const wb = insertInteractions(outline([c("Bìa"), c("A"), c("B"), c("C"), c("Kết")]), [
      { afterIndex: 1, kind: "whiteboard", title: "Giải 1" },
      { afterIndex: 3, kind: "whiteboard", title: "Giải 2" },
    ]);
    expect(wb.outline.slides.filter((s) => s.kind === "whiteboard")).toHaveLength(1);
    expect(wb.outline.slides.filter((s) => s.kind === "collaborate_board")).toHaveLength(1);
  });
  it("không chèn sát dòng Nguồn tham khảo hệ thống dựng", () => {
    const base = outline([c("Bìa"), c("A"), c("B"), c("Kết", { layout: "summary" }), c("Nguồn tham khảo", { layout: "summary", fixed: "references" })]);
    const r = insertInteractions(base, [{ afterIndex: 3, kind: "quiz", title: "Hỏi?" }]);
    const i = r.outline.slides.findIndex((s) => s.title === "Hỏi?");
    expect(r.added).toBe(1);
    expect(r.outline.slides[i + 1]!.fixed).toBeUndefined();
  });
});

describe("topUpSummary", () => {
  it("liệt kê từng dòng có chỉ số, loại và tiêu đề", () => {
    const s = topUpSummary(outline([c("Bìa", { layout: "cover" }), q("quiz", "Hỏi?")]));
    expect(s).toEqual([
      { index: 0, kind: "content", layout: "cover", title: "Bìa", part: "Phần 1" },
      { index: 1, kind: "quiz", layout: null, title: "Hỏi?", part: "Phần 1" },
    ]);
  });
});

describe("cảnh báo dưới dàn ý (M19)", () => {
  it("nhắc khi ít hơn mức tối thiểu", () => {
    const o = outline([c("Bìa"), c("A"), q("quiz", "1?"), c("B"), q("poll", "2?"), c("C"), q("word_cloud", "3?"), c("D"), c("E"), c("Kết")]);
    expect(outlineWarnings(o, 15)).toContain("Bài nên có ít nhất 5 slide tương tác (hiện có 3).");
  });
});

describe("cảnh báo đa dạng bố cục (M24)", () => {
  it("nhắc khi quá nửa slide nội dung là Chữ và hình", () => {
    const o = outline([c("Bìa", { layout: "cover" }), c("A"), c("B"), c("C"), c("D", { layout: "cards" }), c("E"), c("Kết", { layout: "summary" })]);
    expect(outlineWarnings(o, 15).some((w) => w.startsWith("Nhiều slide Chữ và hình (4 trên 5 slide nội dung)"))).toBe(true);
  });
  it("không nhắc khi bố cục đã đa dạng", () => {
    const o = outline([c("Bìa", { layout: "cover" }), c("A"), c("B", { layout: "cards" }), c("C", { layout: "steps" }), c("D", { layout: "compare" }), c("Kết", { layout: "summary" })]);
    expect(outlineWarnings(o, 15).some((w) => w.startsWith("Nhiều slide Chữ và hình"))).toBe(false);
  });
});
