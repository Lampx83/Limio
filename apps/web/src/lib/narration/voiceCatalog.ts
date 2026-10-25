/**
 * Phân loại giọng đọc theo vùng miền và câu đọc thử. Thuần dữ liệu, không import server để cả trang quản trị lẫn
 * route dùng chung.
 */

export type VoiceRegion = "bac" | "nam";

export const VOICE_REGION_LABEL: Record<VoiceRegion, string> = {
  bac: "Giọng miền Bắc",
  nam: "Giọng miền Nam",
};

/** Nhóm cho giọng chưa được gắn vùng (NEU TTS chỉ trả tên giọng và ngôn ngữ, không trả vùng miền). */
export const VOICE_REGION_UNKNOWN_LABEL = "Chưa phân loại";

/** Chỉ nhận đúng hai giá trị; dùng để kiểm dữ liệu từ cổng NEU và từ admin. */
export const isVoiceRegion = (v: unknown): v is VoiceRegion => v === "bac" || v === "nam";

/** Câu đọc thử theo ngôn ngữ. Cố định để bản đọc thử lưu được một lần dùng mãi. */
export const VOICE_SAMPLE_TEXT: Record<string, string> = {
  vi: "Xin chào, mình là giọng đọc của bài giảng này. Chúng ta cùng bắt đầu nhé.",
  en: "Hello, I am the voice of this lesson. Let's get started.",
  zh: "你好，我是这节课的朗读声音。我们开始吧。",
};

export const sampleTextFor = (language: string): string => VOICE_SAMPLE_TEXT[language] ?? VOICE_SAMPLE_TEXT.vi!;
