import { describe, expect, it } from "vitest";
import { fixNamedInteractions, interactiveFromTitle, normalizeOutline, sanitizeOutline, type OutlineSlide } from "./limioLiveOutline";

/**
 * AI đôi khi trả dòng dàn ý loại "content" nhưng ghi tên hoạt động vào đầu tiêu đề ("Quiz: …", "Word Cloud: …"), khiến slide
 * tương tác thành slide Chữ và hình (người dùng báo 2026-10-19). Dòng như vậy được đổi về đúng loại tương tác.
 */

describe("interactiveFromTitle", () => {
  it("nhận tên loại tiếng Anh và tiếng Việt, bỏ tiền tố", () => {
    expect(interactiveFromTitle("Quiz: Nếu bạn muốn người dùng nhấn vào nút 'Đăng ký'?")).toEqual({ kind: "quiz", title: "Nếu bạn muốn người dùng nhấn vào nút 'Đăng ký'?" });
    expect(interactiveFromTitle("Word Cloud: Hãy liệt kê nhanh các yếu tố?")).toEqual({ kind: "word_cloud", title: "Hãy liệt kê nhanh các yếu tố?" });
    expect(interactiveFromTitle("Collaborate Board: Hãy dán một ví dụ.")).toMatchObject({ kind: "collaborate_board" });
    expect(interactiveFromTitle("Draw It: Hãy vẽ sơ đồ phân cấp.")).toMatchObject({ kind: "draw_it", title: "Hãy vẽ sơ đồ phân cấp." });
    expect(interactiveFromTitle("Whiteboard - Cùng giải bài toán")).toMatchObject({ kind: "whiteboard", title: "Cùng giải bài toán" });
    expect(interactiveFromTitle("Bình chọn: Bạn thích cách nào?")).toMatchObject({ kind: "poll" });
    expect(interactiveFromTitle("Trắc nghiệm: Đâu là đáp án đúng?")).toMatchObject({ kind: "quiz" });
    expect(interactiveFromTitle("Đám mây từ: Một từ mô tả AR?")).toMatchObject({ kind: "word_cloud" });
    expect(interactiveFromTitle("word_cloud: Một từ?")).toMatchObject({ kind: "word_cloud" });
    expect(interactiveFromTitle("Poll: A hay B?")).toMatchObject({ kind: "poll" });
  });
  it("tiêu đề thường không đổi", () => {
    expect(interactiveFromTitle("Quiz trong lớp học hiện đại")).toBeNull();
    expect(interactiveFromTitle("Phân cấp thị giác: khái niệm")).toBeNull();
    expect(interactiveFromTitle("Quiz:")).toBeNull();
  });
});

const row = (id: string, kind: OutlineSlide["kind"], title: string, partId = "p1"): OutlineSlide => ({
  id,
  partId,
  kind,
  layout: kind === "content" ? "image" : null,
  title,
  points: kind === "content" ? ["Một ý."] : [],
});

describe("fixNamedInteractions", () => {
  it("bỏ slide giới thiệu thừa khi ngay sau đã có slide tương tác thật cùng loại (như bài trên limio.vn)", () => {
    const out = fixNamedInteractions([
      row("a", "content", "Phân cấp là gì"),
      row("b", "content", "Quiz: Nếu bạn muốn người dùng nhấn nút Đăng ký?"),
      row("c", "quiz", "Để tạo sự khác biệt, bạn đổi thuộc tính nào?"),
      row("d", "content", "Word Cloud: Hãy liệt kê nhanh các yếu tố?"),
      row("e", "content", "Hiệu ứng Von Restorff"),
      row("f", "word_cloud", "Hãy liệt kê nhanh các yếu tố thường thiếu?"),
    ]);
    expect(out.map((s) => s.id)).toEqual(["a", "c", "e", "f"]);
  });
  it("không có slide thật đi kèm (hoặc khác phần, khác loại) thì đổi chính dòng đó thành slide tương tác", () => {
    const out = fixNamedInteractions([
      row("a", "content", "Draw It: Hãy vẽ sơ đồ phân cấp."),
      row("b", "content", "Nội dung"),
      row("c", "content", "Quiz: Câu hỏi?"),
      row("d", "quiz", "Câu hỏi ở phần khác?", "p2"),
      row("e", "content", "Bình chọn: A hay B?"),
      row("f", "quiz", "Khác loại?"),
    ]);
    expect(out.map((s) => [s.id, s.kind, s.title])).toEqual([
      ["a", "draw_it", "Hãy vẽ sơ đồ phân cấp."],
      ["b", "content", "Nội dung"],
      ["c", "quiz", "Câu hỏi?"],
      ["d", "quiz", "Câu hỏi ở phần khác?"],
      ["e", "poll", "A hay B?"],
      ["f", "quiz", "Khác loại?"],
    ]);
    expect(out[0]).toMatchObject({ layout: null, points: [] });
  });
  it("chỉ chạy với dàn ý AI vừa soạn: bài đã có (sanitizeOutline) giữ nguyên", () => {
    const o = sanitizeOutline({ title: "Bài", slides: [row("a", "content", "Quiz: Câu hỏi?"), row("b", "content", "Kết")] });
    expect(o.slides[0]).toMatchObject({ kind: "content", title: "Quiz: Câu hỏi?" });
  });
  it("normalizeOutline áp dụng khi chuẩn hoá dàn ý AI trả về", () => {
    const raw = {
      title: "Bài",
      slides: [
        { role: "cover", section: null, kind: "content", layout: "cover", title: "Bìa", points: ["Giá trị."] },
        { role: "content", section: "A", kind: "content", layout: "image", title: "Ý chính", points: ["Một."] },
        { role: "content", section: "A", kind: "content", layout: "image", title: "Quiz: Thuộc tính nào?", points: ["Một."] },
        { role: "content", section: "A", kind: "quiz", layout: null, title: "Thuộc tính nào cần đổi?", points: [] },
        { role: "content", section: "A", kind: "content", layout: "image", title: "Word Cloud: Một từ?", points: ["Một."] },
        { role: "content", section: "A", kind: "content", layout: "cards", title: "Ba ý", points: ["A: một.", "B: hai.", "C: ba."] },
        { role: "summary", section: null, kind: "content", layout: "summary", title: "Tổng kết", points: ["Ý."] },
      ],
    };
    const { outline } = normalizeOutline(raw, 15);
    const titles = outline.slides.map((s) => `${s.kind}:${s.title}`);
    expect(titles).not.toContain("content:Quiz: Thuộc tính nào?");
    expect(titles).toContain("quiz:Thuộc tính nào cần đổi?");
    expect(titles).toContain("word_cloud:Một từ?");
  });
});
