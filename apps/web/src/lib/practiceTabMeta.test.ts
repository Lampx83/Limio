import { describe, expect, it } from "vitest";
import type { PracticeEmbed } from "@feedbackme/core-lms";
import { mergePracticeMeta, practiceKindOf, practiceTabMeta, practiceTabTitle } from "./practiceTabMeta";

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
