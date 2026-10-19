import { AiGenerationError, AiTutorError, generateTeacherAssistantReply, getTokenBudget } from "@feedbackme/core-feedback";
import { requireInstructor } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import {
  ASSISTANT_DESTINATIONS,
  CHAT_MESSAGE_MAX,
  courseDestinations,
  describeSituation,
  normalizeAssistantReply,
  sanitizeChatHistory,
} from "@/lib/teacherAssistant";
import { loadAssistantContext } from "@/lib/teacherAssistantContext";
import { ASSISTANT_LIMITS, selectGuides } from "@/lib/teacherAssistantGuide";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Ước lượng token một lượt (danh mục điểm đến + hướng dẫn + tình hình + lịch sử + trả lời) để hiện số lượt còn lại. */
const TOKENS_PER_TURN = 4000;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST /api/instructor/assistant
 * Body: { message: string (1–500 ký tự), history?: [{ role: "user" | "assistant", text }] }
 * Một lượt trò chuyện với Limio ở trang chủ giảng viên. Trả { result: { reply, actions, followUps }, remainingTurns }.
 * `actions` đã được ánh xạ về danh mục điểm đến (đường dẫn không bao giờ do mô hình quyết định). Không ghi gì vào DB
 * ngoài sổ dùng AI; cuộc trò chuyện không được lưu. Tình hình giảng viên do server tự đọc, không nhận từ trình duyệt.
 */
export async function POST(req: Request) {
  const userId = await requireInstructor();
  if (!userId) return json({ error: "forbidden" }, 403);

  const body = (await readJson(req)) as { message?: unknown; history?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > CHAT_MESSAGE_MAX) return json({ error: "validation_failed", details: "message" }, 400);
  const history = sanitizeChatHistory(body?.history);

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return json({ error: "openai_not_configured" }, 503);
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
        guides: guides.map(({ title, body }) => ({ title, body })),
        limits: ASSISTANT_LIMITS,
        history,
        message,
      },
      openai,
    );
    const budget = await getTokenBudget(userId).catch(() => null);
    return json({ result: normalizeAssistantReply(raw, courseDests), remainingTurns: budget ? Math.floor(budget.total / TOKENS_PER_TURN) : null }, 200);
  } catch (e) {
    if (e instanceof AiTutorError) return json({ error: e.code, details: e.details }, 429);
    if (e instanceof AiGenerationError) return json({ error: e.code === "validation_failed" ? "validation_failed" : "assistant_failed" }, e.code === "validation_failed" ? 400 : 502);
    throw e;
  }
}
