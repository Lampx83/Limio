/**
 * Cờ bật/tắt video giảng viên nói (docs/tieu-chi/trinh-chieu-giang-vien.md, AC7). Mặc định BẬT: có video thì dùng, không có thì
 * ảnh tĩnh. Đặt `NARRATION_LECTURER_VIDEO=0` (hoặc `off`/`false`) để tắt cho mọi bài mà không cần sửa dữ liệu.
 */
export function lecturerVideoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.NARRATION_LECTURER_VIDEO ?? "").trim().toLowerCase();
  return !(v === "0" || v === "off" || v === "false" || v === "no");
}
