import { describe, expect, it } from "vitest";
import { countWords, estimateLessonDeckTokens, formatTokenCount, lessonDeckIntent, minutesForLesson } from "./limioLiveLessonDeck";
import { SELF_CHECK_TARGET, interactionGap, quizOnly } from "./limioLiveInteractions";
import { outlineWarnings, slideRange, type Outline } from "./limioLiveOutline";
import { reviseRange } from "./limioLiveOutlineRevise";

const slide = (id: string, kind: string, extra: object = {}) => ({ id, partId: "p1", kind, layout: null, title: `S ${id}`, points: [], ...extra });
const outline = (kinds: string[]): Outline => ({
  title: "T",
  parts: [{ id: "p1", role: "content", name: "Phần" }],
  slides: kinds.map((k, i) => slide(`s${i}`, k)),
}) as unknown as Outline;

describe("bài giảng của bài học", () => {
  it("chọn thời lượng theo số từ", () => {
    expect(minutesForLesson(1500)).toBe(15);
    expect(minutesForLesson(3000)).toBe(30);
    expect(minutesForLesson(6000)).toBe(45);
    expect(countWords("một hai  ba\nbốn")).toBe(4);
  });

  it("yêu cầu nêu đủ: lời đọc cho tai nghe, chỉ trắc nghiệm, không bịa", () => {
    const t = lessonDeckIntent("Ảo giác AI");
    expect(t).toContain("Ảo giác AI");
    expect(t).toMatch(/lời đọc cho tai nghe/);
    expect(t).toMatch(/chỉ là câu trắc nghiệm tự kiểm tra/);
    expect(t).toMatch(/không nói đáp án/);
    expect(t).toMatch(/Không bịa/);
  });

  it("quizOnly đổi mọi slide tương tác khác thành trắc nghiệm, giữ nguyên slide nội dung", () => {
    const o = quizOnly(outline(["content", "poll", "word_cloud", "collaborate_board", "whiteboard", "draw_it", "quiz", "content"]));
    expect(o.slides.map((s) => s.kind)).toEqual(["content", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "content"]);
    expect(o.slides[1]!.title).toBe("S s1");
  });

  it("mức tối thiểu của bài học là 3 câu, 1 loại", () => {
    const gap = interactionGap(outline(["content", "quiz", "content"]), 15, SELF_CHECK_TARGET);
    expect(gap).toMatchObject({ count: 1, need: 2, needKinds: 0 });
    expect(interactionGap(outline(["content", "quiz", "quiz", "quiz"]), 15, SELF_CHECK_TARGET).need).toBe(0);
    // Cách thường vẫn đòi 5 slide và 3 loại.
    expect(interactionGap(outline(["content", "quiz", "quiz", "quiz"]), 15).need).toBeGreaterThan(0);
  });

  it("cảnh báo theo mức tự kiểm tra, không nhắc bình chọn hay đám mây từ", () => {
    const warns = outlineWarnings(outline(["content", "content", "content", "content", "content", "quiz", "content"]), 15, { selfCheck: true });
    const text = warns.join("\n");
    expect(text).toMatch(/ít nhất 3 slide tương tác/);
    expect(text).not.toMatch(/bình chọn|đám mây/);
  });

  it("mức slide của bài học là 12–16 cho 15 phút; bài giảng dạy trực tiếp giữ mức cũ", () => {
    expect(slideRange(15, true)).toEqual({ min: 12, max: 16 });
    expect(slideRange(15)).toEqual({ min: 9, max: 12 });
    expect(reviseRange(15, true).max).toBe(16);
    expect(reviseRange(15).max).toBe(12);
  });

  it("dàn ý ít hơn mức thì nhắc theo mức của bài học", () => {
    const w = outlineWarnings(outline(["content", "content", "quiz", "content", "quiz", "quiz", "content", "content"]), 15, { selfCheck: true });
    expect(w.join("\n")).toMatch(/ít hơn mức gợi ý 12 đến 16 slide/);
  });

  it("ước lượng token tăng theo độ dài bài (có trần 24.000 ký tự) và định dạng số dễ đọc", () => {
    const short = estimateLessonDeckTokens(3000);
    const long = estimateLessonDeckTokens(20000);
    const capped = estimateLessonDeckTokens(90000);
    expect(long).toBeGreaterThan(short);
    expect(capped).toBe(estimateLessonDeckTokens(24000));
    expect(short).toBeGreaterThan(5000);
    expect(formatTokenCount(15300)).toBe("15,3 nghìn");
    expect(formatTokenCount(850)).toBe("850");
  });
});
