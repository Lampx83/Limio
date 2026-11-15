import type { SpaceConfig, SpacePalette } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Trộn `hex` với `mixWith` theo tỉ lệ `t` (0 = hex, 1 = mixWith). */
export function mixHex(hex: string, mixWith: string, t: number): string {
  const a = toRgb(hex);
  const b = toRgb(mixWith);
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** Từ màu chủ đạo + màu nhấn, suy ra bộ màu đầy đủ (người quản trị chỉ cần chọn 1–2 màu). */
export function derivePalette(
  primary: string,
  accent: string,
  overrides: Partial<Pick<SpacePalette, "dark" | "soft" | "accent2">> = {},
): SpacePalette {
  return {
    primary,
    dark: overrides.dark ?? mixHex(primary, "#000000", 0.22),
    soft: overrides.soft ?? mixHex(primary, "#FFFFFF", 0.84),
    accent,
    accent2: overrides.accent2 ?? mixHex(primary, "#000000", 0.4),
  };
}

function rgbTriplet(hex: string): string {
  return toRgb(hex).join(" ");
}

/**
 * CSS đổi giao diện Limio sang bộ màu của space. Palette Tailwind của Limio là hex cố định (không phải biến CSS)
 * nên ghi đè đúng các lớp thương hiệu mà trang đang dùng. Chỉ được chèn ở các trang thuộc space (xem layout gốc),
 * nên không ảnh hưởng nơi khác. Mọi giá trị đi vào CSS đều đã qua `isHexColor`.
 */
export function spaceThemeCss(p: SpacePalette): string {
  const { primary: P, dark: D, soft: S } = p;
  const B = "body";
  return [
    `:root{--brand:${rgbTriplet(P)};--brand-soft:${rgbTriplet(S)}}`,
    `${B} .bg-brand-gradient{background-image:linear-gradient(135deg,${P} 0%,${D} 100%)}`,
    `${B} .text-brand-600,${B} .text-brand-700,${B} .hover\\:text-brand-600:hover,${B} .hover\\:text-brand-700:hover,${B} .link{color:${P}}`,
    `${B} .bg-brand-50{background-color:${S}}`,
    `${B} .bg-brand-500{background-color:${P}}`,
    `${B} .border-brand-500{border-color:${P}}`,
    `${B} .accent-brand-600{accent-color:${P}}`,
    `${B} .btn-primary{background-color:${P}}`,
    `${B} .btn-primary:hover{background-color:${D};box-shadow:0 8px 24px -8px rgb(${rgbTriplet(P).replace(/ /g, " ")}/.5)}`,
    `${B} .shadow-card-hover{box-shadow:0 2px 4px 0 rgb(15 23 42/.06),0 12px 24px -8px rgb(${rgbTriplet(P)}/.22)}`,
  ].join("\n");
}

export function themeCssFor(cfg: Pick<SpaceConfig, "palette">): string {
  return spaceThemeCss(cfg.palette);
}
