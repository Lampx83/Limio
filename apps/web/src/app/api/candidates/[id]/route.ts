import { NextResponse } from "next/server";
import { deleteCandidate, updateCandidate } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await updateCandidate(userId, params.id, {
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
      disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await deleteCandidate(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
