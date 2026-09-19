import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { canEditActivityPlan } from "@feedbackme/core-lms";
import { sseResponse } from "@/lib/realtime/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE cho đồng biên soạn (co-share) — payload chỉ là tín hiệu "có gì đó vừa
// đổi", client nhận rồi refetch nguyên list (không merge từng field, xem
// activity-plans.ts). Chỉ owner/collaborator được subscribe.
export async function GET(
  req: Request,
  { params }: { params: { planId: string } },
) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return new Response("forbidden", { status: 403 });
  }
  const canView = await canEditActivityPlan(params.planId, userId, prisma);
  if (!canView) {
    return new Response("forbidden", { status: 403 });
  }

  return sseResponse(`activity-plan:${params.planId}`, req);
}
