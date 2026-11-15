import { describe, expect, it } from "vitest";
import type { PracticeEmbed } from "@feedbackme/core-lms";
import { hoistReadingPassages, dedupeHoisted } from "./practiceHoist";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC8: bài đọc dài là lý thuyết ở trên đầu. */
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const q = (id: string, passageId: string | null) => ({ id, type: "mcq", prompt: id, points: 1, passageId, sectionTitle: "s", languageSkill: null, config: {} });
const embed = (passages: PracticeEmbed["passages"], questions: PracticeEmbed["questions"]): PracticeEmbed => ({
  examId: "e1",
  title: "T",
  sessionId: null,
  checkEnabled: true,
  timed: false,
  questions,
  passages,
  answers: [],
});

describe("hoistReadingPassages", () => {
  const article = { id: "p1", title: "The world’s favourite drug", contentJson: { type: "doc", content: [para("Read the article again and answer the questions."), para(words(150)), para(words(60))] } };

  it("bài đọc dài: nội dung lên phần lý thuyết, đoạn trong khối chỉ còn đề bài", () => {
    const r = hoistReadingPassages(embed([article], [q("1", "p1"), q("2", "p1")]));
    expect(r.hoisted).toHaveLength(1);
    expect(r.hoisted[0]!.title).toBe("The world’s favourite drug");
    expect(JSON.stringify(r.hoisted[0]!.contentJson)).toContain("w149");
    expect(JSON.stringify(r.hoisted[0]!.contentJson)).not.toContain("Read the article again");
    expect(r.embed.passages[0]!.contentJson).toEqual({ type: "doc", content: [para("Read the article again and answer the questions.")] });
    expect(r.embed.passages[0]!.title).toBe("The world’s favourite drug");
    expect(r.embed.questions).toHaveLength(2);
  });

  it("đoạn ngắn, hoặc có audio: không đổi", () => {
    const short = { id: "p2", title: "1A", contentJson: { type: "doc", content: [para("Read."), para(words(60))] } };
    const audio = { id: "p3", title: "2A", contentJson: { type: "doc", content: [para("Listen."), para(words(200)), { type: "audio", attrs: { src: "/a.m4a" } }] } };
    const input = embed([short, audio], [q("1", "p2"), q("2", "p3")]);
    const r = hoistReadingPassages(input);
    expect(r.hoisted).toEqual([]);
    expect(r.embed).toBe(input);
  });

  it("đoạn dài không có đề bài: toàn bộ lên trên, đoạn trong khối rỗng", () => {
    const noInstr = { id: "p4", title: "Text", contentJson: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] }, para(words(200))] } };
    const r = hoistReadingPassages(embed([noInstr], [q("1", "p4")]));
    expect(r.hoisted).toHaveLength(1);
    expect(r.embed.passages[0]!.contentJson).toEqual({ type: "doc", content: [] });
  });

  it("đoạn không có câu hỏi nào thì không đụng tới", () => {
    const r = hoistReadingPassages(embed([article], [q("1", null)]));
    expect(r.hoisted).toEqual([]);
  });
});

describe("hoistReadingPassages — bài đọc dùng chung chỉ lên một lần (AC8)", () => {
  const texts = [para(words(60)), para(words(61) + " b"), para(words(62) + " c")].map((p, i) => ({ ...p, content: [{ type: "text", text: `Text ${i} ` + words(60 + i) }] }));
  const passage = (id: string, title: string, extra: unknown[] = []) => ({ id, title, contentJson: { type: "doc", content: [para("Instruction for " + id + "."), ...texts, ...extra] } });

  it("nhiều đoạn (7A, 7B) cùng chứa các đoạn văn giống nhau: lên MỘT lần, mọi đoạn trong khối chỉ còn đề bài và GIỮ tên exercise", () => {
    const e = embed([passage("a", "7A · Three lifestyles", [{ type: "image", attrs: { src: "/x.jpg" } }]), passage("b1", "7B · take and hand"), passage("b2", "7B · put, look and keep")], [q("1", "a"), q("2", "b1"), q("3", "b2")]);
    const r = hoistReadingPassages(e);
    expect(r.hoisted).toHaveLength(1);
    expect(r.hoisted[0]!.id).toBe("a");
    expect(r.embed.passages.map((p) => p.title)).toEqual(["7A · Three lifestyles", "7B · take and hand", "7B · put, look and keep"]);
    for (const p of r.embed.passages) expect((p.contentJson as { content: unknown[] }).content).toHaveLength(1);
  });

  it("đoạn dài khác nhau: lên cả hai", () => {
    const a = { id: "a", title: "1A", contentJson: { type: "doc", content: [para(words(150))] } };
    const b = { id: "b", title: "1B", contentJson: { type: "doc", content: [para("Other " + words(150))] } };
    expect(hoistReadingPassages(embed([a, b], [q("1", "a"), q("2", "b")])).hoisted).toHaveLength(2);
  });
});

describe("dedupeHoisted", () => {
  const h = (id: string, ...ps: string[]) => ({ id, title: id, contentJson: { type: "doc" as const, content: ps.map((t) => para(t)) } });
  it("đoạn mà mọi đoạn văn đã có trong đoạn trước thì bỏ; đoạn có nội dung mới thì giữ", () => {
    const long1 = words(50), long2 = "x " + words(50), long3 = "y " + words(50);
    const r = dedupeHoisted([h("a", long1, long2), h("b", long1), h("c", long2, long3)]);
    expect(r.map((x) => x.id)).toEqual(["a", "c"]);
  });
});

