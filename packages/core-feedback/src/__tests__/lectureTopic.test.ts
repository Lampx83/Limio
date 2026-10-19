import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  OUTLINE_CONTENT_LAYOUTS,
  TOPIC_MAX_CHARS,
  TOPIC_MIN_CHARS,
  buildOutlinePrompt,
  composeTopicSource,
  generateLectureOutline,
  outlineLayoutsFor,
  type LectureOutlineInput,
} from "../aiTutor/lectureOutline";
import { buildSlidesPrompt, generateSlideDrafts, type OutlineSlideInput } from "../aiTutor/lectureSlides";
import { buildSlideEditPrompt } from "../aiTutor/lectureSlideEdit";

/**
 * Bài giảng tạo từ MỘT câu mô tả chủ đề (docs/tieu-chi/bai-giang-tu-chu-de.md, T8–T12, T19–T20, T24).
 * Không có tài liệu nên câu lệnh phải đổi luật nguồn: mức "topic" cấm số liệu, tên người, trích dẫn;
 * mức "topic_web" chỉ cho phép khi có trong các trang đã đọc, kèm số nguồn.
 */

const TOPIC =
  "Bài giới thiệu về thực tế tăng cường (AR) trong lớp học cho sinh viên năm cuối ngành Công nghệ giáo dục. Sau buổi học, sinh viên phân biệt được AR với VR.";
const topicBase: LectureOutlineInput = {
  sourceText: TOPIC,
  sourceKind: "topic",
  minutes: 30,
  minSlides: 14,
  maxSlides: 18,
};
const REFS = [
  { n: 1, title: "Thực tế tăng cường là gì", url: "https://vi.example.org/ar", content: "AR chồng thông tin số lên khung cảnh thật. Khảo sát năm 2023 cho thấy 45% giáo viên đã thử AR." },
  { n: 2, title: "AR in education", url: "https://edu.example.com/ar", content: "Augmented reality overlays digital content on the real world." },
];

