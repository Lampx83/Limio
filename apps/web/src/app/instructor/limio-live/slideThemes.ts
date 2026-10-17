// Giao diện slide cho cả bài giảng. Các giao diện nhạt (trắng, kem, bạc hà, trời, hồng phấn,
// Limio, Giấy ấm) chỉ đổi nền + màu nhấn của khung slide, chữ luôn tối nên mọi loại slide
// vẫn đọc được. "Đêm xanh" là giao diện tối: chỉ slide Nội dung có bố cục mới dùng nền tối,
// các slide tương tác (quiz, poll, word cloud, bảng) vẫn dựng trên nền sáng vì chữ của chúng
// được thiết kế cho nền sáng — xem slideBgFor.
export const SLIDE_THEMES = [
  { id: "white", label: "Trắng", bg: "#FFFFFF", swatch: "#FFFFFF" },
  { id: "cream", label: "Kem", bg: "#FBF6E9", swatch: "#F3E9C6" },
  { id: "mint", label: "Bạc hà", bg: "#EAF7EE", swatch: "#BFE8CB" },
  { id: "sky", label: "Trời", bg: "#EAF3FC", swatch: "#BBD8F5" },
  { id: "blush", label: "Hồng phấn", bg: "#FCEEF3", swatch: "#F6C4D6" },
  { id: "brand", label: "Limio", bg: "linear-gradient(135deg,#F3FADC 0%,#FDEBF3 100%)", swatch: "linear-gradient(135deg,#BEF264,#F9A8D4)" },
  { id: "paper", label: "Giấy ấm", bg: "linear-gradient(160deg,#FBF6E9 0%,#F4E8CB 100%)", swatch: "linear-gradient(135deg,#FBBF24,#F4E8CB)" },
  { id: "night", label: "Đêm xanh", bg: "linear-gradient(135deg,#0B1020 0%,#1B1A4B 100%)", swatch: "linear-gradient(135deg,#38BDF8,#1B1A4B)" },
] as const;

export type SlideThemeId = (typeof SLIDE_THEMES)[number]["id"];

export const SLIDE_THEME_IDS = SLIDE_THEMES.map((t) => t.id) as [SlideThemeId, ...SlideThemeId[]];

export function slideThemeBg(id: string | undefined | null): string {
  return (SLIDE_THEMES.find((t) => t.id === id) ?? SLIDE_THEMES[0]).bg;
}

export function isDarkTheme(id: string | undefined | null): boolean {
  return id === "night";
}

/** Lớp CSS màu cho bố cục slide (slideLayouts.css). Giao diện nhạt khác dùng bảng màu Limio. */
export function layoutThemeClass(id: string | undefined | null): "lt-brand" | "lt-paper" | "lt-night" {
  if (id === "night") return "lt-night";
  if (id === "paper" || id === "cream") return "lt-paper";
  return "lt-brand";
}

/**
 * Nền của một slide cụ thể. Giao diện tối chỉ áp cho slide Nội dung có bố cục (chữ do bộ
 * bố cục vẽ); slide khác rơi về nền Limio sáng để chữ tối của chúng vẫn đọc được.
 */
export function slideBgFor(themeId: string | undefined | null, darkCapable: boolean): string {
  if (isDarkTheme(themeId) && !darkCapable) return slideThemeBg("brand");
  return slideThemeBg(themeId);
}
