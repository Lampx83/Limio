import { NextResponse } from "next/server";
import { tagBankQuestion, untagBankQuestion } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Body: { skillId, weight? } */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { skillId?: string; weight?: number } | null;
  if (!body?.skillId)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await tagBankQuestion(userId, params.id, body.skillId, body.weight ?? 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Body: { skillId } */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { skillId?: string } | null;
  if (!body?.skillId)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await untagBankQuestion(userId, params.id, body.skillId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
