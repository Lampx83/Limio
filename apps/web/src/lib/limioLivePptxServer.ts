import type OpenAI from "openai";
import { AiGenerationError, AiTutorError, generateLectureOutline } from "@feedbackme/core-feedback";
import { isFullStructure, slideRange, type Outline } from "./limioLiveOutline";
import { importSourceText, keepOutline, restructureOutline, type ImportSource } from "./limioLivePptx";

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
  /** Ngôn ngữ của bài (docs/tieu-chi/ngon-ngu-slide.md): AI soạn lại mạch và chữ hệ thống theo ngôn ngữ này. */
  lang: string | null = null,
): Promise<{ outline: Outline; warnings: string[] }> {
  if (mode === "keep") return { outline: keepOutline(src, title, lang), warnings: [] };
  if (!openai) throw new Error("openai_not_configured");
  const range = slideRange(minutes);
  const raw = await generateLectureOutline(
    userId,
    {
      sourceText: importSourceText(src),
      sourceKind: "document",
      minutes,
      minSlides: range.min,
      maxSlides: range.max,
      structure: isFullStructure(minutes) ? "full" : "compact",
      fromSlides: src.slides.length,
      language: lang,
    },
    openai,
  );
  const res = restructureOutline(raw, src, minutes, lang);
  if (!res.outline.title) res.outline.title = title;
  return res;
}
