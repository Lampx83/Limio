import type { AppMode } from "@/lib/appMode";

/**
 * LANG L4.1 — loại đề ở bước đầu của "Tạo đề mới": đề thường hay đề ngoại ngữ (thi thử & luyện đề).
 * Loại đề cố định sau khi tạo (đề ngoại ngữ = `mockMode`), nên chọn đúng ngay từ đầu.
 */
export type ExamCreateType = "language" | "regular";

export function parseExamCreateType(raw: string | string[] | undefined): ExamCreateType | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "language" || v === "regular" ? v : null;
}

export interface ExamCreateChoice {
  type: ExamCreateType;
  title: string;
  description: string;
  /** Tham số truy vấn của bước kế. */
  query: string;
  recommended: boolean;
}

export function examCreateChoices(o: { courseLanguageMode: boolean; appMode: AppMode }): ExamCreateChoice[] {
  const languageFirst = o.courseLanguageMode || o.appMode === "language";
  const language: ExamCreateChoice = {
    type: "language",
    title: "Đề thi ngoại ngữ",
    description:
      "Thi thử và luyện đề theo kỹ năng: chia phần (Nghe · Đọc · Viết…) có giờ riêng, audio giới hạn số lần nghe, thang điểm ước lượng. Bắt đầu từ khung HSK, IELTS, TOEIC hoặc đề trống.",
    query: "type=language",
    recommended: languageFirst,
  };
  const regular: ExamCreateChoice = {
    type: "regular",
    title: "Đề thi thường",
    description:
      "Bài kiểm tra, thi giữa kỳ/cuối kỳ: ngân hàng câu hỏi, đợt thi – ca thi – phòng thi, mã thí sinh, giám sát. Dùng cho mọi môn, kể cả khoá ngoại ngữ khi cần kiểm tra thường.",
    query: "type=regular",
    recommended: false,
  };
  return languageFirst ? [language, regular] : [regular, language];
}
