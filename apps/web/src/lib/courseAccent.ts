/**
 * Màu nhấn của bộ sách (`Course.themeColor`, dạng "r,g,b" — vd "229,0,92"). Trang học viên của khoá dùng MỘT màu này cho khung bài học, thân bài và khối
 * luyện tập; không hợp lệ hoặc trống thì dùng màu Limio. Trả giá trị cho biến CSS `--brand` ("229 0 92") hoặc null.
 */
export function accentVar(accent: string | null | undefined): string | null {
  if (!accent) return null;
  const m = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/.exec(accent.trim());
  if (!m || [m[1], m[2], m[3]].some((v) => Number(v) > 255)) return null;
  return `${m[1]} ${m[2]} ${m[3]}`;
}
