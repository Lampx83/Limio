// Thương hiệu của một bài giảng Limio-Live: logo + màu thương hiệu, áp cho mọi slide khi chiếu.
// Module thuần (không DB, không React): kiểm tra dữ liệu, sinh bảng màu từ một màu, luật hiện logo.
// Không tin dữ liệu từ máy khách: mọi giá trị đi qua sanitizeBrand.

export const BRAND_POSITIONS = ["tl", "tr", "bl", "br"] as const;
export const BRAND_SIZES = ["s", "m", "l"] as const;
export const BRAND_SHOWS = ["all", "nocover", "ends"] as const;

export type BrandPosition = (typeof BRAND_POSITIONS)[number];
export type BrandSize = (typeof BRAND_SIZES)[number];
export type BrandShow = (typeof BRAND_SHOWS)[number];

export interface BrandConfig {
  /** Địa chỉ logo đã tải lên (/api/limio-live-media/<tên tệp>); trống = chưa có logo. */
  logoUrl?: string;
  logoPos: BrandPosition;
  logoSize: BrandSize;
  logoShow: BrandShow;
  /** Màu thương hiệu #RRGGBB; trống = dùng màu nhấn của giao diện. */
  color?: string;
}

export const DEFAULT_BRAND: BrandConfig = { logoPos: "tr", logoSize: "m", logoShow: "all" };

const LOGO_URL_RE = /^\/api\/limio-live-media\/[A-Za-z0-9._-]{1,200}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Tên tệp của logo từ địa chỉ đã lưu (để dọn tệp khi gỡ hoặc thay logo); null nếu không phải địa chỉ hợp lệ. */
export function brandLogoFilename(url: unknown): string | null {
  return isBrandLogoUrl(url) ? url.slice("/api/limio-live-media/".length) : null;
}

export const isBrandColor = (v: unknown): v is string => typeof v === "string" && COLOR_RE.test(v);
export const isBrandLogoUrl = (v: unknown): v is string => typeof v === "string" && LOGO_URL_RE.test(v);

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

/**
 * Chuẩn hoá thương hiệu đọc từ DB hoặc nhận từ máy khách. Giá trị rác về mặc định; địa chỉ logo và mã màu
 * sai bị bỏ. Không có logo và không có màu thì coi như chưa đặt thương hiệu (null).
 */
export function sanitizeBrand(raw: unknown): BrandConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const logoUrl = isBrandLogoUrl(o.logoUrl) ? o.logoUrl : undefined;
  const color = isBrandColor(o.color) ? o.color.toUpperCase() : undefined;
  if (!logoUrl && !color) return null;
  return {
    ...(logoUrl ? { logoUrl } : {}),
    logoPos: pick(BRAND_POSITIONS, o.logoPos, DEFAULT_BRAND.logoPos),
    logoSize: pick(BRAND_SIZES, o.logoSize, DEFAULT_BRAND.logoSize),
    logoShow: pick(BRAND_SHOWS, o.logoShow, DEFAULT_BRAND.logoShow),
    ...(color ? { color } : {}),
  };
}

/** Kiểm tra chặt cho API lưu: trả lỗi thay vì lẳng lặng bỏ giá trị sai. */
export function validateBrandInput(raw: unknown): { ok: true; brand: BrandConfig | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, brand: null };
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_brand" };
  const o = raw as Record<string, unknown>;
  if (o.logoUrl != null && !isBrandLogoUrl(o.logoUrl)) return { ok: false, error: "invalid_logo_url" };
  if (o.color != null && o.color !== "" && !isBrandColor(o.color)) return { ok: false, error: "invalid_color" };
  for (const [key, list] of [["logoPos", BRAND_POSITIONS], ["logoSize", BRAND_SIZES], ["logoShow", BRAND_SHOWS]] as const) {
    if (o[key] != null && !(list as readonly string[]).includes(o[key] as string)) return { ok: false, error: `invalid_${key}` };
  }
  return { ok: true, brand: sanitizeBrand({ ...o, color: o.color === "" ? undefined : o.color }) };
}

