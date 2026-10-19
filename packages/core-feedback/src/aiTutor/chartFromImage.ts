import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError } from "./generators";

/**
 * AI đọc số từ hình chụp một biểu đồ (docs/tieu-chi/bieu-do-kho-doc-pptx.md, V3–V4). Chỉ trả JSON thô: phía web kiểm
 * (sanitizeChartReading) rồi đưa vào màn đối chiếu; số chỉ lên slide sau khi giảng viên đối chiếu từng dòng với hình.
 * Không bao giờ ghi vào slide.
 *
 * Mô hình chat tự host (Qwen3.5, vLLM) nhận ảnh qua `image_url` dạng data URL — đã kiểm 2026-10-18
 * (scripts/kiem-tra-llm-doc-anh.js: đúng 5/5 số trên biểu đồ cột mẫu, khoảng 490 token).
 */

/** Ảnh lớn hơn chừng này không gửi: tốn token mà không đọc rõ hơn. */
export const CHART_FROM_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface ChartImage {
  mime: string;
  data: Uint8Array;
}

/** JSON thô AI trả về (chưa kiểm). */
export interface RawChartReading {
  isChart: boolean;
  chartType: string;
  title: string;
  unit: string;
  labels: string[];
  series: Array<{ name: string; values: Array<number | null>; printed: boolean[] }>;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isChart", "chartType", "title", "unit", "labels", "series"],
  properties: {
    isChart: { type: "boolean" },
    chartType: { type: "string", enum: ["bar", "hbar", "line", "pie", "donut", "other"] },
    title: { type: "string" },
    unit: { type: "string" },
    labels: { type: "array", items: { type: "string" } },
    series: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "values", "printed"],
        properties: {
          name: { type: "string" },
          values: { type: "array", items: { type: ["number", "null"] } },
          printed: { type: "array", items: { type: "boolean" } },
        },
      },
    },
  },
};

const SYSTEM = `Bạn chép lại số liệu từ hình chụp một biểu đồ để giảng viên đối chiếu. Trả về JSON đúng lược đồ.

Quy tắc:
1. Nếu hình không phải biểu đồ có số (ảnh chụp, sơ đồ, bảng chữ, hình minh hoạ) thì isChart = false, các trường khác để trống.
2. chartType: "bar" (cột dọc), "hbar" (thanh ngang), "line" (đường hoặc vùng), "pie" (tròn), "donut" (vành khuyên), "other" (loại khác).
3. labels: nhãn trên trục danh mục (hoặc chú giải của biểu đồ tròn) theo đúng thứ tự trên hình, chép nguyên chữ.
4. series: mỗi chuỗi số một mục; name là tên trong chú giải (không có thì để trống). values[i] ứng với labels[i].
5. KHÔNG bịa số. Số ghi trên hình (nhãn dữ liệu) thì chép đúng từng chữ số, printed[i] = true.
   Hình không ghi số thì ước lượng theo vạch chia của trục, printed[i] = false. Không đọc được thì để null.
6. Số viết bằng dấu chấm thập phân trong JSON (71,5 trên hình → 71.5). Phần trăm ghi số đã nhân 100 (62% → 62) và unit = "%".
7. unit: đơn vị ghi trên hình (%, điểm, người…), không có thì để trống. title: tiêu đề ghi trên hình, không có thì để trống.`;

export function buildChartFromImageMessages(img: ChartImage, slideTitle: string): {
  system: string;
  user: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
} {
  const url = `data:${img.mime};base64,${Buffer.from(img.data).toString("base64")}`;
  const hint = slideTitle.trim() ? `Slide chứa hình có tiêu đề: "${slideTitle.trim().slice(0, 200)}".\n` : "";
  return {
    system: SYSTEM,
    user: [
      { type: "text", text: `${hint}Chép số liệu của biểu đồ trong hình.` },
      { type: "image_url", image_url: { url } },
    ],
  };
}

export async function readChartFromImage(
  userId: string,
  img: ChartImage,
  slideTitle: string,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<RawChartReading> {
  if (!IMAGE_TYPES.has(img.mime)) throw new AiGenerationError("validation_failed", "image_type");
  if (img.data.length > CHART_FROM_IMAGE_MAX_BYTES) throw new AiGenerationError("validation_failed", "image_too_large");
  // Như mọi generator: hết hạn mức thì dừng trước khi chạm mô hình.
  await assertWithinCaps(userId, db, "generator");

  const { system, user } = buildChartFromImageMessages(img, slideTitle);
  let content = "";
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "chart_from_image", strict: true, schema: SCHEMA } },
      temperature: 0,
      max_tokens: 1500,
    });
    content = res.choices[0]?.message?.content ?? "";
    inputTokens = res.usage?.prompt_tokens ?? 0;
    outputTokens = res.usage?.completion_tokens ?? 0;
  } catch (e) {
    throw new AiGenerationError("openai_error", (e as Error).message);
  }
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);
  try {
    return JSON.parse(content) as RawChartReading;
  } catch {
    throw new AiGenerationError("json_parse_failed", content.slice(0, 200));
  }
}
