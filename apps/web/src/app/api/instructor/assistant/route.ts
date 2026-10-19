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
import { containsTechLeak, declineReply, isTechnicalProbe } from "@/lib/teacherAssistantGuard";
import { ASSISTANT_LIMITS, pickIdeaSeeds, selectGuides } from "@/lib/teacherAssistantGuide";

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

  // Dò hỏi thiết kế kỹ thuật/hạ tầng/CSDL/chỉ dẫn nội bộ: trả lời cố định, KHÔNG gọi mô hình (không tốn lượt, không dụ được).
  if (isTechnicalProbe(message)) return json({ result: declineReply("technical"), remainingTurns: null }, 200);

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
    if (raw.inScope === false) return json({ result: declineReply("off_topic"), remainingTurns }, 200);
    const result = normalizeAssistantReply(raw, courseDests);
    // Lớp phòng thủ cuối: câu trả lời nhắc tên công nghệ/hạ tầng mà giảng viên chưa hề nhắc thì bỏ.
    const said = [message, ...history.filter((t) => t.role === "user").map((t) => t.text)];
    if (containsTechLeak(result.reply, said)) return json({ result: declineReply("technical"), remainingTurns }, 200);
    return json({ result, remainingTurns }, 200);
  } catch (e) {
    if (e instanceof AiTutorError) return json({ error: e.code, details: e.details }, 429);
    if (e instanceof AiGenerationError) return json({ error: e.code === "validation_failed" ? "validation_failed" : "assistant_failed" }, e.code === "validation_failed" ? 400 : 502);
    throw e;
  }
}
