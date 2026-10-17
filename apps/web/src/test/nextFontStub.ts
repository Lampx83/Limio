/**
 * next/font chỉ chạy được trong trình biên dịch của Next — trong vitest nó không
 * phải hàm. Bản giả này trả về lớp/biến rỗng để test component nạp được các
 * module có khai báo font (vd. components/lesson/lessonFonts.ts).
 */
type FontResult = { className: string; variable: string; style: { fontFamily: string } };
const font = (): FontResult => ({ className: "", variable: "", style: { fontFamily: "" } });

export const Be_Vietnam_Pro = font;
export const Lexend = font;
export const Noto_Serif = font;
export const Inter = font;
export const Nunito = font;
