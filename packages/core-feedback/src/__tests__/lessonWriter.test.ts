import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import type { OutlineSection, SourcePara } from "@feedbackme/shared-types";
import { AI_EXAMPLE_BOX_TITLE, buildSectionPrompt, cleanSectionDraft, editLessonSection, writeLessonSection } from "../aiTutor/lessonWriter";

/** Mốc 3 — AI viết một mục từ dàn ý đã chốt (T1, T3). */

const PARAS: SourcePara[] = [
  { t: "Đoạn không thuộc mục." },
  { t: "Nguyên tắc gần nhau: các phần tử gần nhau là một nhóm." },
  { img: "/a.png", alt: "Ba nhóm ô vuông" },
];
const SECTION: OutlineSection = { id: "s", title: "Khái niệm", layout: "image", points: ["Gần nhau là một nhóm."], boxes: ["definition"], paras: [1, 2] };

function fake(payload: unknown, seen: { system?: string; user?: string } = {}): OpenAI {
  return {
    chat: {
      completions: {
        create: async (req: { messages: Array<{ content: string }> }) => {
          seen.system = req.messages[0]?.content;
          seen.user = req.messages[1]?.content;
          return { choices: [{ message: { content: JSON.stringify(payload) } }], usage: { prompt_tokens: 300, completion_tokens: 200 } };
        },
      },
    },
  } as unknown as OpenAI;
}

describe("lessonWriter", () => {
  it("lời nhắc chỉ đưa đúng các đoạn của mục, kèm ý chính, bố cục, hộp", () => {
    const prompt = buildSectionPrompt({ lessonTitle: "Bài", section: SECTION, paras: PARAS, writing: "keep" });
    expect(prompt).toContain("[2] Nguyên tắc gần nhau");
    expect(prompt).toContain("[3] [ẢNH: Ba nhóm ô vuông]");
    expect(prompt).not.toContain("Đoạn không thuộc mục");
    expect(prompt).toContain("Bố cục: image");
    expect(prompt).toContain("definition (Định nghĩa)");
  });

  it("cách viết đổi lời dặn: Giữ nguyên lời cấm viết thêm câu; Biên tập cho phép câu dẫn (T1)", async () => {
    const u = await prisma.user.create({ data: { email: `lw-${Date.now()}@e.com`, passwordHash: "x", displayName: "GV" } });
    const draft = { intro: ["Câu."], parts: [], boxes: [], imageCaption: "" };
    const keep: { system?: string } = {};
    await writeLessonSection(u.id, { lessonTitle: "Bài", section: SECTION, paras: PARAS, writing: "keep" }, fake(draft, keep));
    expect(keep.system).toContain("GIỮ NGUYÊN LỜI");
    const edit: { system?: string } = {};
    await writeLessonSection(u.id, { lessonTitle: "Bài", section: SECTION, paras: PARAS, writing: "edit" }, fake(draft, edit));
    expect(edit.system).toContain("BIÊN TẬP CHO MẠCH LẠC");
  });

  it("làm sạch đầu ra: bỏ phần rỗng, hộp lạ, hộp không chữ", () => {
    const d = cleanSectionDraft({
      intro: ["Một", "", 3],
      parts: [{ title: "", paragraphs: [], bullets: [] }, { title: "A", paragraphs: ["x"], bullets: ["y", ""] }],
      boxes: [{ kind: "quiz", title: "", paragraphs: ["x"] }, { kind: "note", title: "", paragraphs: [] }, { kind: "example", title: " Ví dụ ", paragraphs: ["z"] }],
      imageCaption: 5,
    });
    expect(d).toEqual({
      intro: ["Một"],
      parts: [{ title: "A", paragraphs: ["x"], bullets: ["y"] }],
      boxes: [{ kind: "example", title: "Ví dụ", paragraphs: ["z"] }],
      imageCaption: "",
    });
  });

  it("mục rỗng thì báo lỗi để bên gọi dùng bản dự phòng", async () => {
    const u = await prisma.user.create({ data: { email: `lw2-${Date.now()}@e.com`, passwordHash: "x", displayName: "GV" } });
    await expect(
      writeLessonSection(u.id, { lessonTitle: "Bài", section: SECTION, paras: PARAS, writing: "keep" }, fake({ intro: [], parts: [], boxes: [], imageCaption: "" })),
    ).rejects.toMatchObject({ code: "openai_error" });
  });

  it("Nhờ AI sửa mục: yêu cầu đúng việc; ví dụ AI thêm luôn mang nhãn 'AI gợi ý' (S2)", async () => {
    const u = await prisma.user.create({ data: { email: `lw3-${Date.now()}@e.com`, passwordHash: "x", displayName: "GV" } });
    const base = { lessonTitle: "Bài", title: "Khái niệm", layout: "text", intro: ["Câu gốc."], parts: [], boxes: [{ kind: "example", title: "Ví dụ", paragraphs: ["Ví dụ cũ."] }] };
    const seen: { system?: string; user?: string } = {};
    const out = await editLessonSection(
      u.id,
      { ...base, action: "example" },
      fake(
        {
          intro: ["Câu gốc."],
          parts: [],
          boxes: [
            { kind: "example", title: "Ví dụ", paragraphs: ["Ví dụ cũ."] },
            { kind: "example", title: "", paragraphs: ["Ví dụ mới."] },
          ],
          imageCaption: "",
        },
        seen,
      ),
    );
    expect(seen.system).toContain("THÊM đúng một ví dụ");
    expect(seen.user).toContain('"Câu gốc."');
    expect(out.boxes.map((b) => b.title)).toEqual(["Ví dụ", AI_EXAMPLE_BOX_TITLE]);

    const sp: { system?: string } = {};
    await editLessonSection(u.id, { ...base, action: "spelling" }, fake({ intro: ["Câu gốc."], parts: [], boxes: [], imageCaption: "" }, sp));
    expect(sp.system).toContain("Chỉ SỬA LỖI chính tả");
  });

  it("mục trống thì không gọi AI", async () => {
    let called = false;
    const openai = { chat: { completions: { create: async () => ((called = true), {}) } } } as unknown as OpenAI;
    await expect(
      editLessonSection("u", { lessonTitle: "", title: "x", layout: "text", intro: [], parts: [], boxes: [], action: "shorter" }, openai),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(called).toBe(false);
  });
});