// ── Màu: sinh bảng màu từ một màu, bảo đảm độ tương phản ───────────────────

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return "#" + [r, g, b].map((v) => clamp255((v + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex)!;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỷ lệ tương phản WCAG giữa hai màu (1 đến 21). */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const MIN_CONTRAST = 4.5;
const LIGHT_BG = "#FFFFFF";
const DARK_BG = "#0B1020";

export interface BrandPalette {
  /** Màu nhấn đã chỉnh để đủ tương phản trên nền. */
  sa: string;
  sa2: string;
  soft: string;
  soft2: string;
  sg: string;
  sgb: string;
  /** Màu chữ đặt lên nền sgb (trắng hoặc đen, chọn theo độ sáng). */
  on: string;
  /** true nếu phải làm đậm (nền sáng) hoặc sáng hơn (nền tối) so với màu gốc. */
  adjusted: boolean;
}

/** Bảng màu sinh từ màu thương hiệu; nền tối thì dùng bảng màu tối (nhấn sáng, nền thẻ trong suốt). */
export function brandPalette(hex: string, dark: boolean): BrandPalette | null {
  const rgb = isBrandColor(hex) ? hexToRgb(hex) : null;
  if (!rgb) return null;
  const [h, s0, l0] = rgbToHsl(...rgb);
  const s = Math.max(s0, 0.35);
  let l = l0;
  const bg = dark ? DARK_BG : LIGHT_BG;
  let sa = hslToHex(h, s, l);
  let adjusted = false;
  // Nền sáng thì làm đậm dần, nền tối thì làm sáng dần, kể cả khi màu gốc là trắng hoặc đen.
  while (contrastRatio(sa, bg) < MIN_CONTRAST && (dark ? l < 0.99 : l > 0.01)) {
    l += dark ? 0.03 : -0.03;
    sa = hslToHex(h, s, l);
    adjusted = true;
  }
  const mid = Math.min(0.55, Math.max(0.32, l));
  const sa2 = hslToHex(h + 24, s, Math.min(0.5, Math.max(0.32, l)));
  return {
    sa,
    sa2,
    soft: dark ? "rgba(255,255,255,.14)" : hslToHex(h, Math.min(s, 0.7), 0.92),
    soft2: dark ? "rgba(255,255,255,.08)" : hslToHex(h + 24, Math.min(s, 0.6), 0.95),
    sg: `linear-gradient(120deg, ${sa} 0%, ${hslToHex(h + 24, s, Math.min(0.55, Math.max(0.35, mid)))} 100%)`,
    sgb: `linear-gradient(135deg, ${sa} 0%, ${hslToHex(h, s, dark ? Math.max(0.05, l - 0.08) : Math.max(0.05, l - 0.1))} 100%)`,
    on: contrastRatio("#FFFFFF", sa) >= 3 ? "#FFFFFF" : "#111111",
    adjusted,
  };
}

/** Biến CSS ghi đè bảng màu của giao diện (slideLayouts.css). */
export function brandCssVars(color: string | undefined, dark: boolean): Record<string, string> {
  const p = color ? brandPalette(color, dark) : null;
  if (!p) return {};
  return {
    "--sa": p.sa,
    "--sa2": p.sa2,
    "--ssoft": p.soft,
    "--ssoft2": p.soft2,
    "--sg": p.sg,
    "--sgb": p.sgb,
    "--son": p.on,
    "--sglow1": p.sa,
    "--sglow2": p.sa2,
  };
}

// ── Logo: ai thấy logo, chiếm bao nhiêu chỗ ────────────────────────────────

export type SlideRole = "cover" | "summary" | "other";

/** Vai trò của slide trong luật "Hiện ở": bố cục Bìa, Tóm tắt, còn lại (kể cả slide tương tác). */
export function slideRole(layout: string | null | undefined): SlideRole {
  return layout === "cover" ? "cover" : layout === "summary" ? "summary" : "other";
}

export function logoVisibleOn(show: BrandShow, role: SlideRole): boolean {
  if (show === "all") return true;
  if (show === "nocover") return role !== "cover";
  return role === "cover" || role === "summary";
}

/** Chiều cao logo trên khung thiết kế 1280×720 (px). */
export const LOGO_PX: Record<BrandSize, number> = { s: 44, m: 64, l: 92 };
export const LOGO_MARGIN_PX = 36;
const DESIGN_H = 720;

/** Dải đệm cho logo ở mép trên hoặc dưới; nội dung slide thu về phần còn lại để không chồng chữ. */
export function logoRoomPx(size: BrandSize): number {
  return LOGO_PX[size] + 24;
}

/** Hệ số thu nhỏ nội dung slide khi có logo (khung thiết kế cao 720px). */
export function contentScaleForLogo(size: BrandSize): number {
  return (DESIGN_H - logoRoomPx(size)) / DESIGN_H;
}

/** Vị trí logo trên khung thiết kế: trả về style tuyệt đối. */
export function logoPlacement(pos: BrandPosition, size: BrandSize): { top?: number; bottom?: number; left?: number; right?: number; height: number } {
  return {
    height: LOGO_PX[size],
    ...(pos[0] === "t" ? { top: LOGO_MARGIN_PX } : { bottom: LOGO_MARGIN_PX }),
    ...(pos[1] === "l" ? { left: LOGO_MARGIN_PX } : { right: LOGO_MARGIN_PX }),
  };
}
