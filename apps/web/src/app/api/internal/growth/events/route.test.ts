import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GrowthEventSource, RawRow, TouchSource } from "@/lib/growth/events";
import { signGrowthRequest } from "@/lib/growth/signature";

const EVENTS_SECRET = "0123456789abcdef0123456789abcdef";
const ANON_SECRET = "fedcba9876543210fedcba9876543210";
const PATH = "/api/internal/growth/events";

const created = new Date(Date.now() - 3600_000);
const rows: RawRow[] = [
  { key: "11111111-user", userId: "11111111-user", occurredAt: created },
  { key: "22222222-user", userId: "22222222-user", occurredAt: new Date(created.getTime() + 1000) },
];
const memory: GrowthEventSource = {
  type: "user.registered",
  async fetchAt(at) {
    return rows.filter((r) => r.occurredAt.getTime() === at.getTime());
  },
  async fetchAfter(after, n, upTo) {
    return rows
      .filter((r) => r.occurredAt <= upTo && (after === null || r.occurredAt > after))
      .slice(0, n);
  },
};
const createPrismaSources = vi.fn((types: string[]) => (types.includes("user.registered") ? [memory] : []));
const loadTouches = vi.fn(
  async () =>
    new Map<string, TouchSource>([
      [
        "11111111-user",
        {
          utmSource: "facebook",
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null,
          clickIdKind: null,
          landingPath: "/catalog",
          referrerHost: null,
        },
      ],
    ]),
);
vi.mock("@/lib/growth/eventSources", () => ({ createPrismaSources, loadTouches }));
const allow = vi.fn(async () => ({ ok: true as const, remaining: 10 }));
vi.mock("@/lib/rate-limit", () => ({ allow }));

const savedEnv = { ...process.env };

function signed(query = "", opts: { ts?: number; secret?: string; path?: string } = {}) {
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const sig = signGrowthRequest({
    secret: opts.secret ?? EVENTS_SECRET,
    timestamp: ts,
    method: "GET",
    pathname: opts.path ?? PATH,
    rawQuery: query,
  });
  return new Request(`http://limio.test${PATH}${query ? `?${query}` : ""}`, {
    headers: { "x-growth-timestamp": ts, "x-growth-signature": sig },
  });
}

beforeEach(() => {
  process.env.GROWTH_EVENTS_SECRET = EVENTS_SECRET;
  process.env.GROWTH_ANON_SECRET = ANON_SECRET;
  createPrismaSources.mockClear();
  allow.mockClear().mockResolvedValue({ ok: true, remaining: 10 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("GET /api/internal/growth/events", () => {
  it("404 khi thiếu hoặc ngắn bí mật (kể cả request ký đúng)", async () => {
    const { GET } = await import("./route");
    delete process.env.GROWTH_EVENTS_SECRET;
    expect((await GET(signed())).status).toBe(404);
    process.env.GROWTH_EVENTS_SECRET = EVENTS_SECRET;
    delete process.env.GROWTH_ANON_SECRET;
    expect((await GET(signed())).status).toBe(404);
    process.env.GROWTH_ANON_SECRET = "short";
    expect((await GET(signed())).status).toBe(404);
    expect(createPrismaSources).not.toHaveBeenCalled();
  });

  it("401: thiếu header, sai chữ ký, hết hạn, sai secret, query bị sửa", async () => {
    const { GET } = await import("./route");
    expect((await GET(new Request(`http://limio.test${PATH}`))).status).toBe(401);

    const tampered = signed("limit=2");
    const wrongQuery = new Request(`http://limio.test${PATH}?limit=3`, { headers: tampered.headers });
    expect((await GET(wrongQuery)).status).toBe(401);

    expect((await GET(signed("", { ts: Math.floor(Date.now() / 1000) - 301 }))).status).toBe(401);
    expect((await GET(signed("", { secret: "f".repeat(32) }))).status).toBe(401);
    expect(createPrismaSources).not.toHaveBeenCalled();
    const res = await GET(new Request(`http://limio.test${PATH}`));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("400: types lạ, limit ngoài 1..500, cursor hỏng — sau khi đã xác thực", async () => {
    const { GET } = await import("./route");
    expect((await GET(signed("types=user.deleted"))).status).toBe(400);
    expect((await GET(signed("limit=0"))).status).toBe(400);
    expect((await GET(signed("limit=501"))).status).toBe(400);
    expect((await GET(signed("cursor=nonsense"))).status).toBe(400);
    expect(createPrismaSources).not.toHaveBeenCalled();
  });

  it("200: hợp đồng, no-store, ẩn danh, không rò id/email", async () => {
    const { GET } = await import("./route");
    const res = await GET(signed("limit=10&types=user.registered"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(body.events).toHaveLength(2);
    expect(body.hasMore).toBe(false);
    expect(body.coverage).toEqual({ registered: 2, registeredWithSource: 1 });
    expect(body.nextCursor).toBe(`${body.events[1].occurredAt}|${body.events[1].eventId}`);
    expect(body.events[0].source.utmSource).toBe("facebook");
    expect(text).not.toContain("11111111");
    expect(text).not.toContain("22222222");
    expect(text).not.toMatch(/@/);
    expect(createPrismaSources.mock.calls[0]![0]).toEqual(["user.registered"]);
  });

  it("phân trang qua nextCursor", async () => {
    const { GET } = await import("./route");
    const p1 = await (await GET(signed("limit=1"))).json();
    expect(p1.events).toHaveLength(1);
    expect(p1.hasMore).toBe(true);
    const p2 = await (await GET(signed(`limit=1&cursor=${encodeURIComponent(p1.nextCursor)}`))).json();
    expect(p2.events).toHaveLength(1);
    expect(p2.events[0].eventId).not.toBe(p1.events[0].eventId);
    expect(p2.hasMore).toBe(false);
  });

  it("429 khi vượt rate limit, kèm Retry-After", async () => {
    const { GET } = await import("./route");
    allow.mockResolvedValueOnce({ ok: false, retryAfterSec: 7 } as never);
    const res = await GET(signed());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
  });

  it("lỗi nguồn dữ liệu ⇒ 500 không lộ chi tiết", async () => {
    const { GET } = await import("./route");
    createPrismaSources.mockImplementationOnce(() => {
      throw new Error('relation "User" SELECT secret-sql');
    });
    const res = await GET(signed());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SELECT");
  });
});
