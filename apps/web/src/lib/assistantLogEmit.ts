import type { LearningEventType } from "@feedbackme/shared-types";
import { emitLiveEvent } from "./limioLiveEvents";

/**
 * Ghi sự kiện Lily. Chỉ phục vụ thống kê nên lỗi ghi không được làm hỏng lượt hỏi của giảng viên: emitLiveEvent đã bắt
 * lỗi và ghi vào log máy chủ. Có hàm riêng để chỗ gọi nói rõ đây là nhật ký Lily và để dễ đổi nơi lưu về sau.
 */
export function emitAssistantEvent(userId: string, type: LearningEventType, payload: object): Promise<void> {
  return emitLiveEvent(userId, type, payload as Record<string, unknown>);
}
