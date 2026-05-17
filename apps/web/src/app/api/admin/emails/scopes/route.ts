import { NextResponse } from "next/server";
import { isAdmin, getUserOrgId } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET /api/admin/emails/scopes
 * Lists scopes the current admin can edit. Platform admin gets "global"
 * + every org. OrgAdmin only gets their own org(s).
 *
 * Used by the email-template list UI to populate the scope dropdown.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const platformAdmin = await isAdmin(userId);

  if (platformAdmin) {
    const orgs = await prisma.organization.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      isPlatformAdmin: true,
      scopes: [
        { id: "global", label: "Toàn hệ thống (mặc định)" },
        ...orgs.map((o) => ({ id: o.id, label: `${o.name} (${o.code})` })),
      ],
    });
  }

  // OrgAdmin: list orgs where they have admin grant.
  const grants = await prisma.organizationAdmin.findMany({
    where: { userId },
    include: { organization: { select: { id: true, code: true, name: true } } },
  });
  if (grants.length === 0) {
    // Allow read-only access for users who at least belong to an org? For now,
    // refuse — editor UI needs admin grant.
    const ownOrgId = await getUserOrgId(userId);
    if (!ownOrgId)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    isPlatformAdmin: false,
    scopes: grants.map((g) => ({
      id: g.organization.id,
      label: `${g.organization.name} (${g.organization.code})`,
    })),
  });
}
