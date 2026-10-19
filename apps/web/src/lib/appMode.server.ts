import { cookies, headers } from "next/headers";
import { APP_MODE_COOKIE, resolveAppMode, type AppMode } from "@/lib/appMode";

/**
 * LANG L1 — chế độ ứng dụng của yêu cầu hiện tại (chỉ dùng ở server component/layout).
 * Chỉ đổi VỎ; không bao giờ dùng để quyết định quyền truy cập.
 */
export function getAppMode(): AppMode {
  return resolveAppMode({
    cookie: cookies().get(APP_MODE_COOKIE)?.value,
    host: headers().get("host"),
    languageHost: process.env.LANGUAGE_HOST,
  });
}
