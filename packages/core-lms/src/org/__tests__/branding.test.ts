import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  updateOrganizationLogo,
  updateOrganizationName,
  updateOrganizationSignature,
} from "../branding";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const orgAdmin = await registerUser(
    { email: `admin-${slug}@e.com`, password: "password1234", displayName: "Admin" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `outsider-${slug}@e.com`, password: "password1234", displayName: "Outsider" },
    BASE,
  );
  const org = await prisma.organization.create({
    data: { code: `ORG-${slug}-${Date.now()}`, name: "HUST" },
  });
  await prisma.organizationAdmin.create({
    data: { organizationId: org.id, userId: orgAdmin.userId },
  });
  return { orgAdminId: orgAdmin.userId, outsiderId: outsider.userId, orgId: org.id };
}

describe("updateOrganizationLogo — org branding", () => {
  it("OrgAdmin of the org can set and clear the logo", async () => {
    const { orgAdminId, orgId } = await setup("brand1");

    const set = await updateOrganizationLogo(orgAdminId, orgId, "/api/org-logos/x-1.png");
    expect(set.brandingLogoUrl).toBe("/api/org-logos/x-1.png");

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.brandingLogoUrl).toBe("/api/org-logos/x-1.png");

    const cleared = await updateOrganizationLogo(orgAdminId, orgId, null);
    expect(cleared.brandingLogoUrl).toBeNull();
  });

  it("rejects a user who is not OrgAdmin of that org", async () => {
    const { outsiderId, orgId } = await setup("brand2");
    await expect(
      updateOrganizationLogo(outsiderId, orgId, "/api/org-logos/x-1.png"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("updateOrganizationName — org branding", () => {
  it("OrgAdmin of the org can rename it (trimmed)", async () => {
    const { orgAdminId, orgId } = await setup("brand3");

    const updated = await updateOrganizationName(orgAdminId, orgId, "  Trường Demo  ");
    expect(updated.name).toBe("Trường Demo");

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.name).toBe("Trường Demo");
  });

  it("rejects a user who is not OrgAdmin of that org", async () => {
    const { outsiderId, orgId } = await setup("brand4");
    await expect(updateOrganizationName(outsiderId, orgId, "X")).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("rejects an empty name", async () => {
    const { orgAdminId, orgId } = await setup("brand5");
    await expect(updateOrganizationName(orgAdminId, orgId, "   ")).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("updateOrganizationSignature — org branding", () => {
  it("OrgAdmin of the org can set and clear the signature", async () => {
    const { orgAdminId, orgId } = await setup("brand6");

    const set = await updateOrganizationSignature(orgAdminId, orgId, "/api/org-signatures/x-1.png");
    expect(set.signatureImageUrl).toBe("/api/org-signatures/x-1.png");

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.signatureImageUrl).toBe("/api/org-signatures/x-1.png");

    const cleared = await updateOrganizationSignature(orgAdminId, orgId, null);
    expect(cleared.signatureImageUrl).toBeNull();
  });

  it("rejects a user who is not OrgAdmin of that org", async () => {
    const { outsiderId, orgId } = await setup("brand7");
    await expect(
      updateOrganizationSignature(outsiderId, orgId, "/api/org-signatures/x-1.png"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
