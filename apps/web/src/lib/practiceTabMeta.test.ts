import { describe, expect, it } from "vitest";
import type { PracticeEmbed } from "@feedbackme/core-lms";
import { mergePracticeMeta, practiceKindOf, practiceTabMeta, practiceTabTitle, titleFromInstruction, headingTitleOf } from "./practiceTabMeta";

const q = (id: string, type: string) => ({ id, type, prompt: id, points: 1, passageId: "p", sectionTitle: "s", languageSkill: null, config: {} });
const doc = (...content: object[]) => ({ type: "doc", content });
const embed = (o: Partial<PracticeEmbed>): PracticeEmbed => ({ examId: "e", title: "T", sessionId: "s", checkEnabled: true, timed: false, questions: [], passages: [], answers: [], ...o });
const ans = (questionId: string, answerJson: unknown, checked = false) => ({ questionId, answerJson, checked, isCorrect: null, hasAudio: false, aiFeedback: null });

describe("practiceTabTitle", () => {
  it("bỏ mã bài tập ở đầu, giữ tên bài; các đoạn cùng tên bài thì dùng chung", () => {
    expect(practiceTabTitle(["5A · Complete the phrases · Agreeing", "5A · Complete the phrases · Opinion"])).toBe("Complete the phrases");
    expect(practiceTabTitle(["5B–5C · Stress patterns · Listen and repeat"])).toBe("Stress patterns");
    expect(practiceTabTitle(["4B · Talk with a virtual partner"])).toBe("Talk with a virtual partner");
  });
  it("các đoạn khác tên nhau: dùng tên khối (bỏ đuôi Practice), không có thì rỗng", () => {
    expect(practiceTabTitle(["Enzo’s items", "Patti’s items"], "Match the items with the photos")).toBe("Match the items with the photos");
    expect(practiceTabTitle(["Enzo’s items", "Patti’s items"])).toBe("");
    expect(practiceTabTitle([], "Describing everyday objects · Practice")).toBe("Describing everyday objects");
  });
});

describe("practiceKindOf", () => {
  it("phiếu bạn ảo là nói; đoạn có âm thanh là nghe; còn lại theo dạng câu hỏi nhiều nhất", () => {
    expect(practiceKindOf(embed({}), true)).toBe("speak");
    expect(practiceKindOf(embed({ passages: [{ id: "p", title: "x", contentJson: doc({ type: "paragraph" }, { type: "audio", attrs: {} }) }] }), false)).toBe("listen");
    expect(practiceKindOf(embed({ questions: [q("a", "gap_fill"), q("b", "gap_fill"), q("c", "mcq")] }), false)).toBe("write");
    expect(practiceKindOf(embed({ questions: [q("a", "mcq"), q("b", "multi")] }), false)).toBe("choose");
    expect(practiceKindOf(embed({ questions: [q("a", "matching")] }), false)).toBe("match");
    expect(practiceKindOf(embed({}), false)).toBe("read");
  });
});

describe("practiceTabMeta / mergePracticeMeta", () => {
  it("đếm câu đã có đáp án và đã kiểm tra của chính tab", () => {
    const m = practiceTabMeta(embed({ questions: [q("a", "mcq"), q("b", "mcq"), q("c", "mcq")], answers: [ans("a", "x", true), ans("b", null), ans("z", "x", true)] }), false);
    expect(m.ids).toEqual(["a", "b", "c"]);
    expect(m.answered).toEqual(["a"]);
    expect(m.checked).toEqual(["a"]);
  });
  it("gộp hai tab cùng nhãn: câu không trùng, giữ tên và loại có nghĩa", () => {
    const m = mergePracticeMeta([{ title: "", kind: "read", ids: ["a"] }, { title: "Role-play", kind: "speak", ids: ["a", "b"], answered: ["b"] }]);
    expect(m).toMatchObject({ title: "Role-play", kind: "speak", ids: ["a", "b"], answered: ["b"] });
    expect(mergePracticeMeta([])).toBeUndefined();
  });
});

describe("titleFromInstruction — tên cho bài tập sách không đặt tên", () => {
  it("lấy câu đầu có nghĩa, bỏ dấu chấm cuối, giữ dấu hỏi", () => {
    expect(titleFromInstruction("Which word has the main stress? Listen and check.")).toBe("Which word has the main stress?");
    expect(titleFromInstruction("Read the article about coffee.")).toBe("Read the article about coffee");
  });
  it("bỏ mở đầu chung chung như Work in pairs", () => {
    expect(titleFromInstruction("Work in pairs. Discuss the questions.")).toBe("Discuss the questions");
    expect(titleFromInstruction("Work in pairs.")).toBe("Work in pairs");
  });
  it("câu dài: cắt ở chỗ ngắt mệnh đề, không kết thúc bằng giới từ hay từ nối", () => {
    expect(titleFromInstruction("Listen to the radio programme and answer the questions.")).toBe("Listen to the radio programme");
    expect(titleFromInstruction("Complete the second sentence so that it means the same as the first.")).toBe("Complete the second sentence");
    expect(titleFromInstruction("What do the lists tell you about the people in the article?")).toBe("What do the lists tell…");
    expect(titleFromInstruction("Choose three items from the photos and write sentences about them.")).toBe("Choose three items from the photos");
  });
  it("câu ngắn giữ nguyên; rỗng thì rỗng", () => {
    expect(titleFromInstruction("Discuss the questions below with your partner.")).toBe("Discuss the questions below with your partner");
    expect(titleFromInstruction("   ")).toBe("");
  });
  it("đoạn chỉ có đúng một câu yêu cầu (không có gì khác) vẫn đặt được tên", () => {
    const m = practiceTabMeta(embed({ passages: [{ id: "p", title: "5", contentJson: doc({ type: "paragraph", content: [{ type: "text", text: "Complete the second sentence. Use three words." }] }) }] }), false);
    expect(m.title).toBe("Complete the second sentence");
  });
  it("practiceTabMeta: không có tên đoạn thì lấy từ câu yêu cầu ở đầu đoạn", () => {
    const m = practiceTabMeta(embed({ passages: [{ id: "p", title: "", contentJson: doc({ type: "paragraph", content: [{ type: "text", text: "Underline the stressed words. Then repeat." }] }, { type: "paragraph", content: [{ type: "text", text: "She had her nails done." }] }) }] }), false);
    expect(m.title).toBe("Underline the stressed words");
  });
});

describe("headingTitleOf — tiêu đề thẻ đề bài", () => {
  const para = (text: string) => doc({ type: "paragraph", content: [{ type: "text", text }] });
  it("đoạn đã có tên thì giữ nguyên", () => {
    expect(headingTitleOf("3D · More examples in the article", para("Work in pairs. Find more examples."))).toBe("3D · More examples in the article");
  });
  it("đoạn chỉ có mã bài thì thêm tên rút từ câu yêu cầu", () => {
    expect(headingTitleOf("5", para("Complete the second sentence. Use three words."))).toBe("5 · Complete the second sentence");
    expect(headingTitleOf("4A", doc({ type: "paragraph", content: [{ type: "text", text: "Which word is stressed? Listen and check." }] }, { type: "paragraph", content: [{ type: "text", text: "She had her nails done." }] }))).toBe("4A · Which word is stressed?");
  });
  it("không có câu yêu cầu thì giữ mã bài", () => {
    expect(headingTitleOf("5", doc())).toBe("5");
  });
});
