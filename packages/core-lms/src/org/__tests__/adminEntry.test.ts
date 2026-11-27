import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { canEnterOrg, enterOrgAdminWorkspace, listEnterableOrgs } from "../adminEntry";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}
async function makeOrg(tag: string, kind: "school" | "center" | "publisher" = "school") {
  return prisma.organization.create({ data: { code: `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: `Tổ chức ${tag}`, kind, centerEnabled: kind === "center" } });
}
const entries = (actor: string, orgId: string) => prisma.auditLog.count({ where: { action: "org.admin_entered", actorUserId: actor, payload: { path: ["organizationId"], equals: orgId } } });

describe("vào khu quản trị theo tổ chức", () => {
  it("OrgAdmin chỉ chọn được tổ chức mình được gán, và vào tổ chức mình không ghi nhật ký", async () => {
    const [a, b] = [await makeOrg("ae-a", "center"), await makeOrg("ae-b", "publisher")];
    const u = await makeUser("ae-oa@e.com");
    await prisma.organizationAdmin.create({ data: { organizationId: a.id, userId: u } });
    expect((await listEnterableOrgs(u)).map((o) => o.id)).toEqual([a.id]);
    expect(await canEnterOrg(u, a.id)).toBe(true);
    expect(await canEnterOrg(u, b.id)).toBe(false);
    await expect(enterOrgAdminWorkspace(u, b.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(enterOrgAdminWorkspace(u, a.id)).resolves.toMatchObject({ id: a.id, kind: "center", assigned: true });
    expect(await entries(u, a.id)).toBe(0);
    expect(await entries(u, b.id)).toBe(0);
  });

  it("Platform Admin thấy mọi tổ chức; MỖI LẦN vào tổ chức không được gán đều ghi nhật ký, kể cả vào lại cùng tổ chức", async () => {
    const org = await makeOrg("ae-pa", "publisher");
    const pa = await makeUser("ae-pa@e.com");
    await grantRole(pa, { targetUserId: pa, roleName: "admin" });
    expect((await listEnterableOrgs(pa)).some((o) => o.id === org.id && !o.assigned)).toBe(true);
    await expect(enterOrgAdminWorkspace(pa, org.id)).resolves.toMatchObject({ id: org.id, kind: "publisher", assigned: false });
    expect(await entries(pa, org.id)).toBe(1);
    await enterOrgAdminWorkspace(pa, org.id);
    expect(await entries(pa, org.id)).toBe(2);
    const log = await prisma.auditLog.findFirst({ where: { action: "org.admin_entered", actorUserId: pa }, orderBy: { occurredAt: "desc" } });
    expect(log!.payload).toMatchObject({ organizationId: org.id, kind: "publisher" });
  });

  it("Platform Admin vào tổ chức mình cũng được gán thì không ghi nhật ký", async () => {
    const org = await makeOrg("ae-both");
    const pa = await makeUser("ae-both@e.com");
    await grantRole(pa, { targetUserId: pa, roleName: "admin" });
    await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: pa } });
    await expect(enterOrgAdminWorkspace(pa, org.id)).resolves.toMatchObject({ assigned: true });
    expect(await entries(pa, org.id)).toBe(0);
  });

  it("người ngoài bị từ chối và không dò được tổ chức nào có thật; tổ chức không có → org_not_found cho Platform Admin", async () => {
    const stranger = await makeUser("ae-x@e.com");
    const pa = await makeUser("ae-nf@e.com");
    await grantRole(pa, { targetUserId: pa, roleName: "admin" });
    await expect(enterOrgAdminWorkspace(stranger, "no-such-org")).rejects.toMatchObject({ code: "forbidden" });
    await expect(enterOrgAdminWorkspace(pa, "no-such-org")).rejects.toMatchObject({ code: "org_not_found" });
    expect(await canEnterOrg(pa, "no-such-org")).toBe(false);
    expect(await canEnterOrg(stranger, "no-such-org")).toBe(false);
  });
});
