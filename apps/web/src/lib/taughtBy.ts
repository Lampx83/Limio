/**
 * Tên hiện ở dòng "Giảng dạy bởi" trang giới thiệu khoá.
 *
 * Trường "Tác giả" của khoá (`Course.authors`) thắng khi có: giảng viên thật của nhiều khoá không có (và không cần) tài
 * khoản Limio — người dựng khoá là chủ sở hữu, còn người giảng trong video là người khác. Trống thì lấy như cũ: các
 * giảng viên chính (role `owner`), không phải mọi người có quyền sửa — trợ giảng giữ quyền mà không lên banner.
 */
export function taughtByNames(course: {
  authors: string | null;
  instructors: Array<{ role: string; user: { displayName: string } }>;
}): string[] {
  const authors = course.authors
    ?.split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (authors && authors.length > 0) return authors;
  return course.instructors.filter((i) => i.role === "owner").map((i) => i.user.displayName);
}
