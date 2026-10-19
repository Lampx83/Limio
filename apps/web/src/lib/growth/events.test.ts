import { describe, expect, it } from "vitest";
import {
  buildEventsPage,
  compareCandidates,
  DEFAULT_LIMIT,
  GROWTH_EVENT_TYPES,
  parseCursor,
  parseLimit,
  parseTypes,
  type GrowthEventSource,
  type GrowthEventType,
  type RawRow,
  type TouchSource,
} from "./events";
import { anonIdOf, orderRefOf } from "./anonymise";

const ANON = "anon-secret-0123456789abcdef0123456789";
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");

/** Nguồn in-memory có ngữ nghĩa y như SQL: sắp (occurredAt, key), lọc `> after`, `<= upTo`. */
function memorySource(type: GrowthEventType, rows: RawRow[]): GrowthEventSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    type,
    calls,
    async fetchAt(at, cap) {
      calls.push(`at:${at.toISOString()}`);
      return rows.filter((r) => r.occurredAt.getTime() === at.getTime()).slice(0, cap);
    },
    async fetchAfter(after, n, upTo) {
      calls.push(`after:${after?.toISOString() ?? "-"}:${n}`);
      return rows
        .filter(
          (r) =>
            r.occurredAt.getTime() <= upTo.getTime() &&
            (after === null || r.occurredAt.getTime() > after.getTime()),
        )
        .sort(
          (a, b) =>
            a.occurredAt.getTime() - b.occurredAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
        )
        .slice(0, n);
    },
  };
}

const userRow = (userId: string, iso: string): RawRow => ({ key: userId, userId, occurredAt: new Date(iso) });
const orderRow = (orderId: string, userId: string, iso: string, amount = 199000, currency = "VND"): RawRow => ({
  key: orderId,
  userId,
  orderId,
  occurredAt: new Date(iso),
  amountMinor: amount,
  currency,
});

const noTouches = async () => new Map<string, TouchSource>();

async function page(
  sources: GrowthEventSource[],
  opts: { cursor?: string | null; limit?: number; upTo?: Date; touches?: Map<string, TouchSource> } = {},
) {
  const c = parseCursor(opts.cursor ?? null);
  if (!c.ok) throw new Error("bad cursor in test");
  return buildEventsPage({
    sources,
    cursor: c.value,
    limit: opts.limit ?? DEFAULT_LIMIT,
    anonSecret: ANON,
    upTo: opts.upTo ?? FAR_FUTURE,
    loadTouches: async () => opts.touches ?? new Map(),
  });
}

async function drain(sources: GrowthEventSource[], limit: number) {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 1000; i++) {
    const p = await page(sources, { cursor, limit });
    ids.push(...p.events.map((e) => e.eventId));
    cursor = p.nextCursor;
    if (!p.hasMore) return ids;
  }
  throw new Error("không dừng");
}

describe("parseTypes / parseLimit / parseCursor", () => {
  it("types: mặc định là tất cả, nhận danh sách con, từ chối loại lạ", () => {
    expect(parseTypes(null)).toEqual({ ok: true, value: [...GROWTH_EVENT_TYPES] });
    expect(parseTypes("order.paid, user.registered,order.paid")).toEqual({
      ok: true,
      value: ["order.paid", "user.registered"],
    });
    for (const bad of ["user.deleted", "user.registered,foo", "*", "order.paid;drop", "USER.REGISTERED"]) {
      expect(parseTypes(bad), bad).toEqual({ ok: false, error: "unknown_type" });
    }
  });

  it("limit: 1..500, mặc định 200", () => {
    expect(parseLimit(null)).toEqual({ ok: true, value: 200 });
    expect(parseLimit("1")).toEqual({ ok: true, value: 1 });
    expect(parseLimit("500")).toEqual({ ok: true, value: 500 });
    for (const bad of ["0", "501", "-1", "abc", "1.5", "99999"]) {
      expect(parseLimit(bad), bad).toEqual({ ok: false, error: "invalid_limit" });
    }
  });

  it("cursor: ISO-ms|eventId, từ chối mọi thứ khác", () => {
    const id = `user.registered:${"a".repeat(32)}`;
    const ok = parseCursor(`2026-10-11T03:12:44.000Z|${id}`);
    expect(ok.ok && ok.value?.eventId).toBe(id);
    expect(parseCursor(null)).toEqual({ ok: true, value: null });
    for (const bad of [
      "garbage",
      `2026-10-11T03:12:44Z|${id}`,
      `2026-13-45T03:12:44.000Z|${id}`,
      `2026-10-11T03:12:44.000Z|user.deleted:${"a".repeat(32)}`,
      `2026-10-11T03:12:44.000Z|${id};DROP`,
      `2026-10-11T03:12:44.000Z`,
    ]) {
      expect(parseCursor(bad).ok, bad).toBe(false);
    }
  });
});

