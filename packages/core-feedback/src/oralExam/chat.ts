import type OpenAI from "openai";

// A6.3 — model rẻ cho hội thoại giám khảo, cùng lựa chọn với AI Tutor.
export const DEFAULT_EXAMINER_MODEL = "gpt-4o-mini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatComputeResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/** Nhận lịch sử hội thoại (system + turns), trả về nội dung + token dùng. */
export type ChatComputeFn = (
  messages: ChatMessage[],
  onDelta?: (delta: string) => void,
) => Promise<ChatComputeResult>;

/**
 * Adapter thật gọi OpenAI. Tách khỏi runOralExamTurn() (examinerChat.ts) —
 * cùng lý do với openAiEmbedCompute ở embeddings.ts: phần điều phối lượt hỏi
 * (đếm số câu, kiểm tra hết giờ, lưu DB) test được bằng compute fn giả,
 * không cần gọi OpenAI thật trong test.
 */
export function openAiChatCompute(
  openai: OpenAI,
  model: string = DEFAULT_EXAMINER_MODEL,
): ChatComputeFn {
  return async (messages, onDelta) => {
    let content = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.3,
      max_tokens: 500,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        content += delta;
        onDelta?.(delta);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }
    return { content, inputTokens, outputTokens };
  };
}
