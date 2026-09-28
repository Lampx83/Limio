import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { updateOrganizationLogo } from "../branding";
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
