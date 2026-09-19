// Giao diện slide cho cả bài giảng. Chỉ đổi nền + viền nhấn của khung slide
// (chữ luôn tối) nên mọi loại slide vẫn đọc được, không cần chỉnh từng màu con.
export const SLIDE_THEMES = [
  { id: "white", label: "Trắng", bg: "#FFFFFF", swatch: "#FFFFFF" },
  { id: "cream", label: "Kem", bg: "#FBF6E9", swatch: "#F3E9C6" },
  { id: "mint", label: "Bạc hà", bg: "#EAF7EE", swatch: "#BFE8CB" },
  { id: "sky", label: "Trời", bg: "#EAF3FC", swatch: "#BBD8F5" },
  { id: "blush", label: "Hồng phấn", bg: "#FCEEF3", swatch: "#F6C4D6" },
  { id: "brand", label: "Limio", bg: "linear-gradient(135deg,#F3FADC 0%,#FDEBF3 100%)", swatch: "linear-gradient(135deg,#BEF264,#F9A8D4)" },
] as const;

export type SlideThemeId = (typeof SLIDE_THEMES)[number]["id"];

export function slideThemeBg(id: string | undefined | null): string {
  return (SLIDE_THEMES.find((t) => t.id === id) ?? SLIDE_THEMES[0]).bg;
}
