// Giao diện slide cho cả bài giảng. Các giao diện sáng chỉ đổi nền + màu nhấn của khung slide,
// chữ luôn tối nên mọi loại slide vẫn đọc được. Các giao diện tối (Đêm xanh, Rừng đêm, Mận, Mực):
// chỉ slide Nội dung có bố cục mới dùng nền tối, các slide tương tác (quiz, poll, word cloud, bảng)
// vẫn dựng trên nền sáng vì chữ của chúng được thiết kế cho nền sáng — xem slideBgFor.
// `cls` là lớp bảng màu trong slideLayouts.css.
export const SLIDE_THEMES = [
  { id: "white", label: "Trắng", bg: "#FFFFFF", swatch: "#FFFFFF", dark: false, cls: "lt-brand", group: "basic" },
  { id: "cream", label: "Kem", bg: "#FBF6E9", swatch: "#F3E9C6", dark: false, cls: "lt-paper", group: "basic" },
  { id: "mint", label: "Bạc hà", bg: "#EAF7EE", swatch: "#BFE8CB", dark: false, cls: "lt-brand", group: "pastel" },
  { id: "sky", label: "Trời", bg: "#EAF3FC", swatch: "#BBD8F5", dark: false, cls: "lt-brand", group: "pastel" },
  { id: "blush", label: "Hồng phấn", bg: "#FCEEF3", swatch: "#F6C4D6", dark: false, cls: "lt-brand", group: "pastel" },
  { id: "brand", label: "Limio", bg: "linear-gradient(135deg,#F3FADC 0%,#FDEBF3 100%)", swatch: "linear-gradient(135deg,#BEF264,#F9A8D4)", dark: false, cls: "lt-brand", group: "basic" },
  { id: "paper", label: "Giấy ấm", bg: "linear-gradient(160deg,#FBF6E9 0%,#F4E8CB 100%)", swatch: "linear-gradient(135deg,#FBBF24,#F4E8CB)", dark: false, cls: "lt-paper", group: "basic" },
  // Ba giao diện pastel có bảng màu riêng (màu nhấn khác Limio).
  { id: "lavender", label: "Oải hương", bg: "linear-gradient(135deg,#F5F0FF 0%,#EDE7FB 100%)", swatch: "linear-gradient(135deg,#C4B5FD,#F9A8D4)", dark: false, cls: "lt-lavender", group: "pastel" },
  { id: "peach", label: "Đào", bg: "linear-gradient(135deg,#FFF4EC 0%,#FFE8E0 100%)", swatch: "linear-gradient(135deg,#FDBA74,#FDA4AF)", dark: false, cls: "lt-peach", group: "pastel" },
  { id: "ocean", label: "Biển", bg: "linear-gradient(135deg,#E8F8FA 0%,#E3F0FD 100%)", swatch: "linear-gradient(135deg,#67E8F9,#A5B4FC)", dark: false, cls: "lt-ocean", group: "pastel" },
  // Đơn sắc: cả bảng màu dùng một tông duy nhất (chữ và màu nhấn cùng gam), gọn và dễ in.
  { id: "monogray", label: "Mono xám", bg: "linear-gradient(135deg,#F7F7F8 0%,#ECEDEF 100%)", swatch: "linear-gradient(135deg,#A1A1AA,#E4E4E7)", dark: false, cls: "lt-monogray", group: "mono" },
  { id: "monoblue", label: "Mono lam", bg: "linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%)", swatch: "linear-gradient(135deg,#60A5FA,#DBEAFE)", dark: false, cls: "lt-monoblue", group: "mono" },
  { id: "monogreen", label: "Mono lục", bg: "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)", swatch: "linear-gradient(135deg,#4ADE80,#DCFCE7)", dark: false, cls: "lt-monogreen", group: "mono" },
  { id: "monoblack", label: "Mono đen", bg: "linear-gradient(135deg,#050505 0%,#1A1A1A 100%)", swatch: "linear-gradient(135deg,#FAFAFA,#1A1A1A)", dark: true, cls: "lt-monoblack", group: "mono" },
  { id: "night", label: "Đêm xanh", bg: "linear-gradient(135deg,#0B1020 0%,#1B1A4B 100%)", swatch: "linear-gradient(135deg,#38BDF8,#1B1A4B)", dark: true, cls: "lt-night", group: "dark" },
  { id: "forest", label: "Rừng đêm", bg: "linear-gradient(135deg,#06130D 0%,#0E2B1F 100%)", swatch: "linear-gradient(135deg,#4ADE80,#0E2B1F)", dark: true, cls: "lt-forest", group: "dark" },
  { id: "plum", label: "Mận", bg: "linear-gradient(135deg,#1A0B22 0%,#3A1346 100%)", swatch: "linear-gradient(135deg,#F0ABFC,#3A1346)", dark: true, cls: "lt-plum", group: "dark" },
  { id: "ink", label: "Mực", bg: "linear-gradient(135deg,#0E1014 0%,#1C212B 100%)", swatch: "linear-gradient(135deg,#FBBF24,#1C212B)", dark: true, cls: "lt-ink", group: "dark" },
] as const;

/** Nhóm hiển thị trong bảng chọn giao diện. */
export const SLIDE_THEME_GROUPS = [
  { id: "basic", label: "Cơ bản", hint: "Nền sáng, hợp mọi bài giảng" },
  { id: "pastel", label: "Màu pastel", hint: "Nền nhạt, mỗi giao diện một màu nhấn riêng" },
  { id: "mono", label: "Đơn sắc (Mono)", hint: "Chỉ một tông màu, tinh gọn và dễ in" },
  { id: "dark", label: "Nền tối", hint: "Chỉ áp cho slide nội dung; slide tương tác vẫn nền sáng" },
] as const;

export type SlideThemeId = (typeof SLIDE_THEMES)[number]["id"];

export const SLIDE_THEME_IDS = SLIDE_THEMES.map((t) => t.id) as [SlideThemeId, ...SlideThemeId[]];

export function slideThemeBg(id: string | undefined | null): string {
  return (SLIDE_THEMES.find((t) => t.id === id) ?? SLIDE_THEMES[0]).bg;
}

export function isDarkTheme(id: string | undefined | null): boolean {
  return SLIDE_THEMES.find((t) => t.id === id)?.dark === true;
}

/** Lớp CSS bảng màu cho bố cục slide (slideLayouts.css); giao diện tối có thêm lt-dark cho các chỉnh riêng nền tối. */
export function layoutThemeClass(id: string | undefined | null): string {
  const t = SLIDE_THEMES.find((x) => x.id === id);
  return t ? (t.dark ? `${t.cls} lt-dark` : t.cls) : "lt-brand";
}

/**
 * Nền của một slide cụ thể. Giao diện tối chỉ áp cho slide Nội dung có bố cục (chữ do bộ
 * bố cục vẽ); slide khác rơi về nền Limio sáng để chữ tối của chúng vẫn đọc được.
 */
export function slideBgFor(themeId: string | undefined | null, darkCapable: boolean): string {
  if (isDarkTheme(themeId) && !darkCapable) return slideThemeBg("brand");
  return slideThemeBg(themeId);
}
