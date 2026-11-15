import { describe, expect, it } from "vitest";
import { expandExamQuestion } from "../practice-spec";
import { applyPromptAid, normalizeAid } from "../prompt-aid";

const map = { "你好吗？": { reading: " Nǐ hǎo ma? ", translation: "How are you?" }, "再见": { reading: "Zàijiàn" } };

describe("applyPromptAid", () => {
  it("thêm chú giải theo đề, giữ phần cấu hình còn lại, không sửa bản cũ", () => {
    const cfg = { options: [{ id: "o1" }], explanation: "x" };
    const r = applyPromptAid(cfg, " 你好吗？ ", map);
    expect(r.status).toBe("added");
    expect(r.config).toEqual({ ...cfg, promptAid: { reading: "Nǐ hǎo ma?", translation: "How are you?" } });
    expect(cfg).not.toHaveProperty("promptAid");
  });
  it("câu đã có chú giải thì giữ nguyên, trừ khi --force", () => {
    const cfg = { promptAid: { reading: "tay" } };
    expect(applyPromptAid(cfg, "你好吗？", map).status).toBe("kept");
    expect(applyPromptAid(cfg, "你好吗？", map, true).config).toMatchObject({ promptAid: { reading: "Nǐ hǎo ma?" } });
  });
  it("đề không có trong bảng", () => {
    expect(applyPromptAid({}, "别的", map).status).toBe("none");
  });
  it("chỉ có phiên âm vẫn thêm được", () => {
    expect(applyPromptAid({}, "再见", map).config).toEqual({ promptAid: { reading: "Zàijiàn" } });
  });
  it("normalizeAid bỏ chuỗi rỗng", () => {
    expect(normalizeAid({ reading: " ", translation: "" })).toBeNull();
  });
});

describe("expandExamQuestion + promptReading/promptTranslation", () => {
  it("ghi promptAid vào config của mọi loại câu", () => {
    const q = { type: "essay", prompt: "你好吗？", promptReading: "Nǐ hǎo ma?", promptTranslation: "How are you?" } as never;
    expect(expandExamQuestion(q).config).toMatchObject({ promptAid: { reading: "Nǐ hǎo ma?", translation: "How are you?" } });
  });
  it("không có thì không thêm khoá", () => {
    expect(expandExamQuestion({ type: "essay", prompt: "x" } as never).config).not.toHaveProperty("promptAid");
  });
});
