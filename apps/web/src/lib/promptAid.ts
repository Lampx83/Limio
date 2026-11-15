/**
 * Chú giải đề câu hỏi cho học viên ngoại ngữ (`config.promptAid`): phiên âm hiện sẵn dưới đề, bản dịch ẩn cho tới khi học viên bấm.
 * Đọc từ dữ liệu máy chủ không đáng tin; thiếu hoặc sai dạng thì null (câu hiện như cũ).
 */
export interface PromptAidView {
  reading?: string;
  translation?: string;
}

export function parsePromptAid(config: unknown): PromptAidView | null {
  const a = config && typeof config === "object" ? (config as Record<string, unknown>).promptAid : null;
  if (!a || typeof a !== "object") return null;
  const { reading, translation } = a as Record<string, unknown>;
  const r = typeof reading === "string" && reading.trim() ? reading.trim() : undefined;
  const t = typeof translation === "string" && translation.trim() ? translation.trim() : undefined;
  return r || t ? { ...(r ? { reading: r } : {}), ...(t ? { translation: t } : {}) } : null;
}
