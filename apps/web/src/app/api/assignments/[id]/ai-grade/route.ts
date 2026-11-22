import { NextResponse } from "next/server";
import {
  fitTargetsToBudget,
  getAiGradeBatch,
  planAiGradeBatch,
  startAiGradeBatch,
} from "@feedbackme/core-lms";
import { getTokenBudget } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { mapAiGradeBatchError } from "@/lib/aiGradeBatchApi";
import { dispatchAiGradeBatch } from "@/lib/queue/aiGradeBatchJob";

export const runtime = "nodejs";

/**
 * Chấm bài tập bằng AI hàng loạt (docs/tieu-chi/cham-bai-tap-bang-ai-hang-loat.md).
 *
 * GET  → lô hiện tại + kế hoạch (số bài sẽ chạy, ước lượng token, số dư ví) cho hộp xác nhận. Chỉ đọc.
 * POST → tạo lô và xếp hàng chạy. Chỉ chạy phần vừa số dư ví, không chạy rồi dừng giữa chừng. Chỉ LƯU GỢI Ý, không ghi điểm.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const includeFresh = new URL(req.url).searchParams.get("includeFresh") === "1";
  try {
    const [batch, plan, budget] = await Promise.all([
      getAiGradeBatch(userId, params.id),
      planAiGradeBatch(userId, params.id, { includeFresh }),
      getTokenBudget(userId),
    ]);
    const { fit, overflow } = fitTargetsToBudget(plan.targets, budget.total);
    const excluded: Record<string, number> = {};
    for (const x of plan.excluded) excluded[x.reason] = (excluded[x.reason] ?? 0) + 1;
    return NextResponse.json({
      batch,
      plan: {
        pending: plan.targets.length,
        estimatedTokens: plan.estimatedTokens,
        budgetTokens: budget.total,
        runnable: fit.length,
        overflow,
        excluded,
      },
    });
  } catch (e) {
    const m = mapAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = ((await readJson(req)) ?? {}) as { includeFresh?: unknown };
  const includeFresh = body.includeFresh === true;
  try {
    const plan = await planAiGradeBatch(userId, params.id, { includeFresh });
    const budget = await getTokenBudget(userId);
    const { fit, overflow } = fitTargetsToBudget(plan.targets, budget.total);
    if (plan.targets.length > 0 && fit.length === 0) {
      return NextResponse.json(
        { error: "no_token_budget", details: { budgetTokens: budget.total, neededTokens: plan.targets[0]!.estimatedTokens } },
        { status: 429 },
      );
    }
    const { batchId, total } = await startAiGradeBatch(userId, params.id, { includeFresh, limit: fit.length });
    const mode = await dispatchAiGradeBatch({ batchId });
    return NextResponse.json({ batchId, total, overflow, mode });
  } catch (e) {
    const m = mapAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}
