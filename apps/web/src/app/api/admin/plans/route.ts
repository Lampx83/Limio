import { NextResponse } from "next/server";
import { listPlansForAdmin, plansEnabled } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { guardPlatformAdmin } from "@/lib/adminPlansApi";

export async function GET() {
  const g = await guardPlatformAdmin();
  if ("res" in g) return g.res;
  const now = new Date();
  const [plans, counts] = await Promise.all([
    listPlansForAdmin(),
    prisma.subscription.groupBy({
      by: ["planId"],
      where: { cancelledAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
      _count: { _all: true },
    }),
  ]);
  const byPlan = new Map(counts.map((c) => [c.planId, c._count._all]));
  return NextResponse.json({
    plansEnabled: plansEnabled(),
    plans: plans.map((p) => ({ ...p, activeSubscriptions: byPlan.get(p.id) ?? 0 })),
  });
}
