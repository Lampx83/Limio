import { describe, expect, it } from "vitest";
import { pdfTitle, toPublicSlides } from "./limioLiveShare";

describe("toPublicSlides — lọc bài giảng cho link xem công khai", () => {
  it("bỏ ghi chú giảng và dấu vết AI của slide nội dung, giữ phần hiển thị", () => {
    const [s] = toPublicSlides([
      {
        id: "1",
        type: "content",
        config: {
          layout: "cards",
          title: "Ba ý chính",
          items: [{ heading: "A", body: "a" }],
          presenterNote: "Nhắc lớp về bài kiểm tra",
          outlineId: "row-1",
          aiGenerated: true,
          editedByUser: true,
        },
      },
    ]);
    expect(s!.config).toEqual({ layout: "cards", title: "Ba ý chính", items: [{ heading: "A", body: "a" }] });
    expect(JSON.stringify(s)).not.toContain("Nhắc lớp");
  });

  it("bỏ slide ẩn khi trình chiếu, giữ thứ tự các slide còn lại", () => {
    const out = toPublicSlides([
      { id: "1", type: "content", config: { title: "Một" } },
      { id: "2", type: "content", config: { title: "Ẩn", hidden: true } },
      { id: "3", type: "poll", config: { question: "Ba?", options: [], hidden: true } },
      { id: "4", type: "word_cloud", config: { prompt: "Bốn" } },
    ]);
    expect(out.map((s) => s.id)).toEqual(["1", "4"]);
  });

  it("trắc nghiệm không mang đáp án đúng ra ngoài", () => {
    const [s] = toPublicSlides([
      {
        id: "q",
        type: "quiz",
        config: {
          question: "2 + 2?",
          options: [{ text: "3" }, { text: "4", correct: true }],
          presenterNote: "Đáp án là 4",
          explanation: "vì 2+2=4",
        },
      },
    ]);
    expect(s!.config).toEqual({ question: "2 + 2?", options: [{ text: "3" }, { text: "4" }] });
    expect(JSON.stringify(s)).not.toMatch(/correct|Đáp án|explanation/);
  });

  it("slide tương tác chỉ giữ các khoá được liệt kê", () => {
    const out = toPublicSlides([
      { id: "w", type: "word_cloud", config: { prompt: "Từ khoá", secret: 1 } },
      { id: "b", type: "collaborate_board", config: { prompt: "Dán ý", mode: "grouped", columns: ["A", 2, "B"], blockPaste: true } },
      { id: "d", type: "whiteboard", config: { title: "Vẽ sơ đồ", presenterNote: "x" } },
    ]);
    expect(out.map((s) => s.config)).toEqual([
      { prompt: "Từ khoá" },
      { title: "", prompt: "Dán ý", mode: "grouped", columns: ["A", "B"] },
      { title: "Vẽ sơ đồ" },
    ]);
  });

  it("config hỏng hoặc loại lạ không làm vỡ trang", () => {
    const out = toPublicSlides([
      { id: "1", type: "quiz", config: null },
      { id: "2", type: "content", config: [1, 2] },
      { id: "3", type: "mystery", config: {} },
    ]);
    expect(out).toEqual([
      { id: "1", type: "quiz", config: { question: "", options: [] } },
      { id: "2", type: "content", config: {} },
    ]);
  });
});

describe("pdfTitle", () => {
  it("bỏ ký tự không đặt được tên tệp", () => {
    expect(pdfTitle('Bài 1: "AI" / Giáo dục?')).toBe("Bài 1 AI Giáo dục");
    expect(pdfTitle("  ")).toBe("Bai giang");
  });
});
