// Ngôn ngữ nội dung slide của bài giảng Limio-Live (docs/tieu-chi/ngon-ngu-slide.md, L1). Dùng chung cho câu lệnh AI
// (core-feedback) và trình sửa (web), nên đặt ở đây.

export const DECK_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "Tiếng Anh" },
  { code: "zh", label: "Tiếng Trung" },
  { code: "ja", label: "Tiếng Nhật" },
  { code: "ko", label: "Tiếng Hàn" },
  { code: "fr", label: "Tiếng Pháp" },
  { code: "de", label: "Tiếng Đức" },
] as const;

export type DeckLanguage = (typeof DECK_LANGUAGES)[number]["code"];
