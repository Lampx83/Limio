import { LearningEventType } from "@feedbackme/shared-types";
import { requireInstructor } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { cleanCount, cleanEventBase, cleanLinkClick } from "@/lib/assistantLog";
import { emitAssistantEvent } from "@/lib/assistantLogEmit";

export const runtime = "nodejs";

/**
 * POST /api/instructor/assistant/events
 * Body: { type: "opened" | "link_clicked" | "reset", conversationId?, page?, ... }
 * Nhật ký các thao tác của giảng viên với Lily KHÔNG đi qua lượt hỏi (mở ngăn kéo, bấm liên kết Lily đưa, bắt đầu cuộc
 * trò chuyện mới). Trình duyệt gọi kiểu "gửi rồi quên" nên luôn trả 204, kể cả khi dữ liệu lạ bị bỏ: nhật ký không bao giờ
 * được làm chậm hay làm hỏng thao tác của giảng viên. Lượt hỏi được ghi ở /api/instructor/assistant.
 */
export async function POST(req: Request) {
  const userId = await requireInstructor();
  if (!userId) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const base = cleanEventBase(body);

  switch (body?.type) {
    case "opened":
      await emitAssistantEvent(userId, LearningEventType.AssistantDrawerOpened, { ...base, hasHistory: body.hasHistory === true });
      break;
    case "link_clicked": {
      const link = cleanLinkClick(body);
      if (link) await emitAssistantEvent(userId, LearningEventType.AssistantLinkClicked, { ...base, ...link });
      break;
    }
    case "reset":
      await emitAssistantEvent(userId, LearningEventType.AssistantConversationReset, { ...base, messageCount: cleanCount(body.messageCount) });
      break;
    default:
      return Response.json({ error: "validation_failed", details: "type" }, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
