import { hexColorsIn, motifOpacityCap } from "@/lib/limioLiveMotifs";

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

/**
 * Màu chữ và màu nhấn của từng bảng màu (chép từ slideLayouts.css; test so khớp). Dùng để tính độ đậm an toàn của
 * hoa văn trang trí: không thể đọc biến CSS khi vẽ ở máy chủ hay trong test.
 */
export const SLIDE_THEME_INK: Record<string, { text: string; muted: string; sa: string; sa2: string }> = {
  "lt-brand": { text: "#20241F", muted: "#5A6256", sa: "#4D7C0F", sa2: "#BE185D" },
  "lt-night": { text: "#F1F5F9", muted: "#C4CCE0", sa: "#38BDF8", sa2: "#C4B5FD" },
  "lt-paper": { text: "#2B2118", muted: "#6B5B4A", sa: "#A34A07", sa2: "#0B5F59" },
  "lt-lavender": { text: "#221B33", muted: "#5B5273", sa: "#6D28D9", sa2: "#BE185D" },
  "lt-peach": { text: "#2B1A14", muted: "#6B534A", sa: "#C2410C", sa2: "#BE123C" },
  "lt-ocean": { text: "#0F2A33", muted: "#476068", sa: "#0E7490", sa2: "#4F46E5" },
  "lt-monogray": { text: "#18181B", muted: "#52525B", sa: "#27272A", sa2: "#52525B" },
  "lt-monoblue": { text: "#0F1B33", muted: "#475A7A", sa: "#1D4ED8", sa2: "#3B82F6" },
  "lt-monogreen": { text: "#0F2418", muted: "#44634F", sa: "#15803D", sa2: "#16A34A" },
  "lt-monoblack": { text: "#FAFAFA", muted: "#B4B4B8", sa: "#FAFAFA", sa2: "#A1A1AA" },
  "lt-forest": { text: "#ECFDF5", muted: "#B5D3C3", sa: "#4ADE80", sa2: "#FDE047" },
  "lt-plum": { text: "#FDF4FF", muted: "#E3C7EC", sa: "#F0ABFC", sa2: "#FDA4AF" },
  "lt-ink": { text: "#F5F6F8", muted: "#C0C6D2", sa: "#FBBF24", sa2: "#60A5FA" },
};

/**
 * Độ đậm lớn nhất của hoa văn ở góc slide (biến --smo) để chữ đè lên vẫn đạt 4,5:1 (chữ nhấn 3:1).
 * `bg` là nền thật của khung slide; `vars` là biến ghi đè của thương hiệu (màu nhấn, và màu chữ khi dùng nền xuyệt tông).
 */
export function motifOpacityFor(themeId: string | undefined | null, bg: string, vars: Record<string, string> = {}): number {
  const cls = SLIDE_THEMES.find((t) => t.id === themeId)?.cls ?? "lt-brand";
  const ink = SLIDE_THEME_INK[cls]!;
  const sa = vars["--sa"] ?? ink.sa;
  return motifOpacityCap({
    inks: [sa, vars["--sa2"] ?? ink.sa2],
    bgs: hexColorsIn(bg),
    text: vars["--stext"] ?? ink.text,
    muted: vars["--smuted"] ?? ink.muted,
    accent: sa,
  });
}
