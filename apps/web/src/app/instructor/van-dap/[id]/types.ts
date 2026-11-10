// Dạng dữ liệu màn soạn đề nhận qua JSON (khớp getVanDapExamForEditor trong core-lms; Date đã thành chuỗi).

export type Level = "basic" | "intermediate" | "advanced";

export interface ExamInfo {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  language: "vi" | "en" | "zh";
  durationMin: number;
  toneNote: string | null;
  rubricText: string | null;
  legacyPrompt: string | null;
  importedFromExamId: string | null;
}

export interface MaterialRow {
  id: string;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
  chars: number;
  orderIndex: number;
}

export interface ItemRow {
  id: string;
  orderIndex: number;
  core: string;
  sourceExcerpt: string;
  level: Level;
  expectedAnswer: string;
  maxFollowUps: number;
}

export interface ScenarioRow {
  id: string;
  orderIndex: number;
  title: string;
  aiContext: string;
  studentBrief: string | null;
}

export interface QuestionMapData {
  capacity: number;
  rows: Array<{ id: string; position: number; core: string; level: string; covered: boolean; estimatedQuestions: number }>;
  coveredCount: number;
  uncoveredCount: number;
  totalEstimatedQuestions: number;
  scenarios: Array<{ id: string; title: string }>;
}

export interface EditorData {
  exam: ExamInfo;
  materials: MaterialRow[];
  items: ItemRow[];
  scenarios: ScenarioRow[];
  questionMap: QuestionMapData;
}

/** Giới hạn khớp VAN_DAP_LIMITS trong core-lms (client không import được gói đó). */
export const LIMITS = {
  toneNoteMax: 500,
  rubricMax: 20_000,
  maxItems: 30,
  coreMax: 600,
  excerptMax: 2_000,
  expectedAnswerMax: 2_000,
  maxScenarios: 30,
  scenarioAiContextMax: 4_000,
  scenarioStudentBriefMax: 2_000,
  materialMaxBytes: 20 * 1024 * 1024,
};

export const ERROR_TEXT: Record<string, string> = {
  forbidden: "Thầy/cô không có quyền sửa đề này.",
  not_found: "Không tìm thấy mục này (có thể đã bị xoá).",
  exam_locked: "Đề đã xuất bản nên phần này đã khoá. Chỉ rubric và ghi chú giọng điệu còn sửa được.",
  validation_failed: "Dữ liệu chưa hợp lệ: kiểm tra các ô bắt buộc và giới hạn ký tự.",
  too_many: "Đã đủ số lượng tối đa.",
  plan_empty: "Chưa có ý nào trong dàn câu hỏi nên chưa xuất bản được.",
  material_unreadable: "Tệp này không đọc được chữ (ví dụ PDF scan). Hãy dùng tệp có chữ thật hoặc dán nội dung vào tệp .txt.",
  text_too_long: "Tệp quá dài. Hãy tách thành các tệp nhỏ hơn.",
  unsupported_media_type: "Chỉ nhận PDF, Word (.docx), .txt hoặc .md.",
  file_too_large: "Tệp lớn hơn 20 MB.",
  no_materials: "Chưa có tài liệu nào để tạo dàn. Hãy tải tài liệu lên trước.",
  openai_not_configured: "Chưa cấu hình mô hình AI trên máy chủ này.",
  source_too_short: "Tài liệu quá ngắn để tạo dàn câu hỏi.",
  source_too_long: "Tài liệu quá dài để đọc một lần. Hãy bớt tài liệu hoặc tách thành đề riêng.",
  empty_plan: "AI không đề xuất được ý nào. Thử lại, hoặc thêm ý bằng tay.",
  openai_error: "Mô hình AI đang lỗi. Dàn cũ vẫn còn nguyên, thầy/cô thử lại sau.",
  json_parse_failed: "AI trả kết quả không đọc được. Dàn cũ vẫn còn nguyên, thầy/cô thử lại.",
  generate_failed: "Không tạo được dàn. Dàn cũ vẫn còn nguyên, thầy/cô thử lại sau.",
  rate_limited: "AI đang bị giới hạn tốc độ. Dàn cũ vẫn còn nguyên, thầy/cô thử lại sau ít phút.",
  daily_token_cap: "Thầy/cô đã dùng hết hạn mức AI hôm nay. Dàn cũ vẫn còn nguyên.",
  global_token_cap: "Hệ thống đã hết hạn mức AI hôm nay. Dàn cũ vẫn còn nguyên.",
  no_token_budget: "Tài khoản chưa còn token AI. Dàn cũ vẫn còn nguyên.",
  no_api_key: "Chưa cấu hình mô hình AI trên máy chủ này.",
};

export function errorText(code: string | undefined, fallback = "Có lỗi xảy ra, thử lại sau."): string {
  return (code && ERROR_TEXT[code]) || fallback;
}
