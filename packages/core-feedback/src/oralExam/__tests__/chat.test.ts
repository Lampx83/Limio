import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { GRADING_MAX_OUTPUT_TOKENS, openAiChatCompute } from "../chat";

// Giả OpenAI: ghi lại tham số và trả một luồng rỗng.
function fakeOpenAi() {
  const calls: Record<string, unknown>[] = [];
  const client = {
    chat: {
      completions: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return (async function* () {
            yield { choices: [{ delta: { content: "x" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } };
          })();
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

describe("openAiChatCompute — giới hạn đầu ra", () => {
  it("lượt hỏi của giám khảo giữ giới hạn ngắn mặc định (500)", async () => {
    const { client, calls } = fakeOpenAi();
    await openAiChatCompute(client)([{ role: "system", content: "hi" }]);
    expect(calls[0]!.max_tokens).toBe(500);
  });

  it("chấm điểm dùng giới hạn riêng đủ chứa khối JSON kèm phân tích từng chủ đề", async () => {
    const { client, calls } = fakeOpenAi();
    await openAiChatCompute(client, undefined, { maxTokens: GRADING_MAX_OUTPUT_TOKENS })([{ role: "system", content: "hi" }]);
    expect(calls[0]!.max_tokens).toBe(GRADING_MAX_OUTPUT_TOKENS);
    expect(GRADING_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(2000);
  });
});
