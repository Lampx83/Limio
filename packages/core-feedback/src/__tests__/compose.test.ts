import { describe, expect, it } from "vitest";
import { composeFeedbackBody, type ComposeInput } from "../compose";

/** Đủ mọi nước — dùng làm gốc rồi bớt dần trong từng test. */
const full: ComposeInput = {
  learningObjective: null,
  lessonTitle: "Bài 1.2 · Tâm lý học nhận thức trong UI/UX",
  chosenLabels: ["Sinh viên chủ quan, cần nhắc đọc kỹ hướng dẫn hơn"],
  correctLabels: ["Mô hình của hệ thống và mô hình của người học lệch nhau"],
  typedResponse: null,
  orderedCorrectLabels: [],
  misconceptionName: "Đổ lỗi cho người dùng",
  explanation: "Thanh tiến độ đang đếm số bài đã mở, không phải số bài đã hiểu.",
  templateBody: "Đoạn văn dùng chung cho nhiều câu.",
  remediationLessonTitles: ["Bài 1.2 · Tâm lý học nhận thức trong UI/UX"],
};

describe("composeFeedbackBody — khung Hattie", () => {
  it("AC-2.1: các nước xuất hiện đúng thứ tự feed up → feed back → feed forward", () => {
    const out = composeFeedbackBody(full);
    const iUp = out.indexOf("Câu này thuộc");
    const iBack = out.indexOf("Mình thấy bạn chọn");
    const iForward = out.indexOf("xem lại");
    expect(iUp).toBeGreaterThanOrEqual(0);
    expect(iBack).toBeGreaterThan(iUp);
    expect(iForward).toBeGreaterThan(iBack);
  });

  it("AC-2.2: nêu cả đáp án đã chọn lẫn đáp án đúng, bằng nhãn thật", () => {
    const out = composeFeedbackBody(full);
    expect(out).toContain("Sinh viên chủ quan");
    expect(out).toContain("Mô hình của hệ thống");
  });

  it("AC-1.2: có mục tiêu thì dùng mục tiêu, không có mới lùi về tên bài", () => {
    const withObjective = composeFeedbackBody({
      ...full,
      learningObjective: "nhận ra khi mô hình hệ thống lệch với mô hình người học",
    });
    expect(withObjective).toContain("Phần này nhắm tới:");
    expect(withObjective).not.toContain("Câu này thuộc");
    expect(composeFeedbackBody(full)).toContain("Câu này thuộc");
  });

  it("AC-1.3: không mục tiêu, không tên bài ⇒ bỏ hẳn nước feed up", () => {
    const out = composeFeedbackBody({ ...full, lessonTitle: null });
    expect(out).not.toContain("Câu này thuộc");
    expect(out).not.toContain("Phần này nhắm tới");
    expect(out).toContain("Mình thấy bạn chọn");
  });

  it("AC-2.3: matching/ordering không nói 'bạn chọn' nhưng vẫn giữ các nước khác", () => {
    const out = composeFeedbackBody({ ...full, chosenLabels: [] });
    expect(out).not.toContain("bạn chọn");
    expect(out).toContain("Đáp án đúng là");
    expect(out).toContain("Thanh tiến độ đang đếm");
  });

  it("AC-2.5: có giải thích riêng thì dùng nó, KHÔNG dùng đoạn văn dùng chung", () => {
    const out = composeFeedbackBody(full);
    expect(out).toContain("Thanh tiến độ đang đếm");
    expect(out).not.toContain("Đoạn văn dùng chung");
  });

  it("AC-2.5: thiếu giải thích riêng mới rơi về đoạn văn dùng chung", () => {
    const out = composeFeedbackBody({ ...full, explanation: null });
    expect(out).toContain("Đoạn văn dùng chung");
  });

  it("AC-2.6: không có gì để nói vẫn trả câu fallback, không để trống", () => {
    const out = composeFeedbackBody({
      learningObjective: null,
      lessonTitle: null,
      chosenLabels: [],
      correctLabels: [],
      typedResponse: null,
      orderedCorrectLabels: [],
      misconceptionName: null,
      explanation: null,
      templateBody: null,
      remediationLessonTitles: [],
    });
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out).toContain("chưa đúng");
  });

  it("AC-2.7: nước feed forward nêu tên bài, không nêu id", () => {
    const out = composeFeedbackBody(full);
    expect(out).toContain("Bài 1.2 · Tâm lý học nhận thức trong UI/UX");
    expect(out).toMatch(/xem lại .* rồi thử lại nhé\./);
  });
});

