import { describe, expect, it } from "vitest";
import type { PracticeEmbed } from "@feedbackme/core-lms";
import { splitEmbedByExercise, splitEmbedByPassage } from "./practiceExerciseSplit";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC5: khối gom nhiều exercise tách thành từng tab. */
const q = (id: string, passageId: string | null) => ({ id, type: "mcq", prompt: id, points: 1, passageId, sectionTitle: "s", languageSkill: null, config: {} });
const ps = (id: string, title: string) => ({ id, title, contentJson: { type: "doc", content: [] } });
const ans = (questionId: string) => ({ questionId, answerJson: null, checked: false, isCorrect: null, hasAudio: false, aiFeedback: null });

const embed = (o: Partial<PracticeEmbed>): PracticeEmbed => ({
  examId: "e1",
  title: "T",
  sessionId: "s1",
  checkEnabled: true,
  timed: false,
  questions: [],
  passages: [],
  answers: [],
  ...o,
});

describe("splitEmbedByExercise", () => {
  const grammar = embed({
    passages: [ps("p3a", "3A · Sentences"), ps("p3b", "3B · Rules"), ps("p3c", "3C · Rules"), ps("p5", "5")],
    questions: [q("a1", "p3a"), q("a2", "p3a"), q("b1", "p3b"), q("c1", "p3c"), q("e1", "p5"), q("e2", "p5")],
    answers: [ans("a1"), ans("e2")],
  });

  it("mỗi đoạn có nhãn là một tab; câu, đoạn và đáp án được chia đúng, giữ nguyên thứ tự", () => {
    const r = splitEmbedByExercise(grammar);
    expect(r.map((g) => g.label)).toEqual(["3A", "3B", "3C", "5"]);
    expect(r[0]!.embed.questions.map((x) => x.id)).toEqual(["a1", "a2"]);
    expect(r[0]!.embed.passages.map((x) => x.id)).toEqual(["p3a"]);
    expect(r[0]!.embed.answers.map((x) => x.questionId)).toEqual(["a1"]);
    expect(r[3]!.embed.answers.map((x) => x.questionId)).toEqual(["e2"]);
  });

  it("giữ nguyên thông tin chung của khối: đề, buổi luyện, kiểm tra từng câu", () => {
    for (const g of splitEmbedByExercise(grammar)) {
      expect(g.embed).toMatchObject({ examId: "e1", sessionId: "s1", checkEnabled: true, timed: false });
    }
  });

  it("các đoạn liên tiếp cùng nhãn (7B, 7B) gộp một tab", () => {
    const e = embed({
      passages: [ps("a", "7A · x"), ps("b1", "7B · take and hand"), ps("b2", "7B · put, look and keep"), ps("c", "7C · y")],
      questions: [q("1", "a"), q("2", "b1"), q("3", "b2"), q("4", "c")],
    });
    const r = splitEmbedByExercise(e);
    expect(r.map((g) => g.label)).toEqual(["7A", "7B", "7C"]);
    expect(r[1]!.embed.passages.map((x) => x.id)).toEqual(["b1", "b2"]);
    expect(r[1]!.embed.questions.map((x) => x.id)).toEqual(["2", "3"]);
  });

  it("đoạn không có nhãn đi cùng tab đứng trước; câu không thuộc đoạn nào đi cùng tab cuối", () => {
    const e = embed({
      passages: [ps("a", "1A · x"), ps("note", "Reading text"), ps("b", "1B · y")],
      questions: [q("1", "a"), q("2", "note"), q("3", "b"), q("4", null)],
    });
    const r = splitEmbedByExercise(e);
    expect(r.map((g) => g.label)).toEqual(["1A", "1B"]);
    expect(r[0]!.embed.questions.map((x) => x.id)).toEqual(["1", "2"]);
    expect(r[1]!.embed.questions.map((x) => x.id)).toEqual(["3", "4"]);
  });

  it("đoạn đầu không nhãn thành nhóm riêng nhãn null (nơi gọi đặt tên dự phòng)", () => {
    const e = embed({ passages: [ps("art", "The article"), ps("b", "2C · Questions")], questions: [q("1", "art"), q("2", "b")] });
    expect(splitEmbedByExercise(e).map((g) => g.label)).toEqual([null, "2C"]);
  });

  it("dải nhãn (2A–2C) giữ nguyên là một tab", () => {
    const e = embed({ passages: [ps("a", "2A–2C · Busy-ness"), ps("d", "2D · more")], questions: [q("1", "a"), q("2", "d")] });
    expect(splitEmbedByExercise(e).map((g) => g.label)).toEqual(["2A–2C", "2D"]);
  });

  it("chỉ một exercise (hoặc không có đoạn): không tách, trả mảng rỗng", () => {
    expect(splitEmbedByExercise(embed({ passages: [ps("a", "1A · x")], questions: [q("1", "a"), q("2", "a")] }))).toEqual([]);
    expect(splitEmbedByExercise(embed({ questions: [q("1", null), q("2", null)] }))).toEqual([]);
  });

  it("đoạn không có câu hỏi (bài nghe 5A) vẫn là một exercise riêng, đứng đúng thứ tự", () => {
    const e = embed({
      passages: [ps("a", "5A"), ps("bc", "5B–5C")],
      questions: [q("1", "bc"), q("2", "bc")],
    });
    const r = splitEmbedByExercise(e);
    expect(r.map((g) => g.label)).toEqual(["5A", "5B–5C"]);
    expect(r[0]!.embed.questions).toEqual([]);
    expect(r[0]!.embed.passages.map((x) => x.id)).toEqual(["a"]);
    expect(r[1]!.embed.questions.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("đoạn không có câu hỏi và không nhãn: đi cùng exercise đứng trước, không thành tab riêng", () => {
    const e = embed({ passages: [ps("a", "1A · x"), ps("note", "Intro text"), ps("b", "1B · y")], questions: [q("1", "a"), q("2", "b")] });
    const r = splitEmbedByExercise(e);
    expect(r.map((g) => g.label)).toEqual(["1A", "1B"]);
    expect(r[0]!.embed.passages.map((x) => x.id)).toEqual(["a", "note"]);
  });
});


describe("splitEmbedByPassage — một exercise nhiều đoạn thành các khối nối nhau, không tab con", () => {
  const multi = embed({
    passages: [ps("pa", "5A · Agreeing"), ps("pb", "5A · Disagreeing"), ps("pc", "5A · Opinion")],
    questions: [q("a1", "pa"), q("a2", "pa"), q("b1", "pb"), q("c1", "pc")],
    answers: [ans("a1"), ans("c1")],
  });

  it("mỗi đoạn một khối: đoạn, câu và đáp án chia đúng, giữ thông tin chung của khối", () => {
    const r = splitEmbedByPassage(multi);
    expect(r.map((e) => e.passages.map((p) => p.id))).toEqual([["pa"], ["pb"], ["pc"]]);
    expect(r[0]!.questions.map((x) => x.id)).toEqual(["a1", "a2"]);
    expect(r[2]!.answers.map((x) => x.questionId)).toEqual(["c1"]);
    expect(r[1]).toMatchObject({ examId: "e1", sessionId: "s1", checkEnabled: true });
  });

  it("chỉ một đoạn (hoặc không có): không tách", () => {
    expect(splitEmbedByPassage(embed({ passages: [ps("p", "x")], questions: [q("a", "p")] }))).toEqual([]);
    expect(splitEmbedByPassage(embed({}))).toEqual([]);
  });

  it("đoạn không có câu hỏi (chỉ audio) vẫn là một khối; câu không thuộc đoạn nào đi cùng đoạn trước", () => {
    const r = splitEmbedByPassage(embed({ passages: [ps("a", "A"), ps("b", "B")], questions: [q("x", "a"), q("y", null)] }));
    expect(r[0]!.questions.map((x) => x.id)).toEqual(["x", "y"]);
    expect(r[1]!.questions).toEqual([]);
    expect(r[1]!.passages.map((p) => p.id)).toEqual(["b"]);
  });
});
