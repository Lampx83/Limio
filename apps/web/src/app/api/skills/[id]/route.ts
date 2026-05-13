import { NextResponse } from "next/server";
import { deleteSkill, updateSkill } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJson(req);
  try {
    await updateSkill(params.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    await deleteSkill(params.id, { force });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
