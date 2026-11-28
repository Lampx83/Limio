import { NextResponse } from "next/server";
import {
  fitTargetsToBudget,
  getOralAiGradeBatch,
  planOralAiGradeBatch,
  startOralAiGradeBatch,
} from "@feedbackme/core-lms";
import { getTokenBudget } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { mapOralAiGradeBatchError } from "@/lib/oralAiGradeBatchApi";
import { dispatchOralAiGradeBatch } from "@/lib/queue/oralAiGradeBatchJob";

export const runtime = "nodejs";

/**
 * Chấm vấn đáp bằng AI hàng loạt (docs/tieu-chi/cham-van-dap-bang-ai-hang-loat.md).
 *
 * GET  → lô hiện tại + kế hoạch (số lượt sẽ chạy, ước lượng token, số dư ví) cho hộp xác nhận. Chỉ đọc.
 * POST → tạo lô và xếp hàng chạy. Chỉ chạy phần vừa số dư ví, không chạy rồi dừng giữa chừng. Chỉ LƯU ĐỀ XUẤT, không chốt điểm.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const includeExisting = new URL(req.url).searchParams.get("includeExisting") === "1";
  try {
    const [batch, plan, budget] = await Promise.all([
      getOralAiGradeBatch(userId, params.id),
      planOralAiGradeBatch(userId, params.id, { includeExisting }),
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
    const m = mapOralAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = ((await readJson(req)) ?? {}) as { includeExisting?: unknown };
  const includeExisting = body.includeExisting === true;
  try {
    const plan = await planOralAiGradeBatch(userId, params.id, { includeExisting });
    const budget = await getTokenBudget(userId);
    const { fit, overflow } = fitTargetsToBudget(plan.targets, budget.total);
    if (plan.targets.length > 0 && fit.length === 0) {
      return NextResponse.json(
        { error: "no_token_budget", details: { budgetTokens: budget.total, neededTokens: plan.targets[0]!.estimatedTokens } },
        { status: 429 },
      );
    }
    const { batchId, total } = await startOralAiGradeBatch(userId, params.id, { includeExisting, limit: fit.length });
    const mode = await dispatchOralAiGradeBatch({ batchId });
    return NextResponse.json({ batchId, total, overflow, mode });
  } catch (e) {
    const m = mapOralAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}
