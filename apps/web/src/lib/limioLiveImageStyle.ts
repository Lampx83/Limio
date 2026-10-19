// Kiểu trình bày và khung hình của bố cục "Chữ và hình" (docs/tieu-chi/chu-va-hinh-kieu-khung.md). Cùng nội dung (tiêu đề,
// các ý, hình), chỉ đổi cách đặt; hệ thống tự xen kẽ kiểu để bài không đơn điệu, khung chọn chung cho cả bài. Hàm thuần.

export const IMAGE_STYLES = ["right", "left", "bleed", "top", "overlay", "inset"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const IMAGE_STYLE_LABEL: Record<ImageStyle, string> = {
  right: "Hình bên phải",
  left: "Hình bên trái",
  bleed: "Hình tràn nửa slide",
  top: "Hình trên, ý dưới",
  overlay: "Hình nền, khối chữ phủ",
  inset: "Hình nhỏ có chú thích",
};

export const IMAGE_FRAMES = ["round", "circle", "arch", "hex", "blob", "leaf", "offset"] as const;
export type ImageFrame = (typeof IMAGE_FRAMES)[number];

export const IMAGE_FRAME_LABEL: Record<ImageFrame, string> = {
  round: "Bo góc",
  circle: "Tròn",
  arch: "Vòm",
  hex: "Lục giác",
  blob: "Hình giọt",
  leaf: "Lá",
  offset: "Khung lệch",
};

export const isImageStyle = (v: unknown): v is ImageStyle => typeof v === "string" && (IMAGE_STYLES as readonly string[]).includes(v);
export const isImageFrame = (v: unknown): v is ImageFrame => typeof v === "string" && (IMAGE_FRAMES as readonly string[]).includes(v);

type Cfg = Record<string, unknown> | null | undefined;

/** Tổng tiêu đề và các ý từ mức này trở lên là "chữ dài" (K5). */
export const LONG_TEXT_CHARS = 280;

const plain = (v: unknown) => (typeof v === "string" ? v.replace(/\*\*|==|\*/g, "") : "");
const bulletsOf = (c: Cfg): string[] => (Array.isArray(c?.bullets) ? (c!.bullets as unknown[]).filter((b): b is string => typeof b === "string" && !!b.trim()) : []);
const hasPhoto = (c: Cfg) => typeof c?.imageUrl === "string" && !!c.imageUrl.trim();
const textLength = (c: Cfg) => plain(c?.title).length + bulletsOf(c).reduce((n, b) => n + plain(b).length, 0);

/** Kiểu có hợp với slide không (K3, K5): hình trên và hình nền cần ảnh thật và chữ không dài; hình trên cần 2–3 ý. */
export function imageStyleFits(style: ImageStyle, config: Cfg): boolean {
  if (style !== "top" && style !== "overlay") return true;
  if (!hasPhoto(config) || textLength(config) >= LONG_TEXT_CHARS) return false;
  if (style === "top") {
    const n = bulletsOf(config).length;
    return n >= 2 && n <= 3;
  }
  return true;
}

/** Kiểu thật sự vẽ: chọn tay (nếu hợp), không thì kiểu hệ thống chọn, không thì "Hình bên phải" (K2, K3). */
export function resolveImageStyle(config: Cfg, auto?: ImageStyle): ImageStyle {
  const own = config?.imageStyle;
  if (isImageStyle(own)) return imageStyleFits(own, config) ? own : "right";
  return auto && imageStyleFits(auto, config) ? auto : "right";
}

const RING_PHOTO: readonly ImageStyle[] = ["right", "bleed", "left", "top", "overlay"];
const RING_MOTIF: readonly ImageStyle[] = ["right", "left", "bleed", "inset"];

/**
 * Kiểu tự động của từng slide Chữ và hình trong bài, theo thứ tự trình chiếu (K4–K6): xoay vòng theo thứ tự của slide
 * trong các slide Chữ và hình (không tính slide ẩn); kiểu không hợp hoặc trùng slide Chữ và hình liền trước thì lấy kiểu kế
 * tiếp; chữ dài nhận "Hình nhỏ có chú thích" thay cho lượt tràn nửa hoặc hình trên. Slide đã chọn tay vẫn tính vào thứ tự
 * và vào phép so "liền trước".
 */
export function autoImageStyles(slides: ReadonlyArray<{ id: string; type?: string; config?: unknown }>): Map<string, ImageStyle> {
  const out = new Map<string, ImageStyle>();
  let k = 0;
  let prev: ImageStyle | null = null;
  for (const s of slides) {
    if (s.type && s.type !== "content") continue;
    const c = (s.config ?? null) as Cfg;
    if (c?.layout !== "image" || c?.hidden === true || c?.resource) continue;
    const ring = hasPhoto(c) ? RING_PHOTO : RING_MOTIF;
    const long = textLength(c) >= LONG_TEXT_CHARS;
    let pick: ImageStyle = "right";
    for (let step = 0; step < ring.length; step++) {
      let cand = ring[(k + step) % ring.length]!;
      if (long && (cand === "bleed" || cand === "top")) cand = "inset";
      if (!imageStyleFits(cand, c) || (k > 0 && cand === prev)) continue;
      pick = cand;
      break;
    }
    if (k === 0) pick = "right";
    out.set(s.id, pick);
    prev = resolveImageStyle(c, pick);
    k += 1;
  }
  return out;
}

/** Kiểu có ô hình riêng mới có khung; tràn nửa, hình trên, hình nền thì không (K8). */
export const frameApplies = (style: ImageStyle): boolean => style === "right" || style === "left" || style === "inset";

const FRAME_BY_MOTIF: Record<string, ImageFrame> = {
  lucgiac: "hex",
  cham: "circle",
  vong: "circle",
  diemnoi: "circle",
  cung: "arch",
  song: "blob",
  dongchay: "blob",
  khoi: "blob",
};

/** Khung tự động theo hoa văn chủ đạo của bài (K9). */
export function autoImageFrame(deckMotif: string | null | undefined): ImageFrame {
  return (deckMotif && FRAME_BY_MOTIF[deckMotif]) || "round";
}

/** Khung của slide: chọn riêng cho slide, không thì của cả bài, không thì tự động theo hoa văn (K10). */
export function resolveImageFrame(input: { config: Cfg; deckFrame: unknown; deckMotif: string | null | undefined }): ImageFrame {
  const own = input.config?.imageFrame;
  if (isImageFrame(own)) return own;
  if (isImageFrame(input.deckFrame)) return input.deckFrame;
  return autoImageFrame(input.deckMotif);
}
