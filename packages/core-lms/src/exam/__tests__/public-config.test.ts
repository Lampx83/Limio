import { describe, expect, it } from "vitest";
import { toPublicQuestionConfig } from "../public-config";

describe("toPublicQuestionConfig — không lộ đáp án xuống trình duyệt", () => {
  it("mcq: chỉ còn id + label, không isCorrect / explanation", () => {
    const out = toPublicQuestionConfig("mcq", {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
      explanation: "vì A",
    });
    expect(out).toEqual({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });
    expect(JSON.stringify(out)).not.toMatch(/isCorrect|explanation|vì A/);
  });

  it("multi: cùng quy tắc với mcq", () => {
    const out = toPublicQuestionConfig("multi", {
      options: [{ id: "a", label: "A", isCorrect: true }],
    });
    expect(out).toEqual({ options: [{ id: "a", label: "A" }] });
  });

  it("gap_fill: chỉ còn id của chỗ trống, không acceptedAnswers", () => {
    const out = toPublicQuestionConfig("gap_fill", {
      blanks: [{ id: "b1", acceptedAnswers: ["đáp án"], matchMode: "exact" }],
      explanation: "x",
    });
    expect(out).toEqual({ blanks: [{ id: "b1" }] });
  });

  it("true_false_notgiven / short_answer: config rỗng", () => {
    expect(toPublicQuestionConfig("true_false_notgiven", { correct: "true" })).toEqual({});
    expect(
      toPublicQuestionConfig("short_answer", { acceptedAnswers: ["x"], matchMode: "exact" }),
    ).toEqual({});
  });

  it("essay hội thoại đóng vai: kịch bản và audio từng lượt xuống trình duyệt (là nội dung đề), bài mẫu và tiêu chí vẫn bị giấu", () => {
    const roleplay = { roles: { A: "Khách" }, turns: [{ speaker: "A", text: "Hi.", audio: "/api/exam-assets/a.m4a" }, { speaker: "B", text: "Hello." }] };
    const out = toPublicQuestionConfig("essay", { roleplay, rubric: "bí mật", explanation: "A: Hi.", explanationAudio: "/api/exam-assets/s.m4a" });
    expect(out).toEqual({ voiceAnswer: true, aiFeedback: true, roleplay });
    expect(JSON.stringify(out)).not.toMatch(/bí mật|s\.m4a/);
  });

  it("essay nói tự do: tình huống, lời mở đầu, cụm gợi ý xuống trình duyệt; bài mẫu và tiêu chí vẫn giấu", () => {
    const freechat = { scenario: "Choose what to take.", partnerRole: "Sam", opening: "What would you take?", targets: ["I'm not sure"], maxTurns: 6 };
    const out = toPublicQuestionConfig("essay", { freechat, rubric: "bí mật", explanation: "đáp án" });
    expect(out).toEqual({ voiceAnswer: true, aiFeedback: true, freechat });
    expect(JSON.stringify(out)).not.toMatch(/bí mật|đáp án/);
  });

  it("essay: giữ minWords và hai công tắc (mặc định bật), bỏ rubric, bài mẫu và audio mẫu", () => {
    expect(toPublicQuestionConfig("essay", { rubric: "bí mật", minWords: 100, explanation: "Bài mẫu", explanationAudio: "/api/exam-assets/a.m4a" })).toEqual({
      minWords: 100,
      voiceAnswer: true,
      aiFeedback: true,
    });
    expect(toPublicQuestionConfig("essay", { voiceAnswer: false, aiFeedback: false })).toEqual({ voiceAnswer: false, aiFeedback: false });
  });

  it("loại lạ hoặc config hỏng: trả rỗng thay vì chuyển nguyên xi", () => {
    expect(toPublicQuestionConfig("matching_heading", { answer: "x" })).toEqual({});
    expect(toPublicQuestionConfig("mcq", null)).toEqual({ options: [] });
    expect(toPublicQuestionConfig("mcq", { options: "oops" })).toEqual({ options: [] });
  });
});

describe("toPublicQuestionConfig — chú giải đề (promptAid)", () => {
  const aid = { reading: "Nǐ hǎo ma?", translation: "How are you?" };

  it.each(["mcq", "essay", "gap_fill", "drag_drop_fill", "short_answer", "true_false_notgiven"])("giữ phiên âm và bản dịch ở loại %s", (type) => {
    const out = toPublicQuestionConfig(type, { promptAid: aid, options: [], blanks: [], tokens: [] });
    expect(out.promptAid).toEqual(aid);
  });

  it("chỉ giữ hai chuỗi đã biết, bỏ khoá lạ và chuỗi rỗng; không có thì không thêm khoá", () => {
    expect(toPublicQuestionConfig("essay", { promptAid: { reading: "x", secret: "đáp án", translation: "  " } }).promptAid).toEqual({ reading: "x" });
    expect(toPublicQuestionConfig("essay", { promptAid: {} })).not.toHaveProperty("promptAid");
    expect(toPublicQuestionConfig("mcq", { options: [] })).not.toHaveProperty("promptAid");
  });

  it("không làm lộ đáp án của câu trắc nghiệm", () => {
    const out = toPublicQuestionConfig("mcq", { options: [{ id: "a", label: "A", isCorrect: true }], promptAid: aid });
    expect(JSON.stringify(out)).not.toContain("isCorrect");
  });
});