describe("composeFeedbackBody — ràng buộc thực nghiệm B10", () => {
  /** Lớp đối chứng: không tên chỗ nhầm, không bài ôn. */
  const minimal: ComposeInput = {
    ...full,
    misconceptionName: null,
    remediationLessonTitles: [],
  };

  it("AC-3.1 + 3.2: minimal không có tên chỗ nhầm và không có feed forward", () => {
    const out = composeFeedbackBody(minimal);
    expect(out).not.toContain("dễ nhầm");
    expect(out).not.toContain("xem lại");
  });

  it("AC-3.3: minimal VẪN có feed up, feed back và giải thích của câu hỏi", () => {
    const out = composeFeedbackBody(minimal);
    expect(out).toContain("Câu này thuộc");
    expect(out).toContain("Mình thấy bạn chọn");
    expect(out).toContain("Thanh tiến độ đang đếm");
  });
});

describe("composeFeedbackBody — không bao giờ chạm cấp `self`", () => {
  it("AC-2.8: không khen chê con người, dù dữ liệu vào thế nào", () => {
    const outs = [
      composeFeedbackBody(full),
      composeFeedbackBody({ ...full, misconceptionName: null }),
      composeFeedbackBody({ ...full, chosenLabels: [], explanation: null }),
    ];
    for (const out of outs) {
      expect(out).not.toMatch(/giỏi|thông minh|kém|dốt|lười|cố lên/i);
    }
  });
});

describe("composeFeedbackBody — fill_in (chuỗi tự do)", () => {
  it("nêu đúng chữ đã gõ, không lẫn với chosenLabels", () => {
    const out = composeFeedbackBody({
      ...full,
      chosenLabels: [],
      typedResponse: "trông ra sau",
      orderedCorrectLabels: [],
    });
    expect(out).toContain("Mình thấy bạn điền “trông ra sau”");
    expect(out).toContain("đáp án đúng là");
    expect(out).not.toContain("Mình thấy bạn chọn");
  });

  it("gõ trắng thì không bịa ra nước feed-back", () => {
    const out = composeFeedbackBody({
      ...full,
      chosenLabels: [],
      typedResponse: "   ",
      orderedCorrectLabels: [],
    });
    expect(out).not.toContain("Mình thấy bạn điền");
    expect(out).toContain("Đáp án đúng là");
  });
});

describe("composeFeedbackBody — ordering (thứ tự, không phải isCorrect)", () => {
  it("không phương án nào isCorrect vẫn nói được thứ tự đúng, nhờ orderedCorrectLabels", () => {
    const out = composeFeedbackBody({
      ...full,
      chosenLabels: [],
      correctLabels: [], // đúng thực tế: ordering không đánh dấu isCorrect
      typedResponse: null,
      orderedCorrectLabels: ["Nghiên cứu", "Cấu trúc", "Khung sườn", "Bề mặt"],
    });
    expect(out).toContain("Thứ tự đúng là:");
    expect(out).toContain("Nghiên cứu” → “Cấu trúc” → “Khung sườn” → “Bề mặt");
  });

  it("thiếu cả correctLabels lẫn orderedCorrectLabels thì bỏ hẳn nước feed-back, không im lặng đến mức bịa", () => {
    const out = composeFeedbackBody({
      ...full,
      chosenLabels: [],
      correctLabels: [],
      typedResponse: null,
      orderedCorrectLabels: [],
    });
    expect(out).not.toContain("Đáp án đúng là");
    expect(out).not.toContain("Thứ tự đúng là");
    // Vẫn còn giải thích + feed forward — không rơi về fallback trắng.
    expect(out).toContain("Thanh tiến độ đang đếm");
  });
});
