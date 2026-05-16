import { NextResponse } from "next/server";
import {
  cancelBatch,
  DispatchError,
  getBatchWithItems,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** GET — full batch + items + creator/approver (for review UI). */
export async function GET(
  _req: Request,
  { params }: { params: { batchId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const batch = await getBatchWithItems(params.batchId, userId);
    return NextResponse.json(batch);
  } catch (e) {
    return mapDispatchError(e);
  }
}

/** DELETE — cancel a draft batch. */
export async function DELETE(
  _req: Request,
  { params }: { params: { batchId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await cancelBatch(params.batchId, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapDispatchError(e);
  }
}

function mapDispatchError(e: unknown): NextResponse {
  if (e instanceof DispatchError) {
    const status =
      e.code === "forbidden" ? 403 : e.code === "batch_not_found" ? 404 : 400;
    return NextResponse.json({ error: e.code }, { status });
  }
  const mapped = mapKnownError(e);
  if (mapped) return mapped;
  throw e;
}
