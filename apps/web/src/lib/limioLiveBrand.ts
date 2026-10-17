// Thương hiệu của một bài giảng Limio-Live: logo + màu thương hiệu, áp cho mọi slide khi chiếu.
// Module thuần (không DB, không React): kiểm tra dữ liệu, sinh bảng màu từ một màu, luật hiện logo.
// Không tin dữ liệu từ máy khách: mọi giá trị đi qua sanitizeBrand.

export const BRAND_POSITIONS = ["tl", "tr", "bl", "br"] as const;
export const BRAND_SIZES = ["s", "m", "l"] as const;
export const BRAND_SHOWS = ["all", "nocover", "ends"] as const;
/** Nền slide: theo giao diện đang dùng, hoặc xuyệt tông (tông sáng / tối sinh từ bảng màu thương hiệu). */
export const BRAND_BGS = ["theme", "light", "dark"] as const;

export type BrandPosition = (typeof BRAND_POSITIONS)[number];
export type BrandSize = (typeof BRAND_SIZES)[number];
export type BrandShow = (typeof BRAND_SHOWS)[number];
export type BrandBg = (typeof BRAND_BGS)[number];

/** Bảng màu thương hiệu 3 ô: chính (bắt buộc nếu có bảng), phụ và nhấn (tuỳ chọn, thiếu thì tự sinh từ màu chính). */
export interface BrandColors {
  primary: string;
  secondary?: string;
  accent?: string;
}
export const BRAND_COLOR_SLOTS = ["primary", "secondary", "accent"] as const;
export type BrandColorSlot = (typeof BRAND_COLOR_SLOTS)[number];

export interface BrandConfig {
  /** Địa chỉ logo đã tải lên (/api/limio-live-media/<tên tệp>); trống = chưa có logo. */
  logoUrl?: string;
  logoPos: BrandPosition;
  logoSize: BrandSize;
  logoShow: BrandShow;
  /** Bảng màu thương hiệu; trống = dùng màu nhấn của giao diện. */
  colors?: BrandColors;
  /** Nền xuyệt tông; chỉ có nghĩa khi đã có bảng màu (không có thì luôn là "theme"). */
  bg: BrandBg;
}

export const DEFAULT_BRAND: BrandConfig = { logoPos: "tr", logoSize: "m", logoShow: "all", bg: "theme" };

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

/** Đọc bảng màu từ dữ liệu thô: nhận `colors` {primary, secondary?, accent?} hoặc `color` cũ (một màu = màu chính). */
function readColors(o: Record<string, unknown>): BrandColors | undefined {
  const raw = o.colors && typeof o.colors === "object" ? (o.colors as Record<string, unknown>) : null;
  const up = (v: unknown) => (isBrandColor(v) ? v.toUpperCase() : undefined);
  const primary = up(raw?.primary) ?? (raw ? undefined : up(o.color));
  if (!primary) return undefined;
  const secondary = up(raw?.secondary);
  const accent = up(raw?.accent);
  return { primary, ...(secondary ? { secondary } : {}), ...(accent ? { accent } : {}) };
}

/**
 * Chuẩn hoá thương hiệu đọc từ DB hoặc nhận từ máy khách. Giá trị rác về mặc định; địa chỉ logo và mã màu
 * sai bị bỏ. Không có logo và không có màu thì coi như chưa đặt thương hiệu (null).
 */
export function sanitizeBrand(raw: unknown): BrandConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const logoUrl = isBrandLogoUrl(o.logoUrl) ? o.logoUrl : undefined;
  const colors = readColors(o);
  if (!logoUrl && !colors) return null;
  return {
    ...(logoUrl ? { logoUrl } : {}),
    logoPos: pick(BRAND_POSITIONS, o.logoPos, DEFAULT_BRAND.logoPos),
    logoSize: pick(BRAND_SIZES, o.logoSize, DEFAULT_BRAND.logoSize),
    logoShow: pick(BRAND_SHOWS, o.logoShow, DEFAULT_BRAND.logoShow),
    ...(colors ? { colors } : {}),
    bg: colors ? pick(BRAND_BGS, o.bg, DEFAULT_BRAND.bg) : DEFAULT_BRAND.bg,
  };
}

