import { describe, expect, it } from "vitest";
import type { Outline, OutlineSlide } from "./limioLiveOutline";
import { isDarkTheme } from "@/app/instructor/limio-live/slideThemes";
import { cardPoints, generationTiles, nextThemeSuggestion, outlineStory, shouldAutoOpen } from "./limioLiveOutlineCard";

const slide = (o: Partial<OutlineSlide> & { id: string }): OutlineSlide =>
  ({ partId: "p1", kind: "content", layout: "list", title: "T", points: [], ...o }) as OutlineSlide;

describe("cardPoints (O1)", () => {
  it("hiện tối đa 4 ý, phần còn lại thành 'và n ý nữa'", () => {
    expect(cardPoints(slide({ id: "a", points: ["1", "2", "3"] }))).toEqual({ shown: ["1", "2", "3"], more: 0 });
    expect(cardPoints(slide({ id: "a", points: ["1", "2", "3", "4", "5"] }))).toEqual({ shown: ["1", "2", "3", "4"], more: 1 });
  });
  it("bỏ ý trống; slide tương tác không có ý", () => {
    expect(cardPoints(slide({ id: "a", points: ["", "x", "  "] })).shown).toEqual(["x"]);
    expect(cardPoints(slide({ id: "a", kind: "quiz", points: ["x"] }))).toEqual({ shown: [], more: 0 });
  });
});

describe("outlineStory (O4)", () => {
  const outline: Outline = {
    title: "Bài",
    slides: [slide({ id: "1", partId: "c" }), slide({ id: "2", partId: "n1" }), slide({ id: "3", partId: "n1", kind: "quiz" }), slide({ id: "4", partId: "n2" })],
    parts: [
      { id: "c", role: "cover", name: "" },
      { id: "n1", role: "content", name: "Khái niệm" },
      { id: "n2", role: "content", name: "Thái độ" },
    ],
  };
  it("nói các phần nội dung theo thứ tự và số slide tương tác", () => {
    expect(outlineStory(outline, { imported: 0 })).toBe("Bài gồm 2 phần: Khái niệm, Thái độ. Có 1 slide tương tác.");
  });
  it("bài nhập từ PowerPoint nói giữ thứ tự slide gốc", () => {
    expect(outlineStory(outline, { imported: 3 })).toBe("Giữ đúng thứ tự 3 slide gốc. Bài gồm 2 phần: Khái niệm, Thái độ. Có 1 slide tương tác.");
  });
  it("không có phần nội dung thì chỉ nói số slide", () => {
    expect(outlineStory({ title: "x", slides: [slide({ id: "1", partId: "c" })], parts: [{ id: "c", role: "cover", name: "" }] }, { imported: 0 })).toBe("Bài có 1 slide.");
  });
});

describe("nextThemeSuggestion (O3)", () => {
  it("lấy giao diện sáng kế tiếp chưa xem, không lặp giao diện hiện tại", () => {
    const a = nextThemeSuggestion("brand", []);
    expect(a).not.toBe("brand");
    const b = nextThemeSuggestion(a, ["brand"]);
    expect([a, "brand"]).not.toContain(b);
  });
  it("không bao giờ gợi ý giao diện nền tối", () => {
    let cur = "brand";
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const n = nextThemeSuggestion(cur, seen);
      expect(isDarkTheme(n)).toBe(false);
      seen.push(cur);
      cur = n;
    }
  });
  it("hết giao diện chưa xem thì vòng lại, vẫn khác giao diện hiện tại", () => {
    const all = Array.from({ length: 30 }, (_, i) => `x${i}`);
    expect(nextThemeSuggestion("brand", all)).not.toBe("brand");
  });
});

describe("generationTiles (O6): ô sáng dần từ slide 1, theo số lượng đã xong", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("k slide đã xong thì k ô đầu là done, tối đa 2 ô kế là now, còn lại wait", () => {
    expect(generationTiles(ids, 0, null)).toEqual(["now", "now", "wait", "wait", "wait"]);
    expect(generationTiles(ids, 2, null)).toEqual(["done", "done", "now", "now", "wait"]);
    expect(generationTiles(ids, 4, null)).toEqual(["done", "done", "done", "done", "now"]);
  });
  it("xong hết thì không còn now", () => {
    expect(generationTiles(ids, 5, null)).toEqual(["done", "done", "done", "done", "done"]);
    expect(generationTiles(ids, 9, null)).toEqual(["done", "done", "done", "done", "done"]);
  });
  it("cập nhật một phần: slide không nằm trong danh sách sẽ viết luôn là done, đếm trên các slide được viết", () => {
    const w = new Set(["b", "d", "e"]);
    expect(generationTiles(ids, 0, w)).toEqual(["done", "now", "done", "now", "wait"]);
    expect(generationTiles(ids, 1, w)).toEqual(["done", "done", "done", "now", "now"]);
    expect(generationTiles(ids, 3, w)).toEqual(["done", "done", "done", "done", "done"]);
  });
  it("kết quả luôn đơn điệu: thêm slide xong không làm ô nào lùi lại", () => {
    const rank = { done: 2, now: 1, wait: 0 } as const;
    let prev = generationTiles(ids, 0, null).map((t) => rank[t]);
    for (let k = 1; k <= 5; k++) {
      const cur = generationTiles(ids, k, null).map((t) => rank[t]);
      cur.forEach((r, i) => expect(r).toBeGreaterThanOrEqual(prev[i]!));
      prev = cur;
    }
  });
});

describe("shouldAutoOpen (O7)", () => {
  it("tạo xong không có slide dựng thẳng từ dàn ý thì tự mở bài giảng", () => {
    expect(shouldAutoOpen({ fallbackCount: 0 })).toBe(true);
  });
  it("có slide AI chưa viết được thì ở lại để thầy/cô đọc cảnh báo", () => {
    expect(shouldAutoOpen({ fallbackCount: 2 })).toBe(false);
  });
});
