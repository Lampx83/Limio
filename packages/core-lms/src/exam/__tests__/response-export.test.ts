import { describe, expect, it } from "vitest";
import { describeResponse, optionLetter } from "../response-export";

const mcqConfig = {
  options: [
    { id: "o1", label: "Sài Gòn", isCorrect: false },
    { id: "o2", label: "Hà Nội", isCorrect: true },
    { id: "o3", label: "Huế", isCorrect: false },
    { id: "o4", label: "Đà Nẵng", isCorrect: false },
  ],
};

describe("optionLetter", () => {
  it("theo vị trí, không theo id", () => {
    expect(optionLetter(0)).toBe("A");
    expect(optionLetter(3)).toBe("D");
    expect(optionLetter(25)).toBe("Z");
    expect(optionLetter(26)).toBe("#27");
  });
});

describe("describeResponse — trắc nghiệm một đáp án", () => {
  it("trả về chữ cái đã chọn và đáp án đúng", () => {
    const d = describeResponse("mcq", mcqConfig, { optionIds: ["o3"] });
    expect(d.chosen).toBe("C");
    expect(d.key).toBe("B");
  });

  it("không trả lời thì rỗng, không nổ", () => {
    expect(describeResponse("mcq", mcqConfig, null).chosen).toBe("");
    expect(describeResponse("mcq", mcqConfig, {}).chosen).toBe("");
  });

  it("chữ cái bám THỨ TỰ GỐC, không bám id", () => {
    // Đề xáo phương án từng thí sinh, nên "A" trên màn hình mỗi người một
    // khác. Phân tích nhiễu chỉ có nghĩa khi mọi người quy về cùng một mốc.
    const d = describeResponse("mcq", mcqConfig, { optionIds: ["o1"] });
    expect(d.chosen).toBe("A");
  });
});

describe("describeResponse — chọn nhiều đáp án", () => {
  const multiConfig = {
    options: [
      { id: "a", label: "A", isCorrect: true },
      { id: "b", label: "B", isCorrect: false },
      { id: "c", label: "C", isCorrect: true },
    ],
  };

  it("gộp bằng dấu chấm phẩy, đã sắp thứ tự", () => {
    const d = describeResponse("multi", multiConfig, { optionIds: ["c", "a"] });
    // Bấm C trước A vẫn ra "A;C" — nếu không thì đếm tần suất sẽ tách cùng một
    // bộ đáp án thành hai nhóm khác nhau.
    expect(d.chosen).toBe("A;C");
    expect(d.key).toBe("A;C");
  });
});

describe("describeResponse — các loại còn lại", () => {
  it("đúng/sai/không có", () => {
    const cfg = { correct: "false" };
    const d = describeResponse("true_false_notgiven", cfg, { correct: "notgiven" });
    expect(d.chosen).toBe("notgiven");
    expect(d.key).toBe("false");
  });

  it("điền khuyết giữ nguyên chữ thí sinh gõ", () => {
    const cfg = {
      blanks: [
        { id: "b1", acceptedAnswers: ["mèo", "con mèo"] },
        { id: "b2", acceptedAnswers: ["chó"] },
      ],
    };
    const d = describeResponse("gap_fill", cfg, { blanks: { b1: "mèo", b2: "gà" } });
    expect(d.text).toBe("mèo / gà");
    expect(d.key).toBe("mèo|con mèo / chó");
  });

  it("tự luận trả về nguyên văn", () => {
    const d = describeResponse("essay", {}, { text: "Bài làm của em..." });
    expect(d.text).toBe("Bài làm của em...");
    expect(d.chosen).toBe("");
  });

  it("loại lạ thì rỗng chứ không nổ", () => {
    expect(describeResponse("loai_moi_nao_do", {}, { gi: "do" })).toEqual({
      chosen: "",
      key: "",
      text: "",
    });
  });
});
