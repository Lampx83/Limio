import { describe, expect, it, vi } from "vitest";

// Không nạp Prisma client thật trong test thuần.
vi.mock("@feedbackme/db", () => ({ prisma: {} }));

import { encodeAttributionCookie, type AttributionTouch } from "./attribution";
import { readCookie, recordAcquisitionTouch, type TouchDb } from "./touchStore";

const NOW = 1_760_000_000;
const touch: AttributionTouch = {
  utmSource: "facebook",
  utmMedium: "paid_social",
  utmCampaign: "oct",
  utmContent: null,
  utmTerm: null,
  clickIdKind: "fbclid",
  landingPath: "/catalog",
  referrerHost: null,
  firstSeenAtSec: NOW - 3600,
};
const cookie = encodeAttributionCookie(touch);
const ON = { GROWTH_ATTRIBUTION_ENABLED: "true" };

function fakeDb(opts: { createdAt?: Date; failUpsert?: boolean } = {}) {
  const upsert = vi.fn(async (_args?: unknown) => {
    if (opts.failUpsert) throw new Error("db down");
    return {};
  });
  const findUnique = vi.fn(async () => (opts.createdAt ? { createdAt: opts.createdAt } : null));
  const db: TouchDb = { acquisitionTouch: { upsert }, user: { findUnique } };
  return { db, upsert, findUnique };
}

describe("readCookie", () => {
  it("đọc đúng cookie trong header", () => {
    expect(readCookie("a=1; limio_attr=abc_DEF-1; b=2", "limio_attr")).toBe("abc_DEF-1");
    expect(readCookie("a=1", "limio_attr")).toBeUndefined();
    expect(readCookie(null, "limio_attr")).toBeUndefined();
  });
});

describe("recordAcquisitionTouch", () => {
  it("cờ tắt ⇒ không đụng DB", async () => {
    const { db, upsert } = fakeDb();
    expect(await recordAcquisitionTouch("u1", cookie, { db, env: {}, nowSec: NOW })).toBe("disabled");
    expect(await recordAcquisitionTouch("u1", cookie, { db, env: { GROWTH_ATTRIBUTION_ENABLED: "false" }, nowSec: NOW })).toBe("disabled");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("không có cookie / cookie hỏng ⇒ không ghi", async () => {
    const { db, upsert } = fakeDb();
    expect(await recordAcquisitionTouch("u1", undefined, { db, env: ON, nowSec: NOW })).toBe("no_cookie");
    expect(await recordAcquisitionTouch("u1", "garbage", { db, env: ON, nowSec: NOW })).toBe("invalid_cookie");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("cookie hợp lệ ⇒ upsert đúng các trường, update rỗng (first touch wins)", async () => {
    const { db, upsert } = fakeDb();
    expect(await recordAcquisitionTouch("u1", cookie, { db, env: ON, nowSec: NOW })).toBe("stored");
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]![0] as {
      where: unknown;
      create: Record<string, unknown>;
      update: unknown;
    };
    expect(arg.where).toEqual({ userId: "u1" });
    expect(arg.update).toEqual({});
    expect(arg.create).toMatchObject({
      userId: "u1",
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "oct",
      clickIdKind: "fbclid",
      landingPath: "/catalog",
      referrerHost: null,
    });
    expect((arg.create.firstSeenAt as Date).toISOString()).toBe(new Date((NOW - 3600) * 1000).toISOString());
  });

  it("DB lỗi ⇒ nuốt lỗi, không throw", async () => {
    const { db } = fakeDb({ failUpsert: true });
    await expect(recordAcquisitionTouch("u1", cookie, { db, env: ON, nowSec: NOW })).resolves.toBe("error");
  });

  it("SSO: chỉ lưu khi tài khoản vừa tạo", async () => {
    const fresh = fakeDb({ createdAt: new Date((NOW - 30) * 1000) });
    expect(await recordAcquisitionTouch("u1", cookie, { db: fresh.db, env: ON, nowSec: NOW, onlyIfFreshUser: true })).toBe("stored");
    const old = fakeDb({ createdAt: new Date((NOW - 86400) * 1000) });
    expect(await recordAcquisitionTouch("u1", cookie, { db: old.db, env: ON, nowSec: NOW, onlyIfFreshUser: true })).toBe("not_new_user");
    expect(old.upsert).not.toHaveBeenCalled();
  });
});
