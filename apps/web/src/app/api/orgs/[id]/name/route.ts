import { NextResponse } from "next/server";
import { updateOrganizationName } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string") {
    return NextResponse.json({ error: "validation_failed", details: "name_required" }, { status: 400 });
  }

  try {
    const updated = await updateOrganizationName(userId, params.id, name);
    return NextResponse.json({ ok: true, name: updated.name });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
