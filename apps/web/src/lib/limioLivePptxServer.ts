import type OpenAI from "openai";
import { AiGenerationError, AiTutorError, generateLectureOutline } from "@feedbackme/core-feedback";
import { isFullStructure, slideRange, type Outline } from "./limioLiveOutline";
import { importSourceText, keepOutline, restructureOutline, type ImportSource } from "./limioLivePptx";
import { interactionTarget } from "./limioLiveInteractions";
import { ensureInteractions } from "./limioLiveInteractionsServer";

export type ImportMode = "keep" | "restructure";
export const isImportMode = (v: unknown): v is ImportMode => v === "keep" || v === "restructure";

/** Lỗi AI → mã lỗi + mã HTTP như luồng tạo từ tài liệu (P27). */
export function aiFailure(e: unknown): { error: string; status: number; details?: unknown } | null {
  if (e instanceof AiTutorError) return { error: e.code, status: 429, details: e.details };
  if (e instanceof AiGenerationError) return { error: e.code, status: e.code === "validation_failed" ? 400 : 502, details: e.details };
  return null;
}

/**
 * Dàn ý của bài nhập theo cách đã chọn: "keep" dựng thẳng (không AI); "restructure" nhờ AI đề xuất mạch rồi chuẩn hoá
 * (nguồn từng dòng, dòng giữ nguyên dựng lại từ chữ gốc). Ném lỗi AI cho nơi gọi xử lý.
 */
export async function buildImportOutline(
  userId: string,
  src: ImportSource,
  title: string,
  minutes: number,
  mode: ImportMode,
  openai: OpenAI | null,
  /** Mô tả của giảng viên mang từ trang Tạo bài giảng (tao-bai-giang-mot-o.md, M7, M10). */
  intent: string | null = null,
): Promise<{ outline: Outline; warnings: string[]; interactionsAdded: number }> {
  const sourceText = importSourceText(src);
  // Mọi cách nhập đều có đủ slide tương tác (M17–M18): "Giữ ý" giữ nguyên slide gốc, AI chỉ viết thêm các slide tương tác;
  // AI chưa cấu hình hay hết hạn mức thì vẫn nhập được, kèm cảnh báo.
  const topUp = async (o: Outline, warnings: string[]) => {
    const t = await ensureInteractions(userId, o, minutes, { sourceText, sourceKind: "document", intent }, openai);
    return { outline: t.outline, warnings: [...warnings, ...(t.warning ? [t.warning] : [])], interactionsAdded: t.added };
  };
  if (mode === "keep") return topUp(keepOutline(src, title), []);
  if (!openai) throw new Error("openai_not_configured");
  const range = slideRange(minutes);
  const target = interactionTarget(minutes);
  const raw = await generateLectureOutline(
    userId,
    {
      sourceText,
      sourceKind: "document",
      minutes,
      minSlides: range.min,
      maxSlides: range.max,
      structure: isFullStructure(minutes) ? "full" : "compact",
      fromSlides: src.slides.length,
      minInteractions: target.min,
      minInteractionKinds: target.kinds,
      ...(minutes >= 90 ? { contentParts: [4, 6] as [number, number] } : {}),
      ...(intent ? { intent } : {}),
    },
    openai,
  );
  const res = restructureOutline(raw, src, minutes);
  if (!res.outline.title) res.outline.title = title;
  return topUp(res.outline, res.warnings);
}
