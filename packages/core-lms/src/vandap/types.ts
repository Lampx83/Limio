// Limio Vấn đáp (docs/tieu-chi/limio-van-dap.md). Mọi giới hạn nằm một chỗ để UI, API và test dùng chung.

export const VAN_DAP_LIMITS = {
  titleMax: 200,
  durationMin: 5,
  durationMax: 120,
  /** Ghi chú giọng điệu (Phong cách) — "hỏi thế nào", không phải nơi viết luật về nội dung/thứ tự. */
  toneNoteMax: 500,
  rubricMax: 20_000,
  maxMaterials: 10,
  materialMaxBytes: 20 * 1024 * 1024,
  /** Trần chữ trích từ MỘT tệp. Rộng hơn bản cũ (15.000) vì dàn được sinh theo từng phần rồi gộp. */
  materialMaxChars: 400_000,
  maxItems: 30,
  coreMax: 600,
  excerptMax: 2_000,
  expectedAnswerMax: 2_000,
  maxFollowUpsLimit: 3,
  defaultFollowUps: 2,
  maxScenarios: 30,
  scenarioTitleMax: 200,
  scenarioAiContextMax: 4_000,
  scenarioStudentBriefMax: 2_000,
} as const;

export const VAN_DAP_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type VanDapErrorCode =
  | "forbidden"
  | "not_found"
  /** Đề đã xuất bản: tài liệu, dàn, kịch bản bị khoá (cùng lý do công bằng như bản cũ). */
  | "exam_locked"
  | "validation_failed"
  | "too_many"
  /** Tệp không đọc được chữ (vd PDF scan). */
  | "material_unreadable"
  | "text_too_long"
  /** Xuất bản khi dàn chưa có ý nào. */
  | "plan_empty"
  | "not_a_permutation"
  | "legacy_not_oral";

export class VanDapError extends Error {
  constructor(
    public readonly code: VanDapErrorCode,
    public readonly details?: unknown,
  ) {
    super(code);
  }
}