describe("buildEventsPage — hợp đồng", () => {
  const touches = new Map<string, TouchSource>([
    [
      "user-1",
      {
        utmSource: "facebook",
        utmMedium: "paid_social",
        utmCampaign: "oct",
        utmContent: null,
        utmTerm: null,
        clickIdKind: "fbclid",
        landingPath: "/catalog",
        referrerHost: null,
      },
    ],
  ]);

  it("trả đúng hình dạng, ẩn danh, và không rò userId/email/orderId", async () => {
    const userIds = ["user-1", "user-2", "user-3"];
    const sources = [
      memorySource("user.registered", [
        userRow("user-1", "2026-10-11T03:00:00.000Z"),
        userRow("user-2", "2026-10-11T03:00:01.000Z"),
      ]),
      memorySource("user.email_verified", [userRow("user-1", "2026-10-11T03:05:00.000Z")]),
      memorySource("order.paid", [orderRow("order-aaa-111", "user-1", "2026-10-11T04:00:00.000Z")]),
      memorySource("order.refunded", [orderRow("order-aaa-111", "user-1", "2026-10-11T05:00:00.000Z")]),
    ];
    const p = await page(sources, { touches });
    const json = JSON.stringify(p);

    expect(Object.keys(p).sort()).toEqual(["coverage", "events", "hasMore", "nextCursor"]);
    for (const e of p.events) {
      expect(Object.keys(e).sort()).toEqual(
        ["amountMinor", "anonId", "currency", "eventId", "occurredAt", "source", "type"].sort(),
      );
      expect(Object.keys(e.source).sort()).toEqual(
        ["clickIdKind", "landingPath", "referrerHost", "utmCampaign", "utmContent", "utmMedium", "utmSource", "utmTerm"].sort(),
      );
      expect(e.anonId).toMatch(/^[0-9a-f]{32}$/);
      expect(e.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
    for (const id of [...userIds, "order-aaa-111", "@", "user-1"]) {
      expect(json, id).not.toContain(id);
    }

    const reg = p.events.find((e) => e.type === "user.registered" && e.anonId === anonIdOf(ANON, "user-1"))!;
    expect(reg.eventId).toBe(`user.registered:${anonIdOf(ANON, "user-1")}`);
    expect(reg.source.utmSource).toBe("facebook");
    expect(reg.amountMinor).toBeNull();
    expect(reg.currency).toBeNull();

    const paid = p.events.find((e) => e.type === "order.paid")!;
    expect(paid.eventId).toBe(`order.paid:${orderRefOf(ANON, "order-aaa-111")}`);
    expect(paid.eventId).toMatch(/^order\.paid:[0-9a-f]{16}$/);
    expect(paid.amountMinor).toBe(199000);
    expect(paid.currency).toBe("VND");
    // order.* mang nguồn của user mua
    expect(paid.source.utmSource).toBe("facebook");
    expect(p.events.find((e) => e.type === "order.refunded")!.eventId).toBe(
      `order.refunded:${orderRefOf(ANON, "order-aaa-111")}`,
    );
    // user-2 không có touch ⇒ toàn null
    const reg2 = p.events.find((e) => e.anonId === anonIdOf(ANON, "user-2"))!;
    expect(Object.values(reg2.source).every((v) => v === null)).toBe(true);
  });

  it("coverage chỉ đếm trong trang trả về", async () => {
    const regs = [
      userRow("user-1", "2026-10-11T03:00:00.000Z"),
      userRow("user-2", "2026-10-11T03:00:01.000Z"),
      userRow("user-3", "2026-10-11T03:00:02.000Z"),
    ];
    const t = new Map(touches);
    const all = await page([memorySource("user.registered", regs)], { touches: t });
    expect(all.coverage).toEqual({ registered: 3, registeredWithSource: 1 });

    const first = await page([memorySource("user.registered", regs)], { touches: t, limit: 1 });
    expect(first.coverage).toEqual({ registered: 1, registeredWithSource: 1 });
    // sự kiện không phải registered không tính
    const other = await page([memorySource("user.email_verified", [userRow("user-1", "2026-10-11T03:00:00.000Z")])], { touches: t });
    expect(other.coverage).toEqual({ registered: 0, registeredWithSource: 0 });
  });

  it("không có sự kiện: nextCursor = chính cursor đã gửi (hoặc null)", async () => {
    const empty = [memorySource("user.registered", [])];
    expect(await page(empty)).toMatchObject({ events: [], nextCursor: null, hasMore: false });
    const id = `user.registered:${"b".repeat(32)}`;
    const cursor = `2026-10-11T03:12:44.000Z|${id}`;
    expect(await page(empty, { cursor })).toMatchObject({ events: [], nextCursor: cursor, hasMore: false });
  });

  it("hasMore: false khi đúng bằng limit, true khi nhiều hơn", async () => {
    const rows = [1, 2, 3].map((i) => userRow(`u${i}`, `2026-10-11T03:00:0${i}.000Z`));
    const src = () => [memorySource("user.registered", rows)];
    expect(await page(src(), { limit: 3 })).toMatchObject({ hasMore: false });
    expect((await page(src(), { limit: 3 })).events).toHaveLength(3);
    const p2 = await page(src(), { limit: 2 });
    expect(p2.hasMore).toBe(true);
    expect(p2.events).toHaveLength(2);
  });

  it("không phát sự kiện muộn hơn upTo (độ trễ lắng)", async () => {
    const rows = [userRow("u1", "2026-10-11T03:00:00.000Z"), userRow("u2", "2026-10-11T03:00:10.000Z")];
    const p = await page([memorySource("user.registered", rows)], {
      upTo: new Date("2026-10-11T03:00:05.000Z"),
    });
    expect(p.events.map((e) => e.anonId)).toEqual([anonIdOf(ANON, "u1")]);
    expect(p.hasMore).toBe(false);
  });
});

describe("buildEventsPage — thứ tự và phân trang", () => {
  // Nhiều dòng trùng đúng một mili-giây, trên nhiều nguồn.
  const T = "2026-10-11T03:00:00.000Z";
  const rowsReg = [
    ...["a", "b", "c", "d", "e", "f", "g"].map((s) => userRow(`reg-${s}`, T)),
    userRow("reg-late", "2026-10-11T03:00:01.000Z"),
    userRow("reg-early", "2026-10-11T02:59:59.000Z"),
  ];
  const rowsVer = [userRow("reg-a", T), userRow("reg-c", T), userRow("reg-b", "2026-10-11T03:00:02.000Z")];
  const rowsEnr = [userRow("reg-d", T), userRow("reg-e", "2026-10-11T03:00:01.000Z")];
  const rowsOrd = [orderRow("ord-1", "reg-a", T), orderRow("ord-2", "reg-b", T), orderRow("ord-3", "reg-c", "2026-10-11T03:00:03.000Z")];
  const mk = () => [
    memorySource("user.registered", rowsReg),
    memorySource("user.email_verified", rowsVer),
    memorySource("enrollment.created", rowsEnr),
    memorySource("order.paid", rowsOrd),
  ];
  const TOTAL = rowsReg.length + rowsVer.length + rowsEnr.length + rowsOrd.length;

  it("sắp theo (occurredAt ASC, eventId ASC) trong một trang", async () => {
    const p = await page(mk());
    expect(p.events).toHaveLength(TOTAL);
    const keyed = p.events.map((e) => ({ at: Date.parse(e.occurredAt), eventId: e.eventId }));
    const sorted = [...keyed].sort(compareCandidates);
    expect(keyed).toEqual(sorted);
    // tie-break thật sự dùng eventId (không phải thứ tự nguồn / key)
    const tie = p.events.filter((e) => e.occurredAt === T).map((e) => e.eventId);
    expect(tie.length).toBeGreaterThan(5);
    expect(tie).toEqual([...tie].sort());
  });

  it("duyệt qua danh sách theo trang 2: không trùng, không sót, cùng thứ tự với một trang lớn", async () => {
    const full = (await page(mk(), { limit: 500 })).events.map((e) => e.eventId);
    expect(new Set(full).size).toBe(TOTAL);
    for (const size of [1, 2, 3, 5]) {
      const paged = await drain(mk(), size);
      expect(paged, `size ${size}`).toEqual(full);
    }
  });

  it("cursor giữa một đám trùng: strictly after cặp (occurredAt, eventId)", async () => {
    const full = (await page(mk(), { limit: 500 })).events;
    const tieIdx = full.findIndex((e) => e.occurredAt === T) + 2;
    const cur = full[tieIdx]!;
    const after = await page(mk(), { cursor: `${cur.occurredAt}|${cur.eventId}`, limit: 500 });
    expect(after.events.map((e) => e.eventId)).toEqual(full.slice(tieIdx + 1).map((e) => e.eventId));
  });

  it("tie-extension: đám trùng lớn hơn limit vẫn không làm lỡ dòng", async () => {
    // 12 dòng cùng mili-giây, limit 3 ⇒ LIMIT n+1 = 4 cắt giữa đám trùng.
    const rows = Array.from({ length: 12 }, (_, i) => userRow(`tie-${i}`, T));
    const src = () => [memorySource("user.registered", rows)];
    const full = (await page(src(), { limit: 500 })).events.map((e) => e.eventId);
    expect(await drain(src(), 3)).toEqual(full);
    expect(full).toEqual([...full].sort());
  });

  it("thuộc tính: nhiều cấu hình ngẫu nhiên (PRNG cố định) đều duyệt đủ, không trùng", async () => {
    let seed = 20261011;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 25; round++) {
      const slots = 1 + Math.floor(rnd() * 4);
      const at = () => `2026-10-11T03:00:0${Math.floor(rnd() * slots)}.000Z`;
      const n = 1 + Math.floor(rnd() * 25);
      const users = Array.from({ length: n }, (_, i) => `p${round}-u${i}`);
      const src = () => [
        memorySource("user.registered", users.map((u) => userRow(u, at()))),
        memorySource("user.email_verified", users.filter(() => rnd() < 0.5).map((u) => userRow(u, at()))),
        memorySource("order.paid", users.filter(() => rnd() < 0.3).map((u, i) => orderRow(`o${round}-${i}`, u, at()))),
      ];
      // Cố định dữ liệu giữa các lần duyệt: dựng một lần.
      const built = src();
      const full = (await page(built, { limit: 500 })).events.map((e) => e.eventId);
      expect(new Set(full).size).toBe(full.length);
      const size = 1 + Math.floor(rnd() * 6);
      expect(await drain(built, size), `round ${round} size ${size}`).toEqual(full);
    }
  });
});
