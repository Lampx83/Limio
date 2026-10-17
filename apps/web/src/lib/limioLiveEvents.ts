import { emitEvent } from "@feedbackme/core-lms";
import { LearningEventType, type LearningEventType as EventType } from "@feedbackme/shared-types";

/**
 * Ghi sự kiện đo lường Limio-Live (H15). Sự kiện chỉ phục vụ thống kê nên lỗi ghi không được làm hỏng
 * thao tác của giảng viên: lưu lỗi vào log rồi đi tiếp.
 */
export async function emitLiveEvent(userId: string, type: EventType, payload: Record<string, unknown>): Promise<void> {
  try {
    await emitEvent(userId, type, payload);
  } catch (e) {
    console.error("[Limio-Live event]", type, e);
  }
}

export { LearningEventType };
