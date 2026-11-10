/**
 * Vai đang dùng có phải "người học" không (không phải giảng viên/admin). Dùng cho các trang /language và khung bài học
 * Language: giảng viên/admin được chuyển về khu của họ, và không thấy khung bài học của học viên.
 * (Trước đây tên `languageShellIsLearner` trong languageMenu.ts, khi còn "vỏ" Language riêng — đã bỏ, xem
 * docs/tieu-chi/limio-language-gop-menu.md.)
 */
export function isLearnerRole(activeRole: string): boolean {
  return activeRole !== "instructor" && activeRole !== "admin";
}
