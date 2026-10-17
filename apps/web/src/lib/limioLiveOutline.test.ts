import { describe, expect, it } from "vitest";
import {
  INTERACTIVE_EVERY,
  normalizeOutline,
  outlineBlockingProblems,
  outlineStats,
  outlineWarnings,
  sanitizeOutline,
  slideRange,
  stripEmoji,
} from "./limioLiveOutline";

const content = (title: string, layout = "image", points: string[] = ["Một câu hoàn chỉnh."]) => ({ kind: "content", layout, title, points });
const inter = (kind: string, title: string) => ({ kind, layout: null, title, points: [] });

describe("slideRange", () => {
  it("khớp tiêu chí: 15 phút 8-10, 30 phút 14-18, 45 phút 20-25", () => {
    expect(slideRange(15)).toEqual({ min: 8, max: 10 });
    expect(slideRange(30)).toEqual({ min: 14, max: 18 });
    expect(slideRange(45)).toEqual({ min: 20, max: 25 });
  });
  it("giá trị lạ rơi về 30 phút", () => expect(slideRange(7)).toEqual({ min: 14, max: 18 }));
});

describe("stripEmoji", () => {
  it("bỏ emoji, giữ chữ có dấu và dấu câu", () => {
    expect(stripEmoji("Phản hồi 🚀 hiệu quả ✅ trong dạy học!")).toBe("Phản hồi hiệu quả trong dạy học!");
    expect(stripEmoji("Ế ỗ ặ — giữ nguyên.")).toBe("Ế ỗ ặ — giữ nguyên.");
  });
});

describe("sanitizeOutline", () => {
  it("lọc trường lạ, kind/layout sai về mặc định, bỏ slide rỗng, giữ id", () => {
    const o = sanitizeOutline({
      title: " Bài ✨ giảng ",
      slides: [
        { id: "a", kind: "content", layout: "cards", title: "Ba ý", points: ["x", "", "y"], evil: 1 },
        { kind: "lạ", layout: "không có", title: "Mặc định", points: ["p"] },
        { kind: "content", layout: "image", title: "", points: [] },
        { kind: "quiz", layout: "cards", title: "Câu hỏi?", points: ["bỏ"] },
        null,
      ],
    });
    expect(o.title).toBe("Bài giảng");
    expect(o.slides).toHaveLength(3);
    expect(o.slides[0]).toMatchObject({ id: "a", layout: "cards", points: ["x", "y"] });
    expect(o.slides[1]).toMatchObject({ kind: "content", layout: "image" });
    expect(o.slides[2]).toMatchObject({ kind: "quiz", layout: null, points: [] });
    expect(o.slides[0]).not.toHaveProperty("evil");
  });
  it("id trùng được cấp id mới", () => {
    const o = sanitizeOutline({ slides: [{ id: "x", title: "a" }, { id: "x", title: "b" }] });
    expect(new Set(o.slides.map((s) => s.id)).size).toBe(2);
  });
  it("dữ liệu không phải đối tượng cho dàn ý rỗng", () => {
    expect(sanitizeOutline(null)).toEqual({ title: "", slides: [] });
    expect(sanitizeOutline("x")).toEqual({ title: "", slides: [] });
  });
});

describe("normalizeOutline", () => {
  const nine = [
    content("Bìa", "image"),
    content("Mục 1", "section"),
    content("A"),
    content("B"),
    content("C"),
    inter("quiz", "Câu nào đúng?"),
    content("D"),
    content("E"),
    content("Tóm", "image"),
  ];

  it("ép slide đầu là bìa và slide nội dung cuối là tóm tắt", () => {
    const { outline } = normalizeOutline({ title: "T", slides: nine }, 15);
    expect(outline.slides[0]!.layout).toBe("cover");
    expect(outline.slides[outline.slides.length - 1]!.layout).toBe("summary");
  });

  it("quá nhiều slide: giữ phần đầu và slide cuối, kèm cảnh báo", () => {
    const many = [...Array.from({ length: 14 }, (_, i) => content(`Ý ${i}`)), content("Kết", "summary")];
    const { outline, warnings } = normalizeOutline({ title: "T", slides: many }, 15);
    expect(outline.slides).toHaveLength(10);
    expect(outline.slides[9]!.title).toBe("Kết");
    expect(warnings.some((w) => w.includes("đã giữ 10"))).toBe(true);
  });

  it("ít slide hơn mức gợi ý: chỉ cảnh báo, không chặn", () => {
    const { outline, warnings } = normalizeOutline({ title: "T", slides: nine.slice(0, 4) }, 45);
    expect(outline.slides).toHaveLength(4);
    expect(warnings.join(" ")).toContain("ít hơn mức gợi ý 20 đến 25");
  });

  it("đầu vào hỏng không làm hỏng chương trình", () => {
    expect(normalizeOutline(undefined, 30).outline.slides).toEqual([]);
    expect(normalizeOutline({ slides: "x" }, 30).outline.slides).toEqual([]);
  });
});

describe("outlineWarnings / outlineStats / outlineBlockingProblems", () => {
  it("đếm slide nội dung và tương tác", () => {
    const o = sanitizeOutline({ slides: [content("a"), inter("poll", "q?"), inter("word_cloud", "w?")] });
    expect(outlineStats(o)).toEqual({ total: 3, content: 1, interactive: 2 });
  });
  it("nhắc hai slide tương tác liền nhau và slide cuối là tương tác", () => {
    const o = sanitizeOutline({ slides: [content("a"), inter("quiz", "q?"), inter("poll", "p?")] });
    const w = outlineWarnings(o, 15).join(" ");
    expect(w).toContain("liền nhau");
    expect(w).toContain("Slide cuối");
  });
  it("chặn khi dàn ý rỗng hoặc slide thiếu tiêu đề", () => {
    expect(outlineBlockingProblems({ title: "", slides: [] })).toHaveLength(1);
    const o = { title: "", slides: [{ id: "1", kind: "quiz" as const, layout: null, title: "", points: [] }] };
    expect(outlineBlockingProblems(o)[0]).toContain("câu hỏi");
  });
  it("hằng số xen tương tác khớp tiêu chí (3 đến 4)", () => {
    expect(INTERACTIVE_EVERY).toBeGreaterThanOrEqual(3);
    expect(INTERACTIVE_EVERY).toBeLessThanOrEqual(4);
  });
});
