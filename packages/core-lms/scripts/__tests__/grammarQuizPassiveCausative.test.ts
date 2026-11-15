import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CreateQuestionInput } from "../../src/quizzes/questions";
import { LessonSpec, expandQuestion } from "../import-course";

/**
 * Quiz cuối bài 1.1 Grammar (docs/tieu-chi/slide-giang-song-ngu.md, B1): 10 câu, mỗi phương án nhiễu gắn một lỗi tư duy
 * mã `en1.1.*`, và mỗi lỗi đều có lời phản hồi. Test giữ cho bộ quiz không lệch quy ước khi sửa tay.
 */
const FILE = path.resolve(import.meta.dirname, "../../../../docs/hoc-lieu/speakout-grammar-slide/quiz.json");
const data = JSON.parse(readFileSync(FILE, "utf8")) as {
  quiz: { title: string; questions: Array<{ key: string; type: string; prompt: string; explanation?: string; options?: Array<{ label: string; isCorrect: boolean; misconception?: string }>; answers?: string[]; sequence?: string[] }> };
  misconceptions: Array<{ code: string; name: string; description: string }>;
  feedbackTemplates: Array<{ misconception: string; body: string }>;
};

describe("quiz bài 1.1 Grammar (passive; causative have)", () => {
  const questions = data.quiz.questions;
  const codes = new Set(data.misconceptions.map((m) => m.code));

  it("đúng 10 câu, khoá câu duy nhất, mọi câu có lời giải", () => {
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((q) => q.key)).size).toBe(10);
    for (const q of questions) {
      expect(q.key).toMatch(/^en1\.1\.q\d\d$/);
      expect(q.explanation, q.key).toBeTruthy();
    }
  });

  it("mỗi phương án sai của câu chọn đều gắn một lỗi tư duy có khai báo; phương án đúng thì không gắn", () => {
    for (const q of questions.filter((x) => x.type === "mcq" || x.type === "true_false")) {
      const opts = q.options!;
      expect(opts.filter((o) => o.isCorrect), q.key).toHaveLength(1);
      for (const o of opts) {
        if (o.isCorrect) expect(o.misconception, `${q.key}: ${o.label}`).toBeUndefined();
        else {
          expect(o.misconception, `${q.key}: ${o.label}`).toBeTruthy();
          expect(codes.has(o.misconception!), `${q.key}: ${o.misconception}`).toBe(true);
        }
      }
    }
  });

  it("mã lỗi theo quy ước en1.1.*, mỗi lỗi đều được dùng và đều có đúng một lời phản hồi", () => {
    const used = new Set(questions.flatMap((q) => (q.options ?? []).map((o) => o.misconception).filter(Boolean)));
    for (const c of codes) {
      expect(c).toMatch(/^en1\.1\.[a-z-]+$/);
      expect(used.has(c), `lỗi ${c} không phương án nào dùng`).toBe(true);
      expect(data.feedbackTemplates.filter((t) => t.misconception === c), c).toHaveLength(1);
    }
    for (const t of data.feedbackTemplates) expect(codes.has(t.misconception), t.misconception).toBe(true);
  });

  it("câu điền và sắp xếp có đáp án, câu điền không đòi dấu câu (bộ chấm chỉ bỏ khoảng trắng và hoa thường)", () => {
    for (const q of questions.filter((x) => x.type === "fill_in")) {
      expect(q.answers!.length, q.key).toBeGreaterThan(0);
      for (const a of q.answers!) expect(a, q.key).toBe(a.trim().toLowerCase());
      for (const a of q.answers!) expect(a, q.key).not.toMatch(/[.,!?;:]/);
    }
    const ordering = questions.find((x) => x.type === "ordering")!;
    expect(ordering.sequence!.join(" ")).toBe("She had her passport photocopied yesterday");
  });

  it("lời giải không bịa: không nhắc tên sách hay bài của Speakout", () => {
    const all = JSON.stringify(data.quiz);
    expect(all).not.toMatch(/speakout|pearson/i);
  });

  it("nạp được qua schema của importer: LessonSpec hợp lệ và từng câu bung ra CreateQuestionInput hợp lệ", () => {
    const lesson = LessonSpec.parse({ title: "x", quiz: data.quiz });
    expect(lesson.quiz!.questions).toHaveLength(10);
    const mcIds = new Map([...codes].map((c, i) => [c, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`]));
    lesson.quiz!.questions.forEach((q, i) => {
      const parsed = CreateQuestionInput.parse(expandQuestion(q, i, mcIds));
      expect(parsed.prompt).toBe(q.prompt);
    });
  });
});
