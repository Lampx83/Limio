import type { AssistantEventBase, AssistantQuestionSource } from "@feedbackme/shared-types";

// Nhật ký cách giảng viên dùng Lily (sự kiện assistant.*). Phần thuần: kiểm tra những gì trình duyệt gửi lên. Mọi thứ do
// trình duyệt gửi đều là dữ liệu KHÔNG tin cậy (sửa được trong DevTools) nên chỉ nhận đúng dạng đã biết, còn lại bỏ.
// Phần ghi vào DB nằm ở assistantLogEmit.ts để module này test được mà không cần DB.

const SOURCES: readonly AssistantQuestionSource[] = ["typed", "suggestion", "followup"];
const CONVERSATION_ID = /^[A-Za-z0-9-]{8,64}$/;
const PAGE_MAX = 200;

/** Đường dẫn nội bộ không kèm query/hash; chuỗi lạ (không bắt đầu bằng một "/") thành null. */
export function cleanPage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const path = v.split(/[?#]/)[0]!.slice(0, PAGE_MAX);
  return /^\/(?!\/)[^\s\u0000-\u001f]*$/.test(path) ? path : null;
}

export function cleanConversationId(v: unknown): string | null {
  return typeof v === "string" && CONVERSATION_ID.test(v) ? v : null;
}

export function cleanSource(v: unknown): AssistantQuestionSource {
  return SOURCES.includes(v as AssistantQuestionSource) ? (v as AssistantQuestionSource) : "typed";
}

export function cleanEventBase(body: unknown): AssistantEventBase {
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return { conversationId: cleanConversationId(o.conversationId), page: cleanPage(o.page) };
}

const idText = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Mã điểm đến/đường dẫn do trình duyệt báo khi bấm liên kết; trả null nếu không dùng được. */
export function cleanLinkClick(body: unknown): { destinationId: string; href: string } | null {
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const destinationId = idText(o.destinationId, 80);
  const href = cleanPage(o.href);
  return destinationId && href ? { destinationId, href } : null;
}

/** Số tin đã có, ép về số nguyên không âm hợp lý. */
export function cleanCount(v: unknown, max = 100): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
}
