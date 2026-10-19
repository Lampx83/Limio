import { NextResponse, type NextRequest } from "next/server";
import { APP_MODE_COOKIE, safeNextPath } from "@/lib/appMode";

/**
 * LANG L1.3 — đổi chế độ ứng dụng (vỏ Limio Language ↔ Limio thường).
 * `GET /api/app-mode?to=language|default&next=/duong/dan`. Chỉ đặt cookie HIỂN THỊ rồi chuyển hướng; không cấp
 * quyền và không đọc session. `next` chỉ nhận đường dẫn nội bộ (chống open redirect).
 */
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to");
  if (to !== "language" && to !== "default") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const next = safeNextPath(req.nextUrl.searchParams.get("next"), to === "language" ? "/language" : "/");
  // `nextUrl.clone()` giữ basePath của ứng dụng; chỉ thay phần đường dẫn + query.
  const url = req.nextUrl.clone();
  const q = next.indexOf("?");
  url.pathname = q < 0 ? next : next.slice(0, q);
  url.search = q < 0 ? "" : next.slice(q);
  const res = NextResponse.redirect(url);
  res.cookies.set(APP_MODE_COOKIE, to, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false, // chỉ là tuỳ chọn hiển thị
  });
  return res;
}
