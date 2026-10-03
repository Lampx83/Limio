import { RoleName } from "@feedbackme/shared-types";

/**
 * Trang đích mặc định sau đăng nhập. Một nguồn duy nhất cho cả trang chủ
 * (`app/page.tsx`, redirect phía server) và form đăng nhập (đi thẳng, bỏ một
 * vòng qua "/" rồi mới bị redirect). Ưu tiên Instructor (đa số task hằng ngày
 * là dạy học); Admin chỉ là landing khi user thuần admin — admin kiêm
 * instructor vào /instructor/dashboard và tự nav sang /admin/dashboard khi cần.
 * Không dùng cookie active-role: lúc vừa đăng nhập cookie chưa có.
 */
export function landingPathForRoles(roles: readonly string[]): string {
  if (roles.includes(RoleName.Instructor)) return "/instructor/dashboard";
  if (roles.includes(RoleName.Admin)) return "/admin/dashboard";
  return "/me/dashboard";
}
