import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { exportProfile } from "../profile";
import { deleteUser } from "../deleteUser";
import { assignSubscription } from "../../plans/admin";
import { makeOrg, makeUser, seedFlagsAndPlans } from "../../plans/__tests__/planFixtures";

const DAY = 24 * 3600_000;

beforeEach(async () => {
  await seedFlagsAndPlans();
});

/** Gói tài khoản (mốc 1) — thuê bao cá nhân nằm trong xuất dữ liệu và bị xoá cùng tài khoản. */
describe("dữ liệu cá nhân — thuê bao gói", () => {
  async function setup() {
    const admin = await makeUser("ad");
    const learner = await makeUser("hv");
    const other = await makeUser("khac");
    const org = await makeOrg("to-chuc");
    const startsAt = new Date(Date.now() - DAY);
    const endsAt = new Date(Date.now() + 30 * DAY);
    await assignSubscription(admin, { planKey: "pro", userId: learner, startsAt, endsAt, source: "admin", note: "ghi chú nội bộ" });
    await assignSubscription(admin, { planKey: "pro", userId: other, startsAt, endsAt, source: "admin" });
    await assignSubscription(admin, { planKey: "org_truong", organizationId: org.id, startsAt, endsAt, source: "contract" });
    return { admin, learner, other, org, startsAt, endsAt };
  }

  it("exportProfile có subscriptions của chính người đó, không có tổ chức, không lộ ghi chú", async () => {
    const { learner, startsAt, endsAt } = await setup();
    const out = await exportProfile(learner);
    expect(out.subscriptions).toHaveLength(1);
    const s = out.subscriptions[0]!;
    expect(s.planKey).toBe("pro");
    expect(s.source).toBe("admin");
    expect(s.startsAt).toEqual(startsAt);
    expect(s.endsAt).toEqual(endsAt);
    expect(s.cancelledAt).toBeNull();
    const json = JSON.stringify(out.subscriptions);
    expect(json).not.toContain("ghi chú nội bộ");
    expect(json).not.toContain("grantedById");
    expect(json).not.toContain("org_truong");
  });

  it("deleteUser xoá thuê bao cá nhân, giữ thuê bao của tổ chức và của người khác", async () => {
    const { admin, learner, other, org } = await setup();
    await deleteUser(admin, learner);
    expect(await prisma.subscription.count({ where: { userId: learner } })).toBe(0);
    expect(await prisma.subscription.count({ where: { userId: other } })).toBe(1);
    expect(await prisma.subscription.count({ where: { organizationId: org.id } })).toBe(1);
  });
});
