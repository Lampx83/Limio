/**
 * Ánh xạ vai trò → không gian làm việc (thuần, không phụ thuộc Next để test được).
 *
 * `center_teacher` (giảng viên trung tâm, chỉ dạy) không có chế độ riêng để chuyển sang: người đó làm việc ở
 * không gian "Giảng viên", chỉ khác là menu và trang chủ rút gọn thành việc dạy (xem `isTeachingOnly`).
 */

// Vai "năng lực cộng thêm" — không phải một chế độ làm việc để chuyển sang, nên không bao giờ là active role.
export const CAPABILITY_ROLES = ["researcher"];

export function switchableRoles(roles: string[]): string[] {
  const base = roles.filter((r) => !CAPABILITY_ROLES.includes(r) && r !== "center_teacher");
  if (roles.includes("center_teacher") && !base.includes("instructor")) base.push("instructor");
  return base;
}

/** Chỉ dạy, không soạn: có vai trò giảng viên trung tâm mà không phải giảng viên thường hay quản trị. */
export function isTeachingOnly(roles: string[]): boolean {
  return roles.includes("center_teacher") && !roles.includes("instructor") && !roles.includes("admin");
}
