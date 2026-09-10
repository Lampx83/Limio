export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 30;

// Trần cứng, không cấu hình được. Mỗi participant giữ 1 connection Redis
// riêng để nghe SSE suốt ván (XREAD BLOCK — xem lib/realtime/stream.ts),
// nên 1 phòng quá đông sẽ ăn hết connection Redis của cả server.
export const MAX_PARTICIPANTS_PER_SESSION = 300;

// Loại câu hỏi hỗ trợ chấm tức thì theo tốc độ — xem quyết định phạm vi MVP.
export const ELIGIBLE_QUESTION_TYPES = ["mcq", "true_false"] as const;
