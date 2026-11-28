import type OpenAI from "openai";
import { DEFAULT_MODEL } from "../aiTutor/aiTutor";

// A6.3 — hội thoại giám khảo dùng cùng model chat với AI Tutor.
export const DEFAULT_EXAMINER_MODEL = DEFAULT_MODEL;

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

/** Lượt hỏi của giám khảo ngắn, nên giữ trần thấp. */
const EXAMINER_MAX_OUTPUT_TOKENS = 500;

/**
 * Trần đầu ra khi chấm điểm. Khối JSON gồm điểm, nhận xét và phân tích từng chủ đề/thuốc thường dài hơn 500 token;
 * bị cắt giữa chừng thì JSON hỏng, điểm thành null (sự cố chấm vấn đáp hàng loạt 28/11/2026: 13/21 lượt hỏng).
 */
export const GRADING_MAX_OUTPUT_TOKENS = 3000;

/**
 * Adapter thật gọi OpenAI. Tách khỏi runOralExamTurn() (examinerChat.ts) —
 * cùng lý do với openAiEmbedCompute ở embeddings.ts: phần điều phối lượt hỏi
 * (đếm số câu, kiểm tra hết giờ, lưu DB) test được bằng compute fn giả,
 * không cần gọi OpenAI thật trong test.
 */
export function openAiChatCompute(
  openai: OpenAI,
  model: string = DEFAULT_EXAMINER_MODEL,
  opts: { maxTokens?: number } = {},
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
      max_tokens: opts.maxTokens ?? EXAMINER_MAX_OUTPUT_TOKENS,
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
