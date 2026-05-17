import { NextResponse } from "next/server";
import { approveBatchAndSend, DispatchError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * POST — phase 2: send all selected items. Returns counts.
 * Long-running for large batches (≤200 candidates expected for v1);
 * future P5 work: queue via BullMQ.
 */
export async function POST(
  _req: Request,
  { params }: { params: { batchId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await approveBatchAndSend(params.batchId, userId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof DispatchError) {
      const status =
        e.code === "forbidden" ? 403 : e.code === "batch_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
