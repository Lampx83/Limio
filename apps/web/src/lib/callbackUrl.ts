/**
 * Đích quay về sau đăng nhập / đăng ký / xác minh email (`?callbackUrl=`).
 * Học viên mở link mời vào lớp (`/enroll/<mã>`) khi chưa có tài khoản sẽ đi
 * qua cả ba trang này — đích phải theo họ suốt chặng, nếu không họ đăng ký
 * xong lại rơi vào trang tổng quan trống thay vì vào lớp.
 *
 * Chỉ chấp nhận path nội bộ ("/a/b") — chặn open-redirect qua "//evil.com"
 * hay "https://evil.com" lẻn vào query string. Không hợp lệ ⇒ "/".
 */
export function sanitizeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return "/";
  }
  return raw;
}

/** Gắn `?callbackUrl=` vào một trang auth, bỏ qua khi đích là mặc định "/". */
export function withCallbackUrl(path: string, callbackPath: string): string {
  if (callbackPath === "/") return path;
  return `${path}?callbackUrl=${encodeURIComponent(callbackPath)}`;
}
