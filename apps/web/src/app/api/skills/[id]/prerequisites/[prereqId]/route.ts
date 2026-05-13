import { NextResponse } from "next/server";
import { removeSkillPrerequisite } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; prereqId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await removeSkillPrerequisite(params.id, params.prereqId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
