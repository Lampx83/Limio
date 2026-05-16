import { NextResponse } from "next/server";
import { DispatchError, toggleBatchItem } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** PATCH — toggle item.selected. Body: { selected: boolean } */
export async function PATCH(
  req: Request,
  { params }: { params: { batchId: string; itemId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { selected?: unknown } | null;
  if (typeof body?.selected !== "boolean") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    await toggleBatchItem(
      params.batchId,
      params.itemId,
      body.selected,
      userId,
    );
    return NextResponse.json({ ok: true });
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