/** Kiểm tra chặt cho API lưu: trả lỗi thay vì lẳng lặng bỏ giá trị sai. */
export function validateBrandInput(raw: unknown): { ok: true; brand: BrandConfig | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, brand: null };
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_brand" };
  const o = raw as Record<string, unknown>;
  if (o.logoUrl != null && !isBrandLogoUrl(o.logoUrl)) return { ok: false, error: "invalid_logo_url" };
  if (o.color != null && o.color !== "" && !isBrandColor(o.color)) return { ok: false, error: "invalid_color" };
  if (o.colors != null) {
    if (typeof o.colors !== "object" || Array.isArray(o.colors)) return { ok: false, error: "invalid_colors" };
    const c = o.colors as Record<string, unknown>;
    for (const slot of BRAND_COLOR_SLOTS) {
      if (c[slot] != null && c[slot] !== "" && !isBrandColor(c[slot])) return { ok: false, error: `invalid_color_${slot}` };
    }
    // Màu phụ hoặc màu nhấn mà không có màu chính thì không có gì để sinh bảng màu.
    if ((c.secondary || c.accent) && !c.primary) return { ok: false, error: "missing_primary_color" };
  }
  for (const [key, list] of [["logoPos", BRAND_POSITIONS], ["logoSize", BRAND_SIZES], ["logoShow", BRAND_SHOWS], ["bg", BRAND_BGS]] as const) {
    if (o[key] != null && !(list as readonly string[]).includes(o[key] as string)) return { ok: false, error: `invalid_${key}` };
  }
  return { ok: true, brand: sanitizeBrand(o) };
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
  /** Màu nhấn chính và phụ, đã chỉnh để đủ tương phản trên nền. */
  sa: string;
  sa2: string;
  /** Màu nhấn (ô thứ ba): dùng cho vầng sáng và điểm nhấn trang trí, không làm màu chữ. */
  accent: string;
  soft: string;
  soft2: string;
  sg: string;
  sgb: string;
  /** Màu chữ đặt lên nền sgb (trắng hoặc đen, chọn theo độ sáng của cả hai điểm màu). */
  on: string;
  /** Ô nào đã bị chỉnh (làm đậm trên nền sáng, làm sáng trên nền tối) so với màu gốc. */
  adjusted: BrandColorSlot[];
}

/** Làm đậm (nền sáng) hoặc sáng (nền tối) một màu tới khi chữ của nó đủ rõ trên nền. */
function ensureContrast(hex: string, dark: boolean): { hex: string; adjusted: boolean } {
  const rgb = hexToRgb(hex)!;
  const [h, s0, l0] = rgbToHsl(...rgb);
  const s = Math.max(s0, 0.35);
  const bg = dark ? DARK_BG : LIGHT_BG;
  let l = l0;
  let out = hslToHex(h, s, l);
  let adjusted = false;
  // Nền sáng thì làm đậm dần, nền tối thì làm sáng dần, kể cả khi màu gốc là trắng hoặc đen.
  while (contrastRatio(out, bg) < MIN_CONTRAST && (dark ? l < 0.99 : l > 0.01)) {
    l += dark ? 0.03 : -0.03;
    out = hslToHex(h, s, l);
    adjusted = true;
  }
  return { hex: out, adjusted };
}

const tint = (hex: string, dark: boolean, light: number): string => {
  const [h, s] = rgbToHsl(...hexToRgb(hex)!);
  return dark ? "rgba(255,255,255,.14)" : hslToHex(h, Math.min(Math.max(s, 0.35), 0.7), light);
};

/**
 * Bảng màu sinh từ bộ màu thương hiệu 3 ô. Màu chính và màu phụ làm màu nhấn của chữ nên được chỉnh cho đủ
 * tương phản; màu nhấn chỉ để trang trí (vầng sáng, điểm cuối của dải màu). Ô trống tự sinh từ màu chính (xoay sắc độ).
 * Nền tối dùng bảng màu tối (nhấn sáng, nền thẻ trong suốt).
 */
