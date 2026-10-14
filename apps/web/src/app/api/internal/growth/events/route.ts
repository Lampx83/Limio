import { NextResponse } from "next/server";
import { getGrowthSecrets } from "@/lib/growth/config";
import { verifyGrowthRequest } from "@/lib/growth/signature";
import { buildEventsPage, parseCursor, parseLimit, parseTypes } from "@/lib/growth/events";
import { createPrismaSources, loadTouches } from "@/lib/growth/eventSources";
import { allow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/internal/growth/events — luồng sự kiện phễu ẩn danh cho SIM.
 * Hợp đồng + quyền riêng tư: docs/growth-events.md.
 *
 * CHỈ ĐỌC: không có write nào trên route này (nguồn dữ liệu ở
 * lib/growth/eventSources.ts chỉ SELECT). Tắt hẳn (404) khi thiếu
 * GROWTH_EVENTS_SECRET / GROWTH_ANON_SECRET (>= 32 ký tự).
 */

/** Chờ sự kiện "lắng" trước khi phát: transaction chưa commit có `now()` cũ. */
const SETTLE_MS = 30_000;
/** Mỗi phút tối đa chừng này request (toàn cục) — SIM poll vài phút một lần. */
const RATE_LIMIT_PER_MIN = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export async function GET(req: Request) {
  const secrets = getGrowthSecrets();
  if (!secrets) return json({ error: "not_found" }, 404);

  const url = new URL(req.url);
  const nowSec = Math.floor(Date.now() / 1000);

  const verdict = verifyGrowthRequest({
    secret: secrets.eventsSecret,
    timestampHeader: req.headers.get("x-growth-timestamp"),
    signatureHeader: req.headers.get("x-growth-signature"),
    method: req.method,
    pathname: url.pathname,
    rawQuery: url.search.startsWith("?") ? url.search.slice(1) : url.search,
    nowSec,
  });
  if (!verdict.ok) return json({ error: "unauthorized" }, 401);

  const limit = parseLimit(url.searchParams.get("limit"));
  if (!limit.ok) return json({ error: limit.error }, 400);
  const types = parseTypes(url.searchParams.get("types"));
  if (!types.ok) return json({ error: types.error }, 400);
  const cursor = parseCursor(url.searchParams.get("cursor"));
  if (!cursor.ok) return json({ error: cursor.error }, 400);

  const rl = await allow("growth-events", "all", RATE_LIMIT_PER_MIN, 60_000);
  if (!rl.ok) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(rl.retryAfterSec) });
  }

  const upTo = new Date(Date.now() - SETTLE_MS);
  try {
    const page = await buildEventsPage({
      sources: createPrismaSources(types.value, upTo),
      cursor: cursor.value,
      limit: limit.value,
      anonSecret: secrets.anonSecret,
      upTo,
      loadTouches,
    });
    return json(page);
  } catch (e) {
    // Không đưa chi tiết lỗi ra ngoài (có thể chứa SQL/id).
    console.error("[growth-events] failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "internal_error" }, 500);
  }
}
