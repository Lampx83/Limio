import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { CHART_FROM_IMAGE_MAX_BYTES, buildChartFromImageMessages, readChartFromImage } from "../aiTutor/chartFromImage";

/** AI đọc số từ hình biểu đồ (docs/tieu-chi/bieu-do-kho-doc-pptx.md, V3–V4). Chỉ trả JSON thô; web kiểm và đối chiếu. */

const img = { mime: "image/png", data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) };
const answer = { isChart: true, chartType: "bar", title: "T", unit: "%", labels: ["A", "B"], series: [{ name: "S", values: [1, 2], printed: [true, true] }] };

describe("đọc số từ hình biểu đồ", () => {
  it("tin nhắn gửi kèm ảnh dạng data URL; câu lệnh cấm bịa và đòi đánh dấu số ước lượng", () => {
    const { system, user } = buildChartFromImageMessages(img, "Tỉ lệ hoàn thành");
    expect(system).toMatch(/KHÔNG bịa/);
    expect(system).toContain("printed");
    expect(user).toEqual([
      { type: "text", text: expect.stringContaining("Tỉ lệ hoàn thành") },
      { type: "image_url", image_url: { url: `data:image/png;base64,${Buffer.from(img.data).toString("base64")}` } },
    ]);
  });

  it("ảnh quá lớn hoặc không phải ảnh: báo lỗi, không gọi mô hình", async () => {
    const never = { chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } } as unknown as OpenAI;
    await expect(readChartFromImage("u", { mime: "image/png", data: new Uint8Array(CHART_FROM_IMAGE_MAX_BYTES + 1) }, "", never)).rejects.toMatchObject({ code: "validation_failed", details: "image_too_large" });
    await expect(readChartFromImage("u", { mime: "application/pdf", data: img.data }, "", never)).rejects.toMatchObject({ code: "validation_failed", details: "image_type" });
  });

  it("thành công: gọi mô hình một lần với lược đồ JSON, ghi token, trả JSON thô", async () => {
    const u = await prisma.user.create({ data: { email: `chart-img-${Date.now()}@e.com`, passwordHash: "x", displayName: "c" } });
    const seen: Array<Record<string, any>> = [];
    const client = {
      chat: {
        completions: {
          create: async (req: Record<string, any>) => {
            seen.push(req);
            return { choices: [{ message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 336, completion_tokens: 154 } };
          },
        },
      },
    } as unknown as OpenAI;
    expect(await readChartFromImage(u.id, img, "T", client)).toEqual(answer);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.response_format.type).toBe("json_schema");
    expect(seen[0]!.temperature).toBe(0);
    const usage = await prisma.aiUsageLog.findMany({ where: { userId: u.id } });
    expect(usage.reduce((n, r) => n + r.tokensInput + r.tokensOutput, 0)).toBe(490);
  });

  it("mô hình trả chữ không phải JSON: lỗi json_parse_failed", async () => {
    const u = await prisma.user.create({ data: { email: `chart-img-bad-${Date.now()}@e.com`, passwordHash: "x", displayName: "c" } });
    const client = { chat: { completions: { create: async () => ({ choices: [{ message: { content: "Đây là biểu đồ cột." } }], usage: {} }) } } } as unknown as OpenAI;
    await expect(readChartFromImage(u.id, img, "", client)).rejects.toMatchObject({ code: "json_parse_failed" });
  });
});
