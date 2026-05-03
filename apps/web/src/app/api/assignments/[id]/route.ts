import { NextResponse } from "next/server";
import { deleteAssignment, updateAssignment } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await updateAssignment(userId, params.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await deleteAssignment(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
