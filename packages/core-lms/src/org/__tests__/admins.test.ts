import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { grantOrgAdmin, revokeOrgAdmin, listOrgAdmins } from "../admins";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const platformAdmin = await registerUser(
    { email: `padmin-${slug}@e.com`, password: "password1234", displayName: "Platform Admin" },
    BASE,
  );
  await grantRole(platformAdmin.userId, { targetUserId: platformAdmin.userId, roleName: "admin" });

  const target = await registerUser(
    { email: `target-${slug}@e.com`, password: "password1234", displayName: "Target" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `outsider-${slug}@e.com`, password: "password1234", displayName: "Outsider" },
    BASE,
  );
  const org = await prisma.organization.create({
    data: { code: `ORG-${slug}-${Date.now()}`, name: "HUST" },
  });
  return {
    platformAdminId: platformAdmin.userId,
    targetId: target.userId,
    targetEmail: target.email,
    outsiderId: outsider.userId,
    orgId: org.id,
  };
}

describe("grantOrgAdmin", () => {
  it("platform admin grants OrgAdmin to a user found by email", async () => {
    const { platformAdminId, targetId, targetEmail, orgId } = await setup("grant1");

    const result = await grantOrgAdmin(platformAdminId, orgId, targetEmail);
    expect(result).toMatchObject({ userId: targetId, created: true });

    const row = await prisma.organizationAdmin.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
    });
    expect(row).not.toBeNull();
    expect(row?.grantedByUserId).toBe(platformAdminId);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "org_admin.granted", targetUserId: targetId },
    });
    expect(audit).not.toBeNull();

    const event = await prisma.learningEvent.findFirst({
      where: { eventType: "org.admin.granted", userId: platformAdminId },
    });
    expect(event).not.toBeNull();
  });

  it("rejects a non-platform-admin actor", async () => {
    const { outsiderId, targetEmail, orgId } = await setup("grant2");
    await expect(grantOrgAdmin(outsiderId, orgId, targetEmail)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("rejects an unknown org", async () => {
    const { platformAdminId, targetEmail } = await setup("grant3");
    await expect(
      grantOrgAdmin(platformAdminId, "00000000-0000-0000-0000-000000000000", targetEmail),
    ).rejects.toMatchObject({ code: "org_not_found" });
  });

  it("rejects an email with no matching user", async () => {
    const { platformAdminId, orgId } = await setup("grant4");
    await expect(
      grantOrgAdmin(platformAdminId, orgId, "nobody@nowhere.com"),
    ).rejects.toMatchObject({ code: "user_not_found" });
  });

  it("rejects granting to a user who is already OrgAdmin of that org", async () => {
    const { platformAdminId, targetEmail, orgId } = await setup("grant5");
    await grantOrgAdmin(platformAdminId, orgId, targetEmail);
    await expect(grantOrgAdmin(platformAdminId, orgId, targetEmail)).rejects.toMatchObject({
      code: "already_admin",
    });
  });
});

describe("revokeOrgAdmin", () => {
  it("platform admin revokes an existing OrgAdmin", async () => {
    const { platformAdminId, targetId, targetEmail, orgId } = await setup("revoke1");
    await grantOrgAdmin(platformAdminId, orgId, targetEmail);

    await revokeOrgAdmin(platformAdminId, orgId, targetId);

    const row = await prisma.organizationAdmin.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
    });
    expect(row).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "org_admin.revoked", targetUserId: targetId },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a non-platform-admin actor", async () => {
    const { platformAdminId, outsiderId, targetId, targetEmail, orgId } = await setup("revoke2");
    await grantOrgAdmin(platformAdminId, orgId, targetEmail);
    await expect(revokeOrgAdmin(outsiderId, orgId, targetId)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("rejects revoking a user who isn't OrgAdmin of that org", async () => {
    const { platformAdminId, targetId, orgId } = await setup("revoke3");
    await expect(revokeOrgAdmin(platformAdminId, orgId, targetId)).rejects.toMatchObject({
      code: "not_admin",
    });
  });
});

describe("listOrgAdmins", () => {
  it("lists current admins with who granted them", async () => {
    const { platformAdminId, targetId, targetEmail, orgId } = await setup("list1");
    await grantOrgAdmin(platformAdminId, orgId, targetEmail);

    const rows = await listOrgAdmins(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: targetId,
      email: targetEmail,
      grantedByUserId: platformAdminId,
    });
  });

  it("returns empty for an org with no admins", async () => {
    const { orgId } = await setup("list2");
    const rows = await listOrgAdmins(orgId);
    expect(rows).toEqual([]);
  });
});
