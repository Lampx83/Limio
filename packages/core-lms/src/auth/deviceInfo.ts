/**
 * Phân loại User-Agent thành nhãn thô cho log đăng nhập (`session.started`).
 *
 * Cố tình không dùng thư viện parse UA đầy đủ (ua-parser-js...): việc cần trả
 * lời chỉ là "điện thoại hay máy tính" và "trình duyệt gì" ở mức rất thô, và
 * chuỗi UA nguyên văn không bao giờ được lưu lại — xem `SessionStartedPayload`.
 * Thêm một thư viện phân tích chi tiết (model máy, engine version...) chỉ tạo
 * thêm bề mặt dữ liệu nhạy cảm mà không ai cần dùng.
 */
export interface DeviceInfo {
  device: "mobile" | "tablet" | "desktop" | "unknown";
  browser: string;
}

export function categorizeUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { device: "unknown", browser: "unknown" };

  const device: DeviceInfo["device"] = /ipad|tablet(?!.*mobile)/i.test(ua)
    ? "tablet"
    : /mobi|iphone|ipod|android.*mobile/i.test(ua)
      ? "mobile"
      : /android|macintosh|windows|linux|x11/i.test(ua)
        ? "desktop"
        : "unknown";

  // Thứ tự bắt buộc: UA của Edge chứa cả "Chrome" lẫn "Safari"; UA của Chrome
  // cũng chứa "Safari". Phải khớp cái đặc hiệu nhất trước.
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : "Other";

  return { device, browser };
}
