import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ requireUserId }));
const isAdmin = vi.hoisted(() => vi.fn());
const assignSubscription = vi.hoisted(() => vi.fn());
const listSubscriptions = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, isAdmin, assignSubscription, listSubscriptions };
});

import { PlanError } from "@feedbackme/core-lms";
import { GET, POST } from "./route";

const body = {
  planKey: "org_khoa",
  organizationId: "o1",
  startsAt: "2026-11-25T17:00:00.000Z",
  endsAt: "2027-02-28T17:00:00.000Z",
  source: "contract",
  note: "HĐ 01",
};
const post = (b: unknown = body) =>
  POST(new Request("http://localhost/api/admin/subscriptions", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => {
  requireUserId.mockReset().mockResolvedValue("admin1");
  isAdmin.mockReset().mockResolvedValue(true);
  assignSubscription.mockReset().mockResolvedValue({ subscriptionId: "s1" });
  listSubscriptions.mockReset().mockResolvedValue([]);
});

describe("POST /api/admin/subscriptions", () => {
  it("chưa đăng nhập → 401", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("không phải admin nền tảng → 403", async () => {
    isAdmin.mockResolvedValue(false);
    expect((await post()).status).toBe(403);
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("admin gán hợp lệ → 201 { subscriptionId }, truyền ngày dạng Date", async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ subscriptionId: "s1" });
    expect(assignSubscription).toHaveBeenCalledWith(
      "admin1",
      expect.objectContaining({
        planKey: "org_khoa",
        organizationId: "o1",
        source: "contract",
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      }),
    );
  });

  it("gói cá nhân gán cho tổ chức → 400 invalid_subject", async () => {
    assignSubscription.mockRejectedValue(new PlanError("invalid_subject"));
    const res = await post({ ...body, planKey: "pro" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_subject" });
  });

  it("gói không có → 404", async () => {
    assignSubscription.mockRejectedValue(new PlanError("plan_not_found"));
    expect((await post()).status).toBe(404);
  });

  it("ngày sai hoặc nguồn sai → 400 invalid_dates / invalid_body, không gọi lõi", async () => {
    const r1 = await post({ ...body, startsAt: "không phải ngày" });
    expect(r1.status).toBe(400);
    expect(await r1.json()).toEqual({ error: "invalid_dates" });
    const r2 = await post({ ...body, source: "stripe" });
    expect(r2.status).toBe(400);
    expect(assignSubscription).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/subscriptions", () => {
  const get = (q: string) => GET(new Request(`http://localhost/api/admin/subscriptions${q}`));
  it("không phải admin → 403", async () => {
    isAdmin.mockResolvedValue(false);
    expect((await get("?userId=u1")).status).toBe(403);
  });
  it("thiếu userId lẫn organizationId → 400", async () => {
    expect((await get("")).status).toBe(400);
  });
  it("lọc theo tổ chức", async () => {
    const res = await get("?organizationId=o1");
    expect(res.status).toBe(200);
    expect(listSubscriptions).toHaveBeenCalledWith({ organizationId: "o1" });
  });
});
