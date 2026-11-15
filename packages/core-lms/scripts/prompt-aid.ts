/**
 * Chú giải đề (`config.promptAid`: phiên âm + bản dịch) cho các câu ĐÃ có trong khoá. Phần thuần để kiểm thử; ghi DB nằm ở `fill-prompt-aid.ts`.
 */
export interface PromptAidEntry {
  reading?: string;
  translation?: string;
}

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function normalizeAid(a: PromptAidEntry | undefined): PromptAidEntry | null {
  if (!a) return null;
  const reading = clean(a.reading);
  const translation = clean(a.translation);
  return reading || translation ? { ...(reading ? { reading } : {}), ...(translation ? { translation } : {}) } : null;
}

export interface AidResult {
  config: unknown;
  /** "added" thêm mới, "kept" đã có chú giải (giữ nguyên), "none" không có trong bảng. */
  status: "added" | "kept" | "none";
}

/** Gắn chú giải cho một câu theo đề của nó. Câu đã có `promptAid` thì giữ nguyên (thầy/cô có thể đã sửa tay) trừ khi `force`. Không sửa cấu hình cũ. */
export function applyPromptAid(config: unknown, prompt: string, map: Record<string, PromptAidEntry>, force = false): AidResult {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const aid = normalizeAid(map[prompt.trim()]);
  if (!aid) return { config, status: "none" };
  if (c.promptAid && !force) return { config, status: "kept" };
  return { config: { ...c, promptAid: aid }, status: "added" };
}