export function brandPalette(colors: BrandColors | undefined, dark: boolean): BrandPalette | null {
  if (!colors || !isBrandColor(colors.primary)) return null;
  const [h, s0, l0] = rgbToHsl(...hexToRgb(colors.primary)!);
  const s = Math.max(s0, 0.35);
  const derived = (shift: number) => hslToHex(h + shift, s, Math.min(0.5, Math.max(0.32, l0)));
  const secondaryRaw = isBrandColor(colors.secondary) ? colors.secondary : derived(24);
  const accentRaw = isBrandColor(colors.accent) ? colors.accent : derived(-24);
  const p = ensureContrast(colors.primary, dark);
  const q = ensureContrast(secondaryRaw, dark);
  const adjusted: BrandColorSlot[] = [];
  if (p.adjusted) adjusted.push("primary");
  if (isBrandColor(colors.secondary) && q.adjusted) adjusted.push("secondary");
  return {
    sa: p.hex,
    sa2: q.hex,
    accent: accentRaw,
    soft: tint(p.hex, dark, 0.92),
    soft2: tint(q.hex, dark, 0.95),
    sg: `linear-gradient(120deg, ${p.hex} 0%, ${q.hex} 100%)`,
    sgb: `linear-gradient(135deg, ${p.hex} 0%, ${accentRaw} 100%)`,
    on: contrastRatio("#FFFFFF", p.hex) >= 3 && contrastRatio("#FFFFFF", accentRaw) >= 3 ? "#FFFFFF" : "#111111",
    adjusted,
  };
}

// ── Nền xuyệt tông ──────────────────────────────────────────────────────────

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hueOf = (hex: string) => rgbToHsl(...hexToRgb(hex)!);

/**
 * Nền xuyệt tông sinh từ bảng màu thương hiệu: sắc độ của màu chính ở độ sáng rất cao (sáng) hoặc rất thấp (tối),
 * pha nhẹ sang sắc độ của màu phụ. Thuần tính toán, kết quả ổn định (không dùng AI). null nếu không áp dụng.
 */
export function brandBackground(colors: BrandColors | undefined, bg: BrandBg): string | null {
  if (bg === "theme" || !colors || !isBrandColor(colors.primary)) return null;
  const [h, s0] = hueOf(colors.primary);
  const h2 = isBrandColor(colors.secondary) ? hueOf(colors.secondary)[0] : h + 18;
  if (bg === "light") {
    const s = clamp(s0, 0.25, 0.55);
    return `linear-gradient(135deg, ${hslToHex(h, s, 0.965)} 0%, ${hslToHex(h2, s * 0.9, 0.94)} 100%)`;
  }
  const s = clamp(s0, 0.3, 0.6);
  return `linear-gradient(135deg, ${hslToHex(h, s, 0.09)} 0%, ${hslToHex(h2, s, 0.16)} 100%)`;
}

type BrandLike = Pick<BrandConfig, "colors" | "bg"> | null | undefined;

/** Chế độ nền thực sự áp dụng: không có bảng màu thì luôn theo giao diện. */
const effectiveBg = (b: BrandLike): BrandBg => (b?.colors ? b.bg : "theme");

/**
 * Mã giao diện dùng làm nền cho bộ màu chữ: nền xuyệt tông tối mượn bộ màu của giao diện tối, sáng thì của giao diện sáng;
 * "theme" giữ nguyên giao diện đang dùng.
 */
export function brandEffectiveThemeId(b: BrandLike, themeId: string | null | undefined): string | null | undefined {
  const m = effectiveBg(b);
  return m === "dark" ? "night" : m === "light" ? "white" : themeId;
}

/**
 * Nền của khung slide khi dùng nền xuyệt tông (null = để giao diện quyết định). Nền tối chỉ áp cho slide có bộ vẽ
 * hỗ trợ nền tối (darkCapable); slide tương tác vẫn nền sáng như các giao diện tối khác.
 */
