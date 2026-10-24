import { apiUrl } from "@/lib/apiUrl";

/**
 * Ghi lượt bấm trên trang Bắt đầu (AC6). "Gửi rồi quên" với keepalive để vẫn tới máy chủ khi trang đã
 * chuyển đi; không bao giờ chờ, không bao giờ ném lỗi — đo lường không được chặn học viên.
 */
export function sendOnboardingEvent(target: "sample" | "catalog_course" | "catalog_all", courseId?: string): void {
  try {
    void fetch(apiUrl("/api/me/onboarding-events"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, courseId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // bỏ qua
  }
}
