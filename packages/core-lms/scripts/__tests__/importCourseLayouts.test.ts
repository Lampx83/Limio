import { describe, expect, it } from "vitest";
import { CreateQuestionInput } from "../../src/quizzes/questions";
import { LessonSpec, expandQuestion, lectureAnchorProblems, lessonContentItems, renderSection } from "../import-course";

describe("renderSection — bố cục như Bài học từ tài liệu", () => {
  it("dựng section/lesson-part đúng đánh dấu mà lessonLook.css dùng", () => {
    const html = renderSection({
      layout: "cards",
      title: "Ba loại câu trả lời",
      intro: "Dẫn **ngắn**.",
      parts: [
        { title: "Số liệu", md: "Kiểm con số." },
        { title: "Trích dẫn", md: "> [!meo] Mở nguồn." },
      ],
    });
    expect(html).toMatch(/^<section class="lesson-section" data-layout="cards"><h2>Ba loại câu trả lời<\/h2>/);
    expect(html.match(/<div class="lesson-part">/g)).toHaveLength(2);
    expect(html).toContain("<h3>Số liệu</h3>");
    expect(html).toContain("<strong>ngắn</strong>");
    expect(html).toContain("Mẹo thực hành"); // hộp mẹo vẫn chạy bên trong thẻ
    expect(html.endsWith("</section>")).toBe(true);
  });
});

describe("lessonContentItems", () => {
  const lesson = LessonSpec.parse({
    title: "Bài 1",
    objectives: ["Kiểm được một câu trả lời"],
    look: { palette: "vibrant" },
    sections: [
      { layout: "steps", title: "Thói quen", parts: [{ title: "Hỏi nguồn", md: "x" }] },
      { layout: "cards", title: "Ba loại", parts: [{ title: "Số liệu", md: "y" }] },
    ],
    flashcards: { items: [{ term: "Ảo giác AI", meaning: "Nội dung nghe hợp lý nhưng sai" }] },
    summary: ["Ý 1"],
  });

  it("gắn look cho mọi khối văn bản, mặc định phông modern", () => {
    const rich = lessonContentItems(lesson).filter((i) => i.type === "richtext");
    expect(rich.length).toBeGreaterThan(0);
    for (const r of rich) expect(r.payload.look).toEqual({ palette: "vibrant", font: "modern" });
  });

  it("mọi mục bố cục nằm chung một khối để bảng màu đổi màu theo mục", () => {
    const sectionBlocks = lessonContentItems(lesson).filter((i) => String(i.payload.html ?? "").includes("lesson-section"));
    expect(sectionBlocks).toHaveLength(1);
    expect(String(sectionBlocks[0]!.payload.html).match(/<section class="lesson-section"/g)).toHaveLength(2);
  });

  it("thẻ ghi nhớ đứng ngay trước tổng kết", () => {
    const items = lessonContentItems(lesson);
    expect(items.map((i) => i.type)).toEqual(["richtext", "richtext", "vocab_list", "richtext"]);
    expect(String(items.at(-1)!.payload.html)).toContain("1"); // khối tổng kết
    expect(items[2]!.payload).toMatchObject({ title: "Thẻ ghi nhớ", items: [{ term: "Ảo giác AI" }] });
  });

  it("bảng màu lạ bị từ chối ngay khi đọc file", () => {
    expect(LessonSpec.safeParse({ title: "x", look: { palette: "neon" } }).success).toBe(false);
  });
});

describe("expandQuestion — kéo thả vào chỗ trống", () => {
  it("bung thẻ thành options có blankIndex mà CreateQuestionInput chấp nhận", () => {
    const q = expandQuestion(
      {
        type: "drag_drop_fill",
        prompt: "AI sinh chữ [[1]], không [[2]] sự thật.",
        tokens: [{ label: "nghe hợp lý", blank: 1 }, { label: "tra", blank: 2 }, { label: "luôn đúng" }],
      },
      0,
    );
    const parsed = CreateQuestionInput.parse(q);
    expect(parsed.options?.map((o) => o.extra ?? null)).toEqual([{ blankIndex: 1 }, { blankIndex: 2 }, null]);
  });
});

describe("expandQuestion — ghép cặp", () => {
  it("cột phải lệch thứ tự so với cột trái nhưng vẫn đúng cặp", () => {
    const q = expandQuestion(
      { type: "matching", prompt: "Ghép", pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }, { left: "C", right: "3" }] },
      0,
    );
    const opts = CreateQuestionInput.parse(q).options!;
    const rights = opts.filter((o) => (o.extra as { side: string }).side === "right");
    expect(rights.map((o) => o.label)).toEqual(["2", "3", "1"]);
    const keyOf = (label: string) => (opts.find((o) => o.label === label)!.extra as { pairKey: string }).pairKey;
    expect(keyOf("A")).toBe(keyOf("1"));
    expect(keyOf("C")).toBe(keyOf("3"));
  });
});

describe("lectureAnchorProblems — mốc lời giảng phải khớp mục của bài", () => {
  const base = {
    title: "Bài 1",
    body: "Mở đầu.\n\n## Mục **một**\n\nNội dung.\n",
    sections: [{ layout: "steps", title: "Quy trình", parts: [{ title: "Bước 1", md: "x" }] }],
  };

  it("chấp nhận mo-dau, tong-ket, tiêu đề mục bố cục và tiêu đề ## của thân bài", () => {
    const l = LessonSpec.parse({
      ...base,
      lecture: [
        { anchor: "mo-dau", text: "a" },
        { anchor: "Mục một", text: "b" },
        { anchor: "Quy trình", text: "c" },
        { anchor: "tong-ket", text: "d" },
      ],
    });
    expect(lectureAnchorProblems(l)).toEqual([]);
  });

  it("báo mốc không trùng mục nào, và bài không có lời giảng thì không báo gì", () => {
    const l = LessonSpec.parse({ ...base, lecture: [{ anchor: "Quy trinh", text: "c" }] });
    expect(lectureAnchorProblems(l)).toEqual(['anchor "Quy trinh" không trùng mục nào của bài']);
    expect(lectureAnchorProblems(LessonSpec.parse(base))).toEqual([]);
  });
});
