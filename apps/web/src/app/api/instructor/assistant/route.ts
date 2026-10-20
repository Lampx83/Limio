import { AiGenerationError, AiTutorError, generateTeacherAssistantReply, getTokenBudget } from "@feedbackme/core-feedback";
import { LearningEventType, type AssistantQuestionAskedPayload } from "@feedbackme/shared-types";
import { requireInstructor } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { cleanEventBase, cleanSource } from "@/lib/assistantLog";
import { emitAssistantEvent } from "@/lib/assistantLogEmit";
import {
  ASSISTANT_DESTINATIONS,
  CHAT_MESSAGE_MAX,
  courseDestinations,
  describeSituation,
  normalizeAssistantReply,
  sanitizeChatHistory,
} from "@/lib/teacherAssistant";
import { loadAssistantContext } from "@/lib/teacherAssistantContext";
import { containsTechLeak, declineReply, isTechnicalProbe } from "@/lib/teacherAssistantGuard";
import { ASSISTANT_LIMITS, pickIdeaSeeds, selectGuides } from "@/lib/teacherAssistantGuide";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Ước lượng token một lượt (danh mục điểm đến + hướng dẫn + tình hình + lịch sử + trả lời) để hiện số lượt còn lại. */
const TOKENS_PER_TURN = 4000;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST /api/instructor/assistant
 * Body: { message: string (1–500 ký tự), history?: [{ role: "user" | "assistant", text }],
 *         source?: "typed" | "suggestion" | "followup", conversationId?: string, page?: string }
 * `source`, `conversationId`, `page` chỉ để ghi nhật ký (sự kiện assistant.question.asked), không ảnh hưởng câu trả lời.
 * Một lượt trò chuyện với Limio ở trang chủ giảng viên. Trả { result: { reply, actions, followUps }, remainingTurns }.
 * `actions` đã được ánh xạ về danh mục điểm đến (đường dẫn không bao giờ do mô hình quyết định). Ngoài sổ dùng AI chỉ ghi
 * MỘT sự kiện assistant.question.asked mỗi lượt (có câu hỏi, không có câu trả lời); cuộc trò chuyện không được lưu. Tình hình giảng viên do server tự đọc, không nhận từ trình duyệt.
 */
export async function POST(req: Request) {
  const userId = await requireInstructor();
  if (!userId) return json({ error: "forbidden" }, 403);

  const startedAt = Date.now();
  const body = (await readJson(req)) as { message?: unknown; history?: unknown; source?: unknown; conversationId?: unknown; page?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > CHAT_MESSAGE_MAX) return json({ error: "validation_failed", details: "message" }, 400);
  const history = sanitizeChatHistory(body?.history);
  const base = cleanEventBase(body);
  const source = cleanSource(body?.source);
  /** Mỗi lượt hỏi ghi đúng một sự kiện, dù kết cục là gì: lượt bị từ chối hay lỗi cũng là tín hiệu cho kho hướng dẫn. */
  const record = (outcome: AssistantQuestionAskedPayload["outcome"], extra: Partial<AssistantQuestionAskedPayload> = {}) =>
    emitAssistantEvent(userId, LearningEventType.AssistantQuestionAsked, {
      ...base,
      source,
      text: message,
      historyTurns: history.length,
      outcome,
      guideTitles: [],
      actionIds: [],
      followUpCount: 0,
      latencyMs: Date.now() - startedAt,
      ...extra,
    } satisfies AssistantQuestionAskedPayload);

  // Dò hỏi thiết kế kỹ thuật/hạ tầng/CSDL/chỉ dẫn nội bộ: trả lời cố định, KHÔNG gọi mô hình (không tốn lượt, không dụ được).
  if (isTechnicalProbe(message)) {
    await record("declined_technical");
    return json({ result: declineReply("technical"), remainingTurns: null }, 200);
  }

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      await record("error", { errorCode: "openai_not_configured" });
      return json({ error: "openai_not_configured" }, 503);
    }
    throw e;
  }

  const ctx = await loadAssistantContext(userId);
  const courseDests = courseDestinations(ctx.courses);
  // Chỉ mang theo vài mục hướng dẫn liên quan tới câu hỏi (và các câu trước của giảng viên), không gửi cả kho mỗi lượt.
  const guides = selectGuides(
    message,
    history.filter((t) => t.role === "user").map((t) => t.text),
  );
  try {
    const raw = await generateTeacherAssistantReply(
      userId,
      {
        situation: describeSituation(ctx),
        destinations: [...ASSISTANT_DESTINATIONS, ...courseDests].map(({ id, label, description }) => ({ id, label, description })),
        guides: guides.map(({ title, body, destinationIds, useCases }) => ({ title, body, destinationIds, useCases })),
        // Chưa có mục hướng dẫn nào khớp (chào hỏi, chưa có ý tưởng): đưa vài tình huống dùng tính năng, xoay theo ngày và lượt.
        ideaSeeds: guides.length === 0 ? pickIdeaSeeds(Math.floor(Date.now() / 86_400_000) + history.length) : undefined,
        limits: ASSISTANT_LIMITS,
        history,
        message,
      },
      openai,
    );
    const budget = await getTokenBudget(userId).catch(() => null);
    const remainingTurns = budget ? Math.floor(budget.total / TOKENS_PER_TURN) : null;
    // Mô hình tự nhận câu hỏi ngoài nghiệp vụ Limio: dùng câu từ chối cố định thay vì lời của mô hình.
    if (raw.inScope === false) {
      await record("declined_off_topic", { guideTitles: guides.map((g) => g.title) });
      return json({ result: declineReply("off_topic"), remainingTurns }, 200);
    }
    const result = normalizeAssistantReply(raw, courseDests);
    // Lớp phòng thủ cuối: câu trả lời nhắc tên công nghệ/hạ tầng mà giảng viên chưa hề nhắc thì bỏ.
    const said = [message, ...history.filter((t) => t.role === "user").map((t) => t.text)];
    const guideTitles = guides.map((g) => g.title);
    if (containsTechLeak(result.reply, said)) {
      await record("declined_leak", { guideTitles });
      return json({ result: declineReply("technical"), remainingTurns }, 200);
    }
    await record("answered", { guideTitles, actionIds: result.actions.map((a) => a.id), followUpCount: result.followUps.length });
    return json({ result, remainingTurns }, 200);
  } catch (e) {
    if (e instanceof AiTutorError) {
      await record("error", { errorCode: e.code });
      return json({ error: e.code, details: e.details }, 429);
    }
    if (e instanceof AiGenerationError) {
      const errorCode = e.code === "validation_failed" ? "validation_failed" : "assistant_failed";
      await record("error", { errorCode });
      return json({ error: errorCode }, e.code === "validation_failed" ? 400 : 502);
    }
    await record("error", { errorCode: "internal" });
    throw e;
  }
}
