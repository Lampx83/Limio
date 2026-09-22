/**
 * Phát hiện trình duyệt nhúng bên trong app chat/mạng xã hội (Zalo, Messenger,
 * Instagram, TikTok, WeChat, Line...). Google chặn đăng nhập OAuth từ các
 * webview này ("disallowed_useragent") nên đăng nhập sẽ luôn thất bại dù thử
 * lại bao nhiêu lần — cần phát hiện sớm để hướng dẫn mở bằng trình duyệt thật.
 *
 * Thuần, chạy được cả server (đọc header user-agent) lẫn client
 * (navigator.userAgent) — không phụ thuộc DOM/Node API nào.
 */
export interface InAppBrowserInfo {
  appName: string;
}

const PATTERNS: Array<[RegExp, string]> = [
  [/zalo/i, "Zalo"],
  [/FBAN|FBAV|FB_IAB|FBSV/i, "Facebook"],
  [/\bMessenger\b/i, "Messenger"],
  [/Instagram/i, "Instagram"],
  [/musical_ly|TikTok|BytedanceWebview/i, "TikTok"],
  [/Line\//i, "Line"],
  [/MicroMessenger/i, "WeChat"],
];

export function detectInAppBrowser(ua: string | null | undefined): InAppBrowserInfo | null {
  if (!ua) return null;
  for (const [pattern, appName] of PATTERNS) {
    if (pattern.test(ua)) return { appName };
  }
  return null;
}
