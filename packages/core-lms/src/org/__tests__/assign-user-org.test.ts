import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { assignUserOrganization } from "../members";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const mk = (tag: string) =>
    registerUser(
      { email: `${tag}-${slug}@e.com`, password: "password1234", displayName: tag },
      BASE,
    );
  const platformAdmin = await mk("padmin");
  await grantRole(platformAdmin.userId, { targetUserId: platformAdmin.userId, roleName: "admin" });
  const target = await mk("target");
  const orgAdmin = await mk("orgadmin");
  const orgA = await prisma.organization.create({
    data: { code: `A-${slug}-${Date.now()}`, name: "Org A" },
  });
  const orgB = await prisma.organization.create({
    data: { code: `B-${slug}-${Date.now()}`, name: "Org B" },
  });
  await prisma.organizationAdmin.create({
    data: { organizationId: orgA.id, userId: orgAdmin.userId },
  });
  return {
    adminId: platformAdmin.userId,
    targetId: target.userId,
    orgAdminId: orgAdmin.userId,
    orgA: orgA.id,
    orgB: orgB.id,
  };
}

const orgOf = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { organizationId: true } }))
    .organizationId;

describe("assignUserOrganization", () => {
  it("gắn user từ Nhóm chung vào một org", async () => {
    const s = await setup("as1");
    const r = await assignUserOrganization(s.adminId, s.targetId, s.orgA);
    expect(r).toEqual({ from: null, to: s.orgA });
    expect(await orgOf(s.targetId)).toBe(s.orgA);
  });

  it("chuyển user đang ở org A sang org B, ghi audit từ/đến", async () => {
    const s = await setup("as2");
    await assignUserOrganization(s.adminId, s.targetId, s.orgA);
    await assignUserOrganization(s.adminId, s.targetId, s.orgB);
    expect(await orgOf(s.targetId)).toBe(s.orgB);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "user.organization_changed", targetUserId: s.targetId },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.payload).toMatchObject({ from: s.orgA, to: s.orgB });
  });

  it("gỡ về Nhóm chung khi organizationId = null", async () => {
    const s = await setup("as3");
    await assignUserOrganization(s.adminId, s.targetId, s.orgA);
    await assignUserOrganization(s.adminId, s.targetId, null);
    expect(await orgOf(s.targetId)).toBeNull();
  });

  it("no-op (không audit) khi đã ở đúng org", async () => {
    const s = await setup("as4");
    await assignUserOrganization(s.adminId, s.targetId, s.orgA);
    const before = await prisma.auditLog.count({ where: { targetUserId: s.targetId } });
    await assignUserOrganization(s.adminId, s.targetId, s.orgA);
    expect(await prisma.auditLog.count({ where: { targetUserId: s.targetId } })).toBe(before);
  });

  it("chỉ Platform Admin: OrgAdmin cũng bị từ chối", async () => {
    const s = await setup("as5");
    await expect(
      assignUserOrganization(s.orgAdminId, s.targetId, s.orgA),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(await orgOf(s.targetId)).toBeNull();
  });

  it("org không tồn tại / user không tồn tại", async () => {
    const s = await setup("as6");
    await expect(
      assignUserOrganization(s.adminId, s.targetId, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ code: "org_not_found" });
    await expect(
      assignUserOrganization(s.adminId, "00000000-0000-0000-0000-000000000000", s.orgA),
    ).rejects.toMatchObject({ code: "user_not_found" });
  });
});
