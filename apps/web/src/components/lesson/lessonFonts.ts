import localFont from "next/font/local";

/**
 * Ba kiểu chữ của bài học, lưu sẵn trong repo (./fonts, giấy phép OFL đi kèm)
 * và chỉ tải ở trang có bài văn bản, nên không làm nặng trang khác.
 *
 * Không dùng next/font/google: lúc build, trình tải của Next đòi đường dẫn tệp
 * font kết thúc bằng .woff2/.ttf, mà Google trả kiểu đường dẫn khác cho máy
 * build ở AWS ⇒ build hỏng mỗi lần (11/2026). Mỗi tệp đã cắt còn bộ ký tự
 * latin + latin-ext + tiếng Việt (fontTools subset → woff2).
 */
const vietnam = localFont({
  src: [
    { path: "./fonts/BeVietnamPro-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/BeVietnamPro-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/BeVietnamPro-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/BeVietnamPro-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/BeVietnamPro-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--lk-font-vietnam",
});

const lexend = localFont({
  src: "./fonts/Lexend-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--lk-font-lexend",
});

const serif = localFont({
  src: [
    { path: "./fonts/NotoSerif-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/NotoSerif-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--lk-font-serif",
});

/** Gắn lên khung bài để lessonLook.css dùng được ba biến font ở trên. */
export const LESSON_FONT_VARIABLES = `${vietnam.variable} ${lexend.variable} ${serif.variable}`;
