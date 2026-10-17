import type { CSSProperties } from "react";
import type { LessonLook, LessonPaletteKey } from "@feedbackme/shared-types";

/**
 * Màu của 6 bảng màu bài học. Đây là nguồn duy nhất: trang hiển thị đặt các
 * giá trị này thành biến CSS trên khung bài (lessonStyleVars), còn
 * lessonLook.test.ts kiểm độ tương phản trên chính các giá trị này — nên CSS và
 * bài kiểm không thể lệch nhau.
 *
 * Ý nghĩa từng màu:
 * - bg: nền bài · text: chữ thường · muted: chữ phụ (chú thích ảnh, trích dẫn)
 * - line: đường kẻ, viền thẻ (trang trí, không mang chữ)
 * - accent: tiêu đề phần, viền nhấn, số lớn · soft: nền hộp và thẻ
 */
export interface LessonColors {
  bg: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  soft: string;
}

export interface LessonPalette {
  light: LessonColors;
  dark: LessonColors;
  /** Chỉ "Sinh động": mỗi mục lớn lần lượt nhận một cặp [accent, soft]. */
  cycle?: { light: Array<[string, string]>; dark: Array<[string, string]> };
}

const LIMIO_LIGHT: LessonColors = {
  bg: "#ffffff",
  text: "#1f2937",
  muted: "#4b5563",
  line: "#e5e7eb",
  accent: "#1d4ed8",
  soft: "#eef3ff",
};
const LIMIO_DARK: LessonColors = {
  bg: "#14171d",
  text: "#e7e9ee",
  muted: "#aab1bf",
  line: "#2c323d",
  accent: "#8fb0ff",
  soft: "#1b2436",
};

export const LESSON_PALETTES: Record<LessonPaletteKey, LessonPalette> = {
  limio: { light: LIMIO_LIGHT, dark: LIMIO_DARK },
  paper: {
    light: { bg: "#fbf7ef", text: "#33291e", muted: "#5f5141", line: "#e8dcc6", accent: "#9a4a0b", soft: "#f4ead6" },
    dark: { bg: "#1c1813", text: "#efe6d8", muted: "#bfb19c", line: "#3a3226", accent: "#f0b36c", soft: "#2a2219" },
  },
  forest: {
    light: { bg: "#ffffff", text: "#1c2a22", muted: "#46564c", line: "#dde8e1", accent: "#166534", soft: "#ecf7f0" },
    dark: { bg: "#121915", text: "#e2ece5", muted: "#a7b8ad", line: "#26332b", accent: "#7fd39d", soft: "#18251d" },
  },
  sunset: {
    light: { bg: "#ffffff", text: "#2b1f1a", muted: "#5c4a42", line: "#f0dfd6", accent: "#b23a0a", soft: "#fff1e8" },
    dark: { bg: "#1b1513", text: "#f1e5df", muted: "#c3aea4", line: "#3a2a24", accent: "#ff9e6e", soft: "#2a1c16" },
  },
  vibrant: {
    light: LIMIO_LIGHT,
    dark: LIMIO_DARK,
    cycle: {
      light: [
        ["#1d4ed8", "#eef3ff"],
        ["#15803d", "#ecf7f0"],
        ["#a14a06", "#fff4e5"],
        ["#be185d", "#fdf0f6"],
        ["#6d28d9", "#f4effe"],
      ],
      dark: [
        ["#8fb0ff", "#1b2436"],
        ["#7fd39d", "#18251d"],
        ["#f5b46a", "#2a2117"],
        ["#f598c0", "#2a1820"],
        ["#c4a6ff", "#221b33"],
      ],
    },
  },
  plain: {
    light: { bg: "#ffffff", text: "#111827", muted: "#4b5563", line: "#e5e7eb", accent: "#374151", soft: "#f3f4f6" },
    dark: { bg: "#151515", text: "#ececec", muted: "#a9a9a9", line: "#303030", accent: "#d4d4d4", soft: "#1f1f1f" },
  },
};

const COLOR_KEYS: Array<keyof LessonColors> = ["bg", "text", "muted", "line", "accent", "soft"];

/**
 * Biến CSS đặt lên khung bài. Mỗi màu có hai bản (-l sáng, -d tối); lessonLook.css
 * chọn bản theo lớp `.dark` của trang, nên không phải render lại khi đổi chế độ.
 */
export function lessonStyleVars(look: LessonLook): CSSProperties {
  const p = LESSON_PALETTES[look.palette];
  const vars: Record<string, string> = {};
  for (const k of COLOR_KEYS) {
    vars[`--lk-${k}-l`] = p.light[k];
    vars[`--lk-${k}-d`] = p.dark[k];
  }
  if (p.cycle) {
    p.cycle.light.forEach(([a, s], i) => {
      vars[`--lk-c${i + 1}-l`] = a;
      vars[`--lk-s${i + 1}-l`] = s;
    });
    p.cycle.dark.forEach(([a, s], i) => {
      vars[`--lk-c${i + 1}-d`] = a;
      vars[`--lk-s${i + 1}-d`] = s;
    });
  }
  return vars as CSSProperties;
}

/** Độ tương phản WCAG 2.1 giữa hai màu dạng #rrggbb. */
export function contrastRatio(fg: string, bg: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const lin = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
