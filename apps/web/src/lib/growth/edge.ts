/**
 * Mỏng nối middleware ↔ `decideAttributionCookie`. Chạy ở edge runtime: chỉ dùng
 * API của Next/Web, không có Node `crypto`/`Buffer`/Prisma.
 */
import type { NextRequest, NextResponse } from "next/server";
import {
  ATTRIBUTION_COOKIE,
  attributionCookieOptions,
  decideAttributionCookie,
  type AttributionDecision,
} from "./attribution";

function hostsFromEnv(env: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  for (const v of [env.NEXTAUTH_URL, env.SITE_URL]) {
    if (!v) continue;
    try {
      out.push(new URL(v).hostname);
    } catch {
      // bỏ qua giá trị không phải URL
    }
  }
  return out;
}

/**
 * Gắn cookie first-touch vào `res` nếu cần. Không bao giờ throw — lỗi ở đây
 * không được phép làm hỏng một request trang.
 */
export function applyAttributionCookie(
  req: NextRequest,
  res: NextResponse,
  env: Record<string, string | undefined> = process.env,
): AttributionDecision | null {
  try {
    const h = req.headers;
    const siteHosts = [
      h.get("x-forwarded-host") ?? "",
      h.get("host") ?? "",
      req.nextUrl.hostname,
      ...hostsFromEnv(env),
    ]
      .flatMap((x) => x.split(","))
      .map((x) => x.trim())
      .filter((x) => x !== "");

    const decision = decideAttributionCookie({
      method: req.method,
      pathname: req.nextUrl.pathname,
      searchParams: req.nextUrl.searchParams,
      referer: h.get("referer"),
      siteHosts,
      existingCookie: req.cookies.get(ATTRIBUTION_COOKIE)?.value,
      nowSec: Math.floor(Date.now() / 1000),
      secFetchDest: h.get("sec-fetch-dest"),
      isPrefetch:
        h.has("next-router-prefetch") ||
        (h.get("purpose") ?? "").toLowerCase() === "prefetch" ||
        (h.get("sec-purpose") ?? "").toLowerCase().includes("prefetch"),
    });

    if (decision.action === "set") {
      // Sau hai lớp proxy (nginx → Caddy → app) ứng dụng thấy kết nối là http thường dù
      // người dùng vào bằng https, nên x-forwarded-proto không đủ tin. Site công khai
      // đã khai https qua NEXTAUTH_URL thì cookie luôn Secure.
      const proto = (h.get("x-forwarded-proto") ?? req.nextUrl.protocol).toLowerCase();
      const secure =
        proto.startsWith("https") || (env.NEXTAUTH_URL ?? "").trim().toLowerCase().startsWith("https://");
      res.cookies.set(ATTRIBUTION_COOKIE, decision.value, attributionCookieOptions(secure));
    }
    return decision;
  } catch {
    return null;
  }
}
