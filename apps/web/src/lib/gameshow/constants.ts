// MVP: mọi câu hỏi dùng chung 1 mốc thời gian trả lời (Quiz hiện không có
// field per-question time limit). Có thể tách theo quiz/question sau này.
export const QUESTION_TIME_LIMIT_MS = 20_000;

export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 30;

// Loại câu hỏi hỗ trợ chấm tức thì theo tốc độ — xem quyết định phạm vi MVP.
export const ELIGIBLE_QUESTION_TYPES = ["mcq", "true_false"] as const;
