import { Be_Vietnam_Pro, Lexend, Noto_Serif } from "next/font/google";

/**
 * Ba kiểu chữ của bài học. Nhúng qua next/font (tự host, không gọi Google lúc
 * học viên xem) và chỉ tải ở trang có bài văn bản, nên không làm nặng trang khác.
 * Cả ba đều có bộ ký tự tiếng Việt.
 */
const vietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--lk-font-vietnam",
});

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--lk-font-lexend",
});

const serif = Noto_Serif({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--lk-font-serif",
});

/** Gắn lên khung bài để lessonLook.css dùng được ba biến font ở trên. */
export const LESSON_FONT_VARIABLES = `${vietnam.variable} ${lexend.variable} ${serif.variable}`;
