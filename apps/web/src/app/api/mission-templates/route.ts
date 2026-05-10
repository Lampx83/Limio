/**
 * GET /api/mission-templates
 *
 * Returns all active MissionTemplate rows. Used by the instructor tournament
 * builder to populate the template picker UI.
 *
 * Query params:
 *   none (always returns full active catalog — small, stable dataset)
 *
 * Auth: any authenticated user may read templates (instructors need them when
 * building missions; admins when auditing). No sensitive data here.
 *
 * Admin-only write endpoints (create/update/delete templates) are under
 * /api/admin/mission-templates (Phase C — not implemented yet).
 */
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const templates = await prisma.missionTemplate.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      emoji: true,
      conditionType: true,
      defaultValue: true,
      defaultMinScore: true,
      hasMinScore: true,
      requiresSkillGroup: true,
    },
  });

  return NextResponse.json({ templates });
}
