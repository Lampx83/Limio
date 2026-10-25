import {
  AiGenerationError,
  AiTutorError,
  generateSlideEdit,
  SLIDE_EDIT_ACTIONS,
  SLIDE_EDIT_INSTRUCTION_MAX,
  SLIDE_EDIT_INSTRUCTION_MIN,
} from "@feedbackme/core-feedback";
import { deckAccessWhere } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { resolveDeckLanguage } from "@/lib/limioLiveLanguageServer";
import { getOpenaiClient } from "@/lib/openaiClient";
import { proposalFromDraft, type SlideDraft, type SlideEditAction } from "@/lib/limioLiveGenerate";
import { pickMeta, resolveLayout } from "@/lib/limioLiveSlides";
import { resolveSourceKind, sanitizeOutline, sanitizeRefs } from "@/lib/limioLiveOutline";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides/[slideId]/ai-edit
 * Body: { action: "shorter" | "example" | "simpler" | "to_quiz" | "rewrite" | "custom", instruction? }
 * "custom": `instruction` là yêu cầu giảng viên gõ (3–500 ký tự).
 * Trả ĐỀ XUẤT thay thế cho slide ({type, config}); KHÔNG ghi gì vào slide. Giảng viên xem bản so
 * sánh rồi chấp nhận qua PATCH slide với source:"ai". Chỉ áp cho slide Nội dung có bố cục mới.
 */
export async function POST(req: Request, { params }: { params: { deckId: string; slideId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return json({ error: "forbidden" }, 403);

  const body = (await readJson(req)) as { action?: unknown; instruction?: unknown } | null;
  const action = body?.action;
  if (typeof action !== "string" || !(SLIDE_EDIT_ACTIONS as readonly string[]).includes(action)) {
    return json({ error: "validation_failed", details: "action" }, 400);
  }
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (action === "custom" && (instruction.length < SLIDE_EDIT_INSTRUCTION_MIN || instruction.length > SLIDE_EDIT_INSTRUCTION_MAX)) {
    return json({ error: "validation_failed", details: "instruction" }, 400);
  }

  const slide = await prisma.liveSlide.findFirst({
    where: { id: params.slideId, deckId: params.deckId, deck: deckAccessWhere(userId) },
    select: { type: true, config: true, deck: { select: { title: true, sourceText: true, sourceKind: true, sourceRefs: true, outline: true } } },
  });
  if (!slide) return json({ error: "not_found" }, 404);

  const config = (slide.config ?? {}) as Record<string, unknown>;
  if (slide.type !== "content" || resolveLayout(config) === "classic" || config.resource) {
    return json({ error: "unsupported_slide" }, 400);
  }
  const layout = resolveLayout(config);

  // "rewrite" cần dòng dàn ý gốc của slide.
  let outlineTitle: string | undefined;
  let outlinePoints: string[] | undefined;
  if (action === "rewrite") {
    const row = sanitizeOutline(slide.deck.outline).slides.find((s) => s.id === config.outlineId);
    if (!row) return json({ error: "no_outline_row" }, 400);
    outlineTitle = row.title;
    outlinePoints = row.points;
  }

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return json({ error: "openai_not_configured" }, 503);
    throw e;
  }

  // Nội dung hiện tại gửi cho AI: bỏ các khoá meta (ghi chú, ẩn, dấu vết).
  const meta = pickMeta(config);
  const current = Object.fromEntries(Object.entries(config).filter(([k]) => !(k in meta) && k !== "presenterNote"));

  const sourceKind = resolveSourceKind(slide.deck.sourceKind);
  const sourceText = slide.deck.sourceText ?? "";
  // Slide trống vẫn viết theo ngôn ngữ của bài (docs/tieu-chi/ngon-ngu-slide.md, L9).
  const language = await resolveDeckLanguage(params.deckId);
  try {
    const draft = await generateSlideEdit(
      userId,
      {
        action: action as SlideEditAction,
        sourceText,
        sourceKind,
        deckTitle: slide.deck.title,
        targetKey: action === "to_quiz" ? "quiz" : layout,
        current,
        outlineTitle,
        outlinePoints,
        ...(action === "custom" ? { instruction } : {}),
        language,
      },
      openai,
    );
    // Bài từ mô tả chủ đề: cùng kiểm tra con số và số nguồn như lúc tạo slide.
    const proposal = proposalFromDraft(action as SlideEditAction, { config }, draft as SlideDraft, {
      sourceKind,
      sourceText,
      refs: sanitizeRefs(slide.deck.sourceRefs),
      lang: language,
    });
    // Bản nháp không đủ cho bố cục đích (kể cả sau khi lấp phần giữ nguyên từ slide hiện tại): nói rõ bố cục nào.
    if (!proposal) return json({ error: "ai_edit_incomplete", details: { layout: action === "to_quiz" ? "quiz" : layout } }, 502);
    await emitLiveEvent(userId, LearningEventType.LiveSlideAiEditProposed, { deckId: params.deckId, slideId: params.slideId, action });
    return json({ proposal }, 200);
  } catch (e) {
    if (e instanceof AiTutorError) return json({ error: e.code, details: e.details }, 429);
    if (e instanceof AiGenerationError) return json({ error: e.code === "validation_failed" ? "validation_failed" : "ai_edit_failed" }, e.code === "validation_failed" ? 400 : 502);
    throw e;
  }
}
