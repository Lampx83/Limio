import { AiGenerationError, AiTutorError, generateSlideChat, getTokenBudget } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { resolveDeckLanguage } from "@/lib/limioLiveLanguageServer";
import { getOpenaiClient } from "@/lib/openaiClient";
import { CHAT_MESSAGE_MAX, normalizeChatReply, relevantExcerpt, sanitizeChatHistory } from "@/lib/limioLiveChat";
import { LAYOUT_META, pickMeta, resolveLayout } from "@/lib/limioLiveSlides";
import { resolveSourceKind, sanitizeOutline, sanitizeRefs } from "@/lib/limioLiveOutline";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Ước lượng token một lượt hỏi đáp (đoạn tài liệu, slide, lịch sử, câu trả lời kèm bản nháp) để hiện số lượt còn lại. */
const TOKENS_PER_CHAT_TURN = 4000;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides/[slideId]/ai-chat
 * Body: { message: string (1–500 ký tự), history?: [{ role: "user" | "assistant", text }] }
 * Một lượt hỏi đáp với AI về slide. Trả { result, remainingTurns }: result là trả lời bằng lời (có thể kèm gợi ý sửa),
 * hỏi lại kèm 2–3 hướng, hoặc đề xuất sửa ({type, config}) đã qua proposalFromDraft. KHÔNG ghi gì vào slide;
 * giảng viên Áp dụng đề xuất qua PATCH slide với source:"ai" như các nút Nhờ AI khác. Cuộc trò chuyện không được lưu.
 */
export async function POST(req: Request, { params }: { params: { deckId: string; slideId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return json({ error: "forbidden" }, 403);

  const body = (await readJson(req)) as { message?: unknown; history?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > CHAT_MESSAGE_MAX) return json({ error: "validation_failed", details: "message" }, 400);
  const history = sanitizeChatHistory(body?.history);

  const slide = await prisma.liveSlide.findFirst({
    where: { id: params.slideId, deckId: params.deckId, deck: { userId } },
    select: { type: true, config: true, deck: { select: { title: true, sourceText: true, sourceKind: true, sourceRefs: true, outline: true } } },
  });
  if (!slide) return json({ error: "not_found" }, 404);

  const config = (slide.config ?? {}) as Record<string, unknown>;
  if (slide.type !== "content" || resolveLayout(config) === "classic" || config.resource) {
    return json({ error: "unsupported_slide" }, 400);
  }
  const layout = resolveLayout(config);
  const row = typeof config.outlineId === "string" ? sanitizeOutline(slide.deck.outline).slides.find((s) => s.id === config.outlineId) : undefined;

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return json({ error: "openai_not_configured" }, 503);
    throw e;
  }

  const meta = pickMeta(config);
  const current = Object.fromEntries(Object.entries(config).filter(([k]) => !(k in meta) && k !== "presenterNote"));
  const sourceKind = resolveSourceKind(slide.deck.sourceKind);
  const sourceText = slide.deck.sourceText ?? "";
  // Chỉ gửi các đoạn liên quan tới slide và câu hỏi, không gửi cả tài liệu mỗi lượt.
  const query = [row?.title, ...(row?.points ?? []), JSON.stringify(current), message].filter(Boolean).join(" ");
  const excerpt = relevantExcerpt(sourceText, query, sourceKind);
  // Bản nháp slide theo ngôn ngữ của bài; lời trả lời giảng viên vẫn bằng tiếng Việt (docs/tieu-chi/ngon-ngu-slide.md, L8).
  const language = await resolveDeckLanguage(params.deckId);

  try {
    const raw = await generateSlideChat(
      userId,
      {
        sourceText: excerpt,
        sourceKind,
        deckTitle: slide.deck.title,
        targetKey: layout,
        current,
        outlineTitle: row?.title,
        outlinePoints: row?.points,
        history,
        message,
        language,
      },
      openai,
    );
    const result = normalizeChatReply(raw, {
      current: { config },
      layoutLabel: LAYOUT_META[layout].label,
      ctx: { sourceKind, sourceText, refs: sanitizeRefs(slide.deck.sourceRefs), lang: language },
    });
    await emitLiveEvent(userId, LearningEventType.LiveSlideAiChatTurn, {
      deckId: params.deckId,
      slideId: params.slideId,
      kind: result.kind,
      historyTurns: history.length,
      hasSuggestion: result.kind === "answer" && !!result.suggestion,
    });
    const budget = await getTokenBudget(userId).catch(() => null);
    return json({ result, remainingTurns: budget ? Math.floor(budget.total / TOKENS_PER_CHAT_TURN) : null }, 200);
  } catch (e) {
    if (e instanceof AiTutorError) return json({ error: e.code, details: e.details }, 429);
    if (e instanceof AiGenerationError) return json({ error: e.code === "validation_failed" ? "validation_failed" : "ai_chat_failed" }, e.code === "validation_failed" ? 400 : 502);
    throw e;
  }
}