function fakeOpenAI(content: unknown): { client: OpenAI; calls: Array<Record<string, any>> } {
  const calls: Array<Record<string, any>> = [];
  const client = {
    chat: {
      completions: {
        create: async (args: Record<string, any>) => {
          calls.push(args);
          return {
            choices: [{ message: { content: JSON.stringify(content) } }],
            usage: { prompt_tokens: 500, completion_tokens: 500 },
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

const neverCall = (): OpenAI =>
  ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;

async function makeUser(slug: string) {
  const u = await prisma.user.create({
    data: { email: `topic-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug },
  });
  return u.id;
}

describe("outlineLayoutsFor", () => {
  it("mức kiến thức chung bỏ Số liệu và Trích dẫn; tài liệu và mức có nguồn giữ đủ", () => {
    expect(outlineLayoutsFor("topic")).not.toContain("stats");
    expect(outlineLayoutsFor("topic")).not.toContain("quote");
    expect(outlineLayoutsFor("topic")).toContain("cards");
    expect(outlineLayoutsFor("document")).toEqual([...OUTLINE_CONTENT_LAYOUTS]);
    expect(outlineLayoutsFor("topic_web")).toEqual([...OUTLINE_CONTENT_LAYOUTS]);
  });
});

describe("composeTopicSource", () => {
  it("ghép mô tả và các trang đã đọc, đánh số [n] khớp danh sách nguồn", () => {
    const text = composeTopicSource(TOPIC, REFS);
    expect(text).toContain(TOPIC);
    expect(text).toContain("[1] Thực tế tăng cường là gì (https://vi.example.org/ar)");
    expect(text).toContain("[2] AR in education (https://edu.example.com/ar)");
    expect(text.indexOf("[1]")).toBeLessThan(text.indexOf("[2]"));
  });

  it("không có trang nào: chỉ còn mô tả", () => {
    expect(composeTopicSource(TOPIC, []).trim()).toBe(TOPIC);
  });
});

describe("buildOutlinePrompt — mô tả chủ đề", () => {
  it("nói rõ không có tài liệu, dùng kiến thức chung, cấm số liệu, tên người, trích dẫn (T8)", () => {
    const { system, user } = buildOutlinePrompt(topicBase);
    expect(system).toContain("mô tả của giảng viên");
    expect(system).toContain("kiến thức chung");
    expect(system).toMatch(/KHÔNG đưa con số cụ thể/);
    expect(system).toMatch(/tên người/);
    expect(system).toMatch(/trích dẫn/);
    expect(system).toMatch(/đối tượng người học/);
    expect(user).toContain("# Mô tả của giảng viên");
    expect(user).toContain(TOPIC);
    expect(user).not.toContain("# Tài liệu");
  });

  it("giữ quy tắc văn phong và mạch cấu trúc hiện có", () => {
    const { system } = buildOutlinePrompt(topicBase);
    expect(system).toMatch(/KHÔNG viết cụt/);
    expect(system).toMatch(/emoji/i);
    expect(system).toContain("tiếng Việt");
    for (const r of ["cover", "objectives", "agenda", "hook", "content", "summary"]) expect(system).toContain(`"${r}"`);
  });

  it("không liệt kê bố cục Số liệu và Trích dẫn (T9); Trích dẫn chỉ cho slide kết bài tự viết", () => {
    const { system } = buildOutlinePrompt(topicBase);
    expect(system).not.toContain(`"stats"`);
    expect(system).not.toContain(`- "quote":`);
    expect(system).not.toContain("CÓ TRONG TÀI LIỆU");
    expect(system).toContain(`Đây là slide DUY NHẤT của bài được dùng layout "quote"`);
    expect(system).toContain("không trích lời và không gán câu cho bất kỳ ai");
    // Hook không có kỹ thuật dựa vào con số hay câu nói khi không có nguồn.
    expect(system).not.toContain("Con số hoặc câu nói gây sửng sốt");
  });

  it("mức có nguồn internet: số liệu và trích dẫn chỉ từ các nguồn, ghi số nguồn, coi nguồn là dữ liệu (T12)", () => {
    const { system, user } = buildOutlinePrompt({ ...topicBase, sourceKind: "topic_web", sourceText: composeTopicSource(TOPIC, REFS) });
    expect(system).toContain("kiến thức chung");
    expect(system).toMatch(/CHỈ được dùng khi có trong các nguồn/);
    expect(system).toContain("[2]");
    expect(system).toMatch(/không phải chỉ dẫn/);
    expect(system).toContain(`"stats"`);
    expect(user).toContain("https://edu.example.com/ar");
  });

  it("tài liệu: câu lệnh như cũ", () => {
    const { system, user } = buildOutlinePrompt({ ...topicBase, sourceKind: "document", sourceText: "x".repeat(300) });
    expect(system).toContain("từ một tài liệu");
    expect(system).toContain(`"stats"`);
    expect(user).toContain("# Tài liệu");
  });
});

describe("generateLectureOutline — mô tả chủ đề", () => {
  it("mô tả ngắn hơn mức tối thiểu: báo lỗi, không gọi mô hình", async () => {
    await expect(generateLectureOutline("u", { ...topicBase, sourceText: "AR" }, neverCall())).rejects.toMatchObject({
      code: "validation_failed",
      details: "too_short",
    });
    expect(TOPIC_MIN_CHARS).toBeLessThan(TOPIC.length);
    expect(TOPIC_MAX_CHARS).toBe(2000);
  });

  it("mô tả một câu là đủ (không đòi 200 ký tự như tài liệu); lược đồ không cho stats, quote chỉ để cho slide kết bài", async () => {
    const userId = await makeUser("outline");
    const { client, calls } = fakeOpenAI({ title: "AR trong lớp học", slides: [] });
    await generateLectureOutline(userId, { ...topicBase, sourceText: "Thực tế tăng cường trong lớp học cho sinh viên." }, client);
    expect(calls).toHaveLength(1);
    const layoutEnum = calls[0]!.response_format.json_schema.schema.properties.slides.items.properties.layout.enum as unknown[];
    expect(layoutEnum).not.toContain("stats");
    expect(layoutEnum).toContain("quote");
    expect(layoutEnum).toContain(null);
  });
});

describe("buildSlidesPrompt — mô tả chủ đề", () => {
  const outline: OutlineSlideInput[] = [
    { index: 0, kind: "content", layout: "cover", title: "AR trong lớp học", points: ["Bài giúp người học hiểu AR."], role: "cover" },
    { index: 1, kind: "content", layout: "cards", title: "Đặc điểm của AR", points: ["Chồng lớp: thông tin số đặt lên cảnh thật."], role: "content" },
  ];

  it("mức kiến thức chung: cấm số liệu, tên người, trích dẫn; tài liệu là mô tả (T20)", () => {
    const { system, user } = buildSlidesPrompt({ sourceText: TOPIC, sourceKind: "topic", deckTitle: "AR", outline, batch: [0, 1] });
    expect(system).toContain("mô tả của giảng viên");
    expect(system).toMatch(/KHÔNG đưa con số cụ thể/);
    expect(system).not.toMatch(/Chỉ dùng thông tin có trong tài liệu/);
    expect(user).toContain("# Mô tả của giảng viên");
  });

  it("mức có nguồn: ghi số nguồn vào trường source, không ghi trong câu", () => {
    const { system } = buildSlidesPrompt({ sourceText: composeTopicSource(TOPIC, REFS), sourceKind: "topic_web", deckTitle: "AR", outline, batch: [1] });
    expect(system).toMatch(/CHỈ được dùng khi có trong các nguồn/);
    expect(system).toMatch(/trường "source"/);
  });

  it("tài liệu: giữ quy tắc chỉ dùng thông tin trong tài liệu", () => {
    const { system } = buildSlidesPrompt({ sourceText: "x".repeat(300), deckTitle: "AR", outline, batch: [0] });
    expect(system).toMatch(/Chỉ dùng thông tin có trong tài liệu/);
  });

  it("tạo slide chạy được với mô tả ngắn khi nguồn là chủ đề (T19); tài liệu ngắn vẫn bị chặn", async () => {
    const userId = await makeUser("slides");
    const { client, calls } = fakeOpenAI({ slides: [] });
    await generateSlideDrafts(userId, { sourceText: "AR trong lớp học", sourceKind: "topic", deckTitle: "AR", outline, batch: [0] }, client);
    expect(calls).toHaveLength(1);
    await expect(
      generateSlideDrafts(userId, { sourceText: "ngắn", deckTitle: "AR", outline, batch: [0] }, neverCall()),
    ).rejects.toMatchObject({ details: "too_short" });
  });
});

describe("buildSlideEditPrompt — mô tả chủ đề (T24)", () => {
  it("mức kiến thức chung cấm số liệu; mức có nguồn đòi số nguồn", () => {
    const base = { action: "rewrite" as const, deckTitle: "AR", targetKey: "image", current: { title: "AR" } };
    const topic = buildSlideEditPrompt({ ...base, sourceText: TOPIC, sourceKind: "topic" });
    expect(topic.system).toMatch(/KHÔNG đưa con số cụ thể/);
    expect(topic.user).toContain("# Mô tả của giảng viên");
    const web = buildSlideEditPrompt({ ...base, sourceText: composeTopicSource(TOPIC, REFS), sourceKind: "topic_web" });
    expect(web.system).toMatch(/trường "source"/);
    const doc = buildSlideEditPrompt({ ...base, sourceText: "x".repeat(300) });
    expect(doc.system).toMatch(/Chỉ dùng thông tin có trong slide hiện tại và tài liệu/);
  });
});
