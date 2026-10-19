import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@feedbackme/db", () => ({ prisma: { $queryRaw: queryRaw } }));
const ping = vi.fn();
vi.mock("@/lib/redis", () => ({ getRedis: () => ({ ping }) }));

const { GET } = await import("./route");

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    ping.mockReset().mockResolvedValue("PONG");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("200 khi DB và Redis đều trả lời", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("503 khi DB lỗi, không lộ chi tiết lỗi", async () => {
    queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED pgbouncer:6432"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error" });
  });

  it("503 khi Redis lỗi", async () => {
    ping.mockRejectedValue(new Error("redis down"));
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("503 khi Redis treo thay vì treo theo", async () => {
    vi.useFakeTimers();
    try {
      ping.mockReturnValue(new Promise(() => {}));
      const pending = GET();
      await vi.advanceTimersByTimeAsync(2500);
      const res = await pending;
      expect(res.status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });
});
