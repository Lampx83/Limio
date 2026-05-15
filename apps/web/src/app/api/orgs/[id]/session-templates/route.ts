import { NextResponse } from "next/server";
import {
  createSessionTemplate,
  listSessionTemplates,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Public-within-org: any logged-in user can read templates for round-create.
  // Tenant scoping enforced at apply time.
  try {
    const templates = await listSessionTemplates(params.id);
    return NextResponse.json({ templates });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const row = await createSessionTemplate(userId, params.id, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
