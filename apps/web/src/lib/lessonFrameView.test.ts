import { describe, expect, it } from "vitest";
import { lessonViewHref, parseLessonView, splitLessonItems, vocabItemCount } from "./lessonFrameView";

const vocab = (n: number) => ({ type: "vocab_list", payload: { items: Array.from({ length: n }, (_, i) => ({ id: String(i) })) } });
const text = { type: "richtext", payload: { html: "<p>x</p>" } };

describe("parseLessonView", () => {
  it("chỉ 'vocab' mới là Từ vựng; mọi giá trị khác về Bài học", () => {
    expect(parseLessonView("vocab")).toBe("vocab");
    for (const v of [undefined, "", "lesson", "VOCAB", ["vocab"], 5]) expect(parseLessonView(v)).toBe("lesson");
  });
});

describe("vocabItemCount", () => {
  it("đếm từ của khối vocab_list, 0 với khối khác hoặc payload hỏng", () => {
    expect(vocabItemCount(vocab(4))).toBe(4);
    expect(vocabItemCount(text)).toBe(0);
    for (const p of [null, undefined, {}, { items: "x" }, 7]) expect(vocabItemCount({ type: "vocab_list", payload: p })).toBe(0);
  });
});

describe("splitLessonItems", () => {
  it("khối từ vựng sang tab riêng, tổng số từ cộng dồn, khối khác giữ thứ tự", () => {
    const items = [text, vocab(3), { type: "audio", payload: {} }, vocab(5)];
    const r = splitLessonItems(items);
    expect(r.count).toBe(8);
    expect(r.vocab).toHaveLength(2);
    expect(r.lesson.map((i) => i.type)).toEqual(["richtext", "audio"]);
  });
  it("khối từ vựng rỗng không tạo tab và không hiện ở đâu cả", () => {
    const r = splitLessonItems([text, vocab(0)]);
    expect(r.count).toBe(0);
    expect(r.vocab).toHaveLength(0);
    expect(r.lesson).toHaveLength(1);
  });
});

describe("lessonViewHref", () => {
  it("Bài học là đường dẫn gốc, Từ vựng thêm view=vocab", () => {
    expect(lessonViewHref("s", "l", "lesson")).toBe("/learn/s/lessons/l");
    expect(lessonViewHref("s", "l", "vocab")).toBe("/learn/s/lessons/l?view=vocab");
  });
});
