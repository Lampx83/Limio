import { AiGenerationError, AiTutorError, readChartFromImage } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { getOpenaiClient } from "@/lib/openaiClient";
import { canRedraw, liveImageFile, sanitizeChartReading } from "@/lib/limioLiveChartFromImage";
import { liveSlideImageKeyFromFilename } from "@/lib/storage-keys";
import { resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (body: unknown, status: number) => Response.json(body, { status });
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides/[slideId]/chart-from-image
 * AI đọc số từ hình của slide Chữ và hình (docs/tieu-chi/bieu-do-kho-doc-pptx.md, V3–V4). Trả ĐỀ XUẤT
 * `{ reading }` đã qua kiểm, hoặc `{ error: "not_chart" | "too_many_labels" | "too_many_series" }`; KHÔNG ghi gì vào slide.
 * Hình chỉ đọc từ kho của Limio theo `imageUrl` của slide — không tải địa chỉ ngoài.
 */
export async function POST(_req: Request, { params }: { params: { deckId: string; slideId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return json({ error: "forbidden" }, 403);

  const slide = await prisma.liveSlide.findFirst({
    where: { id: params.slideId, deckId: params.deckId, deck: { userId } },
    select: { type: true, config: true },
  });
  if (!slide) return json({ error: "not_found" }, 404);
  const config = (slide.config ?? {}) as Record<string, unknown>;
  if (slide.type !== "content" || !canRedraw(config)) return json({ error: "unsupported_slide" }, 400);

  const file = liveImageFile(config.imageUrl)!;
  const key = liveSlideImageKeyFromFilename(file);
  const stored = key ? await resolveKey(key) : null;
  if (!stored) return json({ error: "image_not_found" }, 404);
  const data = new Uint8Array(await stored.get());
  const mime = MIME[(file.split(".").pop() ?? "").toLowerCase()] ?? "";

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return json({ error: "openai_not_configured" }, 503);
    throw e;
  }

  try {
    const raw = await readChartFromImage(userId, { mime, data }, typeof config.title === "string" ? config.title : "", openai);
    const res = sanitizeChartReading(raw);
    await emitLiveEvent(userId, LearningEventType.LiveSlideChartFromImageProposed, {
      deckId: params.deckId,
      slideId: params.slideId,
      outcome: res.ok ? "ok" : res.reason,
      labels: res.ok ? res.reading.labels.length : 0,
      estimated: res.ok ? res.reading.series.reduce((n, s) => n + s.values.filter((v, i) => v !== null && !s.printed[i]).length, 0) : 0,
    });
    return res.ok ? json({ reading: res.reading }, 200) : json({ error: res.reason }, 422);
  } catch (e) {
    if (e instanceof AiTutorError) return json({ error: e.code, details: e.details }, 429);
    if (e instanceof AiGenerationError) {
      if (e.code === "validation_failed") return json({ error: e.details ?? "validation_failed" }, 400);
      // JSON hỏng cũng là "không đọc được biểu đồ": giao diện báo như not_chart, slide giữ hình.
      return json({ error: e.code === "json_parse_failed" ? "not_chart" : "ai_failed" }, e.code === "json_parse_failed" ? 422 : 502);
    }
    throw e;
  }
}
