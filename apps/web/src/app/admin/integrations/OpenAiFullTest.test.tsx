import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OpenAiFullTest, { FullTestReport, type Report } from "./OpenAiFullTest";

const text = (h: string) => h.replace(/<[^>]+>/g, "");

const report: Report = {
  summary: [
    { label: "Vấn đáp bằng chữ", status: "warn", text: "Dùng được, nhưng chọn đoạn theo từ khoá." },
    { label: "Vấn đáp bằng giọng nói", status: "fail", text: "Không dùng được — Whisper chưa chạy." },
  ],
  results: [
    { id: "chat", label: "Chat (LLM)", usedFor: "mọi tính năng AI", ok: true, ms: 812, detail: "qwen3.5-35b-a3b-int4 · LLM tự host" },
    { id: "embeddings", label: "Embeddings", usedFor: "chọn đoạn tài liệu", ok: false, skipped: true, ms: 0, detail: "Chưa có OpenAI key" },
    {
      id: "stt",
      label: "Whisper (nghe)",
      usedFor: "vấn đáp bằng giọng nói: nhận dạng câu trả lời",
      ok: false,
      ms: 240,
      error: "403 You do not have access to this model.",
      hint: "Key thiếu quyền Whisper.",
    },
    { id: "tts", label: "TTS (đọc)", usedFor: "đọc câu hỏi", ok: true, ms: 530, detail: "tts-1 · 4096 byte" },
  ],
};

describe("FullTestReport", () => {
  const t = text(renderToStaticMarkup(<FullTestReport report={report} />));

  it("hiện câu trả lời chính: vấn đáp chữ / giọng nói dùng được hay không", () => {
    expect(t).toContain("Vấn đáp bằng chữ");
    expect(t).toContain("Dùng được, nhưng chọn đoạn theo từ khoá.");
    expect(t).toContain("Không dùng được — Whisper chưa chạy.");
  });

  it("mỗi khả năng có dấu ✓ / ✗ / – đúng trạng thái, kèm thời gian và chi tiết", () => {
    expect(t).toContain("✓ Chat (LLM)");
    expect(t).toContain("812 ms");
    expect(t).toContain("qwen3.5-35b-a3b-int4 · LLM tự host");
    expect(t).toContain("✗ Whisper (nghe)");
    expect(t).toContain("– Embeddings");
  });

  it("khả năng bị bỏ qua nói rõ lý do và không in '0 ms'", () => {
    expect(t).toContain("Bỏ qua — Chưa có OpenAI key");
    expect(t).not.toMatch(/(^|\D)0 ms/);
  });

  it("khả năng hỏng hiện mã lỗi, cách sửa và tính năng bị ảnh hưởng; khả năng ok thì không", () => {
    expect(t).toContain("403 You do not have access to this model.");
    expect(t).toContain("→ Key thiếu quyền Whisper.");
    expect(t).toContain("Ảnh hưởng: vấn đáp bằng giọng nói: nhận dạng câu trả lời");
    expect(t).not.toContain("Ảnh hưởng: mọi tính năng AI");
  });
});

describe("OpenAiFullTest", () => {
  it("ban đầu chỉ có nút, chưa có kết quả; đổi nhãn khi đang gõ key", () => {
    const idle = text(renderToStaticMarkup(<OpenAiFullTest value="" />));
    expect(idle).toContain("Test đầy đủ");
    expect(idle).not.toContain("(key đang gõ)");
    expect(idle).not.toContain("Vấn đáp bằng chữ");
    expect(text(renderToStaticMarkup(<OpenAiFullTest value="sk-abc" />))).toContain("Test đầy đủ (key đang gõ)");
  });
});
