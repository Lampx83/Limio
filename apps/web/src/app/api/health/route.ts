import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health — healthcheck cho Docker HEALTHCHECK và bước chờ deploy.
 *
 * Kiểm Postgres (`SELECT 1` qua Prisma → PgBouncer) và Redis (`PING`). Không
 * cần đăng nhập, nên body chỉ nói ok/không — chi tiết lỗi chỉ ghi log.
 *
 * Mỗi phép kiểm có timeout riêng: Redis client dùng `maxRetriesPerRequest: null`
 * nên khi Redis chết lệnh PING xếp hàng mãi mãi; không có timeout thì healthcheck
 * treo tới khi curl tự cắt thay vì trả 503 rõ ràng.
 */
const CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), CHECK_TIMEOUT_MS);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export async function GET() {
  const [db, redis] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, "db"),
    withTimeout(getRedis().ping(), "redis"),
  ]);

  const failures = [
    db.status === "rejected" ? ["db", db.reason] : null,
    redis.status === "rejected" ? ["redis", redis.reason] : null,
  ].filter((f): f is [string, unknown] => f !== null);

  for (const [name, reason] of failures) {
    console.error(`[health] ${name} check failed:`, reason instanceof Error ? reason.message : reason);
  }

  const ok = failures.length === 0;
  return NextResponse.json(
    { status: ok ? "ok" : "error" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