export function brandFrameBackground(b: BrandLike, darkCapable: boolean): string | null {
  const m = effectiveBg(b);
  if (m === "theme") return null;
  if (m === "dark" && !darkCapable) return null;
  return brandBackground(b!.colors, m);
}

/** Biến CSS ghi đè bảng màu của giao diện (slideLayouts.css); nền xuyệt tông còn đặt cả màu chữ và thẻ theo tông sáng/tối. */
export function brandCssVars(b: BrandLike, themeDark: boolean): Record<string, string> {
  const m = effectiveBg(b);
  const dark = m === "dark" ? true : m === "light" ? false : themeDark;
  const p = brandPalette(b?.colors, dark);
  if (!p) return {};
  const vars: Record<string, string> = {
    "--sa": p.sa,
    "--sa2": p.sa2,
    "--ssoft": p.soft,
    "--ssoft2": p.soft2,
    "--sg": p.sg,
    "--sgb": p.sgb,
    "--son": p.on,
    "--sglow1": p.sa,
    "--sglow2": p.accent,
  };
  if (m !== "theme") {
    const bgc = brandBackground(b!.colors, m)!;
    vars["--sbg"] = bgc;
    if (dark) {
      Object.assign(vars, {
        "--stext": "#F1F5F9", "--smuted": "#C4CCE0", "--scard": "rgba(255,255,255,.07)", "--scardb": "rgba(255,255,255,.14)",
        "--sok": "#4ADE80", "--sokbg": "rgba(74,222,128,.16)", "--sbad": "#FCA5A5", "--sbadbg": "rgba(248,113,113,.14)",
      });
    } else {
      const [h] = hueOf(b!.colors!.primary);
      Object.assign(vars, {
        "--stext": "#20241F", "--smuted": "#5A6256", "--scard": "rgba(255,255,255,.82)", "--scardb": hslToHex(h, 0.25, 0.86),
        "--sok": "#15803D", "--sokbg": "#DCFCE7", "--sbad": "#B91C1C", "--sbadbg": "#FEE2E2",
      });
    }
  }
  return vars;
}

// ── Gợi ý màu từ logo ───────────────────────────────────────────────────────

/**
 * Lấy tối đa 3 màu nổi bật nhất của logo từ dữ liệu điểm ảnh RGBA (đã thu nhỏ): bỏ điểm trong suốt, gần trắng,
 * gần đen và xám; gom theo sắc độ, chọn các màu cách nhau đủ xa. Logo toàn xám/đen thì trả màu tối trung bình làm màu chính.
 * Thuần tính toán, chạy ngay trong trình duyệt, không tốn lượt AI.
 */
export function extractLogoColors(data: ArrayLike<number>, maxColors = 3): string[] {
  type Bucket = { r: number; g: number; b: number; n: number; w: number; h: number };
  const buckets = new Map<number, Bucket>();
  let darkR = 0, darkG = 0, darkB = 0, darkN = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
    if (a < 128) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l > 0.93) continue; // nền trắng
    if (s < 0.18 || l < 0.08) {
      if (l < 0.5) { darkR += r; darkG += g; darkB += b; darkN++; }
      continue;
    }
    const key = Math.floor(h / 15) % 24;
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, w: 0, h };
    bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.w += 0.5 + s; bk.h = h;
    buckets.set(key, bk);
  }
  const ranked = [...buckets.values()].sort((x, y) => y.w * y.n - x.w * x.n);
  const out: string[] = [];
  const hues: number[] = [];
  for (const bk of ranked) {
    if (out.length >= maxColors) break;
    const dh = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    if (hues.some((h) => dh(h, bk.h) < 25)) continue;
    hues.push(bk.h);
    out.push(rgbToHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n));
  }
  if (out.length === 0 && darkN > 0) out.push(rgbToHex(darkR / darkN, darkG / darkN, darkB / darkN));
  return out;
}

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("").toUpperCase();

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
